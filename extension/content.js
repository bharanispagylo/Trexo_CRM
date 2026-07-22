/**
 * content.js — Spagylo Bug Reporter Content Script (BugHerd-style)
 *
 * Injected into every page. Handles:
 *   - Comment mode toggle (from popup or keyboard shortcut)
 *   - Click anywhere to place a pin marker
 *   - Screenshot capture & annotation canvas
 *   - BugHerd-style floating form with severity/status/tags
 *   - Sending captured data to the background service worker
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let commentModeActive = false;

let toolbarEl     = null;  // floating top-right toolbar
let pinEl         = null;  // placed pin marker
let commentBoxEl  = null;  // floating comment form
let toastEl       = null;  // status toast
let annotateEl    = null;  // annotation canvas overlay

// Keep track of cached projects/users from background
let cachedProjects = [];
let cachedUsers    = [];
let cachedCurrentUser = null; // logged-in user from extension auth

// Persisted settings (from "Keep these settings" checkbox)
let savedSettings = null;
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['savedSettings'], (res) => {
    if (res && res.savedSettings) {
      savedSettings = res.savedSettings;
    }
  });
}

// Track right-click position for accurate context-menu task creation
let lastRightClickPos = null;

window.addEventListener('contextmenu', (e) => {
  lastRightClickPos = {
    clientX: e.clientX,
    clientY: e.clientY,
    pageX: e.pageX,
    pageY: e.pageY,
    timestamp: Date.now()
  };
}, true);

// ── Collect page info ─────────────────────────────────────────────────

function collectPageInfo(clickX, clickY) {
  const safeX = typeof clickX === 'number' && !isNaN(clickX) ? clickX : Math.round(window.innerWidth / 2);
  const safeY = typeof clickY === 'number' && !isNaN(clickY) ? clickY : Math.round(window.innerHeight / 2);

  return {
    url:            window.location.href,
    pageTitle:      document.title,
    viewportWidth:  window.innerWidth,
    viewportHeight: window.innerHeight,
    pageWidth:      document.documentElement.scrollWidth,
    pageHeight:     document.documentElement.scrollHeight,
    scrollX:        Math.round(window.scrollX),
    scrollY:        Math.round(window.scrollY),
    devicePixelRatio: window.devicePixelRatio || 1,
    clickX:         safeX,
    clickY:         safeY,
    bounds: {
      x:      safeX - 20,
      y:      safeY - 20,
      width:  40,
      height: 40,
      clickX: safeX,
      clickY: safeY,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  };
}

// ── Pin marker ────────────────────────────────────────────────────────────────

function createPin(x, y) {
  removePin();
  pinEl = document.createElement('div');
  pinEl.className = '__spagylo__pin';
  pinEl.innerHTML = `
    <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 0 L 0 30 L 7.5 22.5 L 13.5 34.5 L 18.5 32 L 12.5 20 L 22.5 20 Z" fill="#dc2626"/>
    </svg>
  `;
  pinEl.style.left = `${x + window.scrollX}px`;
  pinEl.style.top  = `${y + window.scrollY}px`;
  document.body.appendChild(pinEl);
}

function removePin() {
  if (pinEl) { pinEl.remove(); pinEl = null; }
}

// ── Floating toolbar ──────────────────────────────────────────────────────────

function createToolbar() {
  if (toolbarEl) return;
  toolbarEl = document.createElement('div');
  toolbarEl.className = '__spagylo__toolbar';
  toolbarEl.innerHTML = `
    <div class="__spagylo__toolbar-badge">
      <span class="dot"></span>
      Comment Mode
    </div>
    <span class="__spagylo__toolbar-hint">Click anywhere to place a marker</span>
    <button class="__spagylo__toolbar-exit" title="Exit comment mode (Esc)">✕</button>
  `;
  toolbarEl.querySelector('.__spagylo__toolbar-exit').addEventListener('click', exitCommentMode);
  document.body.appendChild(toolbarEl);
}

function removeToolbar() {
  if (toolbarEl) { toolbarEl.remove(); toolbarEl = null; }
}

// ── Comment box (BugHerd-style floating form) ─────────────────────────────────

function closeCommentBox() {
  if (commentBoxEl) { commentBoxEl.remove(); commentBoxEl = null; }
}

function openCommentBox(clickX, clickY, pageInfo, screenshot) {
  try {
    closeCommentBox();

    const sv = savedSettings || {};
    const isKeepSettingsChecked = sv.keepSettings !== false;

    // Previously used settings
    const lastUsedTaskGroupId = sv.taskListId || localStorage.getItem('lastBugCaptureTaskGroup') || '';
    const lastUsedAssigneeId = sv.assigneeId || localStorage.getItem('lastBugCaptureAssignee') || cachedCurrentUser?.id || '';

    // Currently logged in user info
    const currentUserId = String(cachedCurrentUser?.id || '').toLowerCase();
    const currentUserName = String(cachedCurrentUser?.fullName || cachedCurrentUser?.firstName || cachedCurrentUser?.name || '').toLowerCase();

    // Filter projects where the currently logged-in user is involved
    const isUserInvolvedInProject = (p) => {
      if (!p) return false;
      const rawMembers = (p.members || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
      if (rawMembers.length > 0) {
        const isMember = rawMembers.some(m =>
          m === currentUserId ||
          m === currentUserName ||
          (currentUserName && (m.includes(currentUserName) || currentUserName.includes(m))) ||
          (currentUserId && m.includes(currentUserId))
        );
        if (isMember) return true;
      }
      // Check if user has favorited any task list in this project
      const hasFav = (p.taskLists || []).some(l => l.isFavorite);
      if (hasFav) return true;

      // Fallback: If no specific members defined on project or user is Admin/SuperAdmin
      if (rawMembers.length === 0 || cachedCurrentUser?.role === 'Admin' || cachedCurrentUser?.role === 'SuperAdmin') {
        return true;
      }
      return false;
    };

    const involvedProjects = (cachedProjects || []).filter(isUserInvolvedInProject);
    const projectsToUse = involvedProjects.length > 0 ? involvedProjects : (cachedProjects || []);

    // Collect task groups from involved projects — prioritize favorite task groups
    const favoriteTaskGroups = [];
    const allInvolvedTaskGroups = [];

    projectsToUse.forEach(p => {
      const lists = p.taskLists || [];
      lists.forEach(l => {
        const item = {
          id: l.id,
          name: `${l.name} (${p.name})`,
          projectId: p.id,
          projectName: p.name,
          isFavorite: !!l.isFavorite
        };
        allInvolvedTaskGroups.push(item);
        if (l.isFavorite) {
          favoriteTaskGroups.push(item);
        }
      });
    });

    // Display favorite task groups if available, otherwise display all task groups of involved projects
    const displayTaskGroups = favoriteTaskGroups.length > 0 ? favoriteTaskGroups : allInvolvedTaskGroups;

    // Auto-select task group: last used or first available
    let defaultTaskGroupId = lastUsedTaskGroupId;
    if (!displayTaskGroups.some(g => String(g.id) === String(defaultTaskGroupId))) {
      defaultTaskGroupId = displayTaskGroups[0]?.id || '';
    }

    const taskGroupOptionsHtml = displayTaskGroups.length > 0
      ? displayTaskGroups.map(g =>
          `<option value="${g.id}" data-project="${g.projectId}" ${String(g.id) === String(defaultTaskGroupId) ? 'selected' : ''}>${g.name}</option>`
        ).join('')
      : `<option value="">No task groups available</option>`;

    const currentUrl = pageInfo?.url || window.location.href || '';
    const defaultDescription = sv.description || currentUrl;

    commentBoxEl = document.createElement('div');
    commentBoxEl.className = '__spagylo__comment-box';
    commentBoxEl.style.width = '560px';
    commentBoxEl.innerHTML = `
      <div class="__spagylo__comment-box-header">
        <div class="__spagylo__comment-box-title">
          <span class="__spagylo__header-dot"></span>
          Spagylo Bug Capture
        </div>
        <button class="__spagylo__comment-box-close" title="Cancel">✕</button>
      </div>

      <div class="__spagylo__comment-box-body" style="padding: 16px; display: flex; flex-direction: column; gap: 12px; max-height: 80vh; overflow-y: auto;">
        <!-- Row 1: Title & Type -->
        <div class="__spagylo__row" style="display: flex; gap: 12px;">
          <div class="__spagylo__field" style="flex: 2;">
            <label class="__spagylo__label">Title *</label>
            <input
              class="__spagylo__input"
              data-field="title"
              type="text"
              placeholder="What is the task about? *"
              value="${sv.title || ''}"
            />
          </div>
          <div class="__spagylo__field" style="flex: 1;">
            <label class="__spagylo__label">Type</label>
            <select class="__spagylo__select" data-field="taskType">
              <option value="Bug" ${!sv.taskType || sv.taskType === 'Bug' ? 'selected' : ''}>Bug</option>
              <option value="Task" ${sv.taskType === 'Task' ? 'selected' : ''}>Task</option>
              <option value="calls/meetings" ${sv.taskType === 'calls/meetings' ? 'selected' : ''}>Calls/Meetings</option>
              <option value="Recurring Task" ${sv.taskType === 'Recurring Task' ? 'selected' : ''}>Recurring Task</option>
            </select>
          </div>
        </div>

        <!-- Row 2 (Full Width): Description -->
        <div class="__spagylo__field">
          <label class="__spagylo__label">Description</label>
          <textarea
            class="__spagylo__textarea"
            data-field="description"
            placeholder="Add description (optional)"
            maxlength="2000"
            rows="3"
          >${defaultDescription}</textarea>
          <div class="__spagylo__char-counter"><span class="__spagylo__char-count">${defaultDescription.length}</span> / 2000</div>
        </div>

        <!-- Row 3: Task Group & Status -->
        <div class="__spagylo__row" style="display: flex; gap: 12px;">
          <div class="__spagylo__field" style="flex: 1;">
            <label class="__spagylo__label">Task Group</label>
            <select class="__spagylo__select" data-field="taskGroup" id="__spagylo__task-group-select">
              ${taskGroupOptionsHtml}
            </select>
          </div>
          <div class="__spagylo__field" style="flex: 1;">
            <label class="__spagylo__label">Status</label>
            <select class="__spagylo__select" data-field="status">
              <option value="To Do" ${!sv.status || sv.status === 'To Do' ? 'selected' : ''}>To Do</option>
              <option value="In Progress" ${sv.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="On Hold" ${sv.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
              <option value="In Testing" ${sv.status === 'In Testing' ? 'selected' : ''}>In Testing</option>
              <option value="Dev Verified" ${sv.status === 'Dev Verified' ? 'selected' : ''}>Dev Verified</option>
              <option value="Re-opened" ${sv.status === 'Re-opened' ? 'selected' : ''}>Re-opened</option>
              <option value="Prod Deployed" ${sv.status === 'Prod Deployed' ? 'selected' : ''}>Prod Deployed</option>
              <option value="Prod Verified" ${sv.status === 'Prod Verified' ? 'selected' : ''}>Prod Verified</option>
              <option value="Delivered" ${sv.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Not an issue" ${sv.status === 'Not an issue' ? 'selected' : ''}>Not an issue</option>
              <option value="Archived" ${sv.status === 'Archived' ? 'selected' : ''}>Archived</option>
            </select>
          </div>
        </div>

        <!-- Row 4: Assignee & Priority -->
        <div class="__spagylo__row" style="display: flex; gap: 12px;">
          <div class="__spagylo__field" style="flex: 1;">
            <label class="__spagylo__label">Assignee</label>
            <select class="__spagylo__select" data-field="assignee" id="__spagylo__assignee-select">
              <!-- Dynamically populated based on task group selection -->
            </select>
          </div>
          <div class="__spagylo__field" style="flex: 1;">
            <label class="__spagylo__label">Priority</label>
            <select class="__spagylo__select" data-field="priority">
              <option value="Critical" ${sv.priority === 'Critical' ? 'selected' : ''}>Critical</option>
              <option value="High" ${sv.priority === 'High' ? 'selected' : ''}>High</option>
              <option value="Medium" ${!sv.priority || sv.priority === 'Medium' ? 'selected' : ''}>Medium</option>
              <option value="Low" ${sv.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
          </div>
        </div>

        <!-- Row 5: Due Date & Delivery Date -->
        <div class="__spagylo__row" style="display: flex; gap: 12px;">
          <div class="__spagylo__field" style="flex: 1;">
            <label class="__spagylo__label">Due Date</label>
            <input type="date" class="__spagylo__input" data-field="dueDate" value="${sv.dueDate || ''}" />
          </div>
          <div class="__spagylo__field" style="flex: 1;">
            <label class="__spagylo__label">Delivery Date</label>
            <input type="date" class="__spagylo__input" data-field="deliveryDate" value="${sv.deliveredDate || ''}" />
          </div>
        </div>

        <!-- Screenshot strip -->
        <div class="__spagylo__screenshot-strip" id="__spagylo__screenshot-strip">
          ${screenshot ? `
            <div class="__spagylo__screenshot-thumb" title="Click to view full preview">
              <img src="${screenshot}" alt="Screenshot" />
            </div>
            <div class="__spagylo__screenshot-actions">
              <span class="__spagylo__screenshot-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                Screenshot
              </span>
              <button class="__spagylo__btn-annotate" title="Edit screenshot">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
            </div>
          ` : '<span class="__spagylo__screenshot-label" style="color:#94a3b8;">No screenshot</span>'}
        </div>

        <!-- Keep settings -->
        <div class="__spagylo__check-row">
          <label>
            <input type="checkbox" class="__spagylo__checkbox" data-field="keepSettings" ${isKeepSettingsChecked ? 'checked' : ''} />
            Keep these settings
          </label>
        </div>
      </div>

      <div class="__spagylo__comment-box-footer">
        <button class="__spagylo__btn-cancel">Cancel</button>
        <button class="__spagylo__btn-save">
          <span class="btn-text">Create task</span>
        </button>
      </div>
    `;

    // Position box comfortably on screen
    const boxW = 560, boxH = 580;
    let left = clickX + 20;
    let top  = clickY - boxH / 2;

    if (left + boxW > window.innerWidth - 16)
      left = clickX - boxW - 20;
    if (top + boxH > window.innerHeight - 16)
      top = window.innerHeight - boxH - 16;
    left = Math.max(8, left);
    top  = Math.max(8, top);

    commentBoxEl.style.left = `${left}px`;
    commentBoxEl.style.top  = `${top}px`;

    document.body.appendChild(commentBoxEl);

    // Dynamic Assignee Filter based on Task Group
    const taskGroupSelect = commentBoxEl.querySelector('#__spagylo__task-group-select');
    const assigneeSelect  = commentBoxEl.querySelector('#__spagylo__assignee-select');

    const updateAssigneeOptions = (selectedGroupId) => {
      if (!assigneeSelect) return;
      
      let projId = '';
      const group = displayTaskGroups.find(g => String(g.id) === String(selectedGroupId)) || allInvolvedTaskGroups.find(g => String(g.id) === String(selectedGroupId));
      if (group) {
        projId = group.projectId;
      } else if (taskGroupSelect && taskGroupSelect.selectedIndex >= 0) {
        const opt = taskGroupSelect.options[taskGroupSelect.selectedIndex];
        projId = opt?.getAttribute('data-project') || '';
      }

      const proj = (cachedProjects || []).find(p => String(p.id) === String(projId));
      let projectAssignedUsers = [];

      if (proj && proj.members) {
        const memberTokens = proj.members.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
        if (memberTokens.length > 0) {
          projectAssignedUsers = (cachedUsers || []).filter(u => {
            const uId = String(u.id || '').toLowerCase();
            const uName = String(u.name || '').toLowerCase();
            const uEmail = String(u.email || '').toLowerCase();
            const uFirst = String(u.firstName || '').toLowerCase();
            return memberTokens.some(m =>
              m === uId ||
              m === uName ||
              m === uEmail ||
              (uName && (m.includes(uName) || uName.includes(m))) ||
              (uFirst && (m.includes(uFirst) || uFirst.includes(m)))
            );
          });
        }
      }

      // Show ONLY the members of the selected project (no all-assignees fallback)
      let finalUsers = projectAssignedUsers;

      let targetAssigneeId = '';
      if (finalUsers.some(u => String(u.id) === String(lastUsedAssigneeId))) {
        targetAssigneeId = lastUsedAssigneeId;
      } else if (finalUsers.some(u => String(u.id) === String(cachedCurrentUser?.id))) {
        targetAssigneeId = cachedCurrentUser?.id;
      } else if (finalUsers.length > 0) {
        targetAssigneeId = finalUsers[0].id;
      }

      const options = [
        '<option value="">— Unassigned —</option>',
        ...finalUsers.map(u => `<option value="${u.id}" ${String(u.id) === String(targetAssigneeId) ? 'selected' : ''}>${u.name}</option>`)
      ].join('');

      assigneeSelect.innerHTML = options;
    };

    if (taskGroupSelect) {
      updateAssigneeOptions(taskGroupSelect.value);
      taskGroupSelect.addEventListener('change', (e) => {
        updateAssigneeOptions(e.target.value);
      });
    }

    // Focus Title Input
    setTimeout(() => commentBoxEl.querySelector('[data-field="title"]')?.focus(), 50);

    // ── Character counter ──
    const textarea = commentBoxEl.querySelector('.__spagylo__textarea');
    const charCount = commentBoxEl.querySelector('.__spagylo__char-count');
    if (textarea && charCount) {
      textarea.addEventListener('input', () => {
        charCount.textContent = textarea.value.length;
      });
    }

    // ── Event handlers ──
    commentBoxEl.querySelector('.__spagylo__comment-box-close')
      .addEventListener('click', () => { closeCommentBox(); removePin(); });
    commentBoxEl.querySelector('.__spagylo__btn-cancel')
      .addEventListener('click', () => { closeCommentBox(); removePin(); });

    commentBoxEl.querySelector('.__spagylo__btn-save')
      .addEventListener('click', () => submitBugReport(pageInfo, screenshot));

    // Submit on Ctrl+Enter
    if (textarea) {
      textarea.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          submitBugReport(pageInfo, screenshot);
        }
      });
    }
    const titleInput = commentBoxEl.querySelector('[data-field="title"]');
    if (titleInput) {
      titleInput.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          submitBugReport(pageInfo, screenshot);
        }
      });
    }

    // Edit button
    const annotateBtn = commentBoxEl.querySelector('.__spagylo__btn-annotate');
    if (annotateBtn && screenshot) {
      annotateBtn.addEventListener('click', () => openAnnotateCanvas(screenshot, pageInfo));
    }

    // Screenshot thumbnail click -> full-size preview lightbox
    const thumbEl = commentBoxEl.querySelector('.__spagylo__screenshot-thumb');
    if (thumbEl && screenshot) {
      thumbEl.style.cursor = 'pointer';
      thumbEl.addEventListener('click', () => {
        const curImg = commentBoxEl.__spagylo_screenshot || screenshot;
        if (curImg) openImageLightbox(curImg);
      });
    }

    // Prevent clicks inside the box from propagating
    commentBoxEl.addEventListener('click', e => e.stopPropagation());
  } catch (err) {
    console.error('[Spagylo] Error opening comment box:', err);
  }
}

// ── Full-size image lightbox modal ────────────────────────────────────────────

function openImageLightbox(src) {
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = '__spagylo__lightbox-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 2147483647; background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(4px); display: flex; align-items: center;
    justify-content: center; padding: 24px; box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  overlay.innerHTML = `
    <div style="position: relative; max-width: 90vw; max-height: 90vh; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <span style="font-weight: 700; font-size: 14px; color: #0f172a;">Screenshot Preview</span>
        <button class="__spagylo__lightbox-close" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
      <div style="padding: 16px; overflow: auto; display: flex; justify-content: center; align-items: center; background: #0f172a;">
        <img src="${src}" style="max-width: 100%; max-height: calc(85vh - 60px); border-radius: 6px; border: 1px solid #334155; object-fit: contain;" alt="Full Screenshot" />
      </div>
    </div>
  `;

  overlay.querySelector('.__spagylo__lightbox-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

// ── Annotation canvas overlay ─────────────────────────────────────────────────

function openAnnotateCanvas(screenshot, pageInfo) {
  if (annotateEl) annotateEl.remove();

  annotateEl = document.createElement('div');
  annotateEl.className = '__spagylo__annotate-overlay';
  annotateEl.innerHTML = `
    <div class="__spagylo__annotate-toolbar" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #ffffff; padding: 10px 16px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; user-select: none;">
      <span style="font-weight:700; font-size:14px; color:#0f172a;">Edit Screenshot</span>

      <!-- Shape & Text Tool Selectors -->
      <div class="__spagylo__tool-buttons" style="display: flex; gap: 6px; align-items: center;">
        <button class="__spagylo__tool-btn active" data-tool="rect" title="Rectangle" style="padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #2563eb; color: #ffffff; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          Rectangle
        </button>
        <button class="__spagylo__tool-btn" data-tool="circle" title="Circle" style="padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff; color: #334155; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
          Circle
        </button>
        <button class="__spagylo__tool-btn" data-tool="text" title="Text Annotation" style="padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff; color: #334155; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/></svg>
          Text
        </button>
      </div>

      <!-- Font Selector -->
      <div class="__spagylo__font-picker" style="display: flex; align-items: center; gap: 6px;">
        <label style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Font</label>
        <select class="__spagylo__font-select" style="padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; outline: none; background: #ffffff; cursor: pointer; font-weight: 500;">
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Verdana">Verdana</option>
          <option value="Courier New">Courier New</option>
        </select>
      </div>

      <!-- Color Palette -->
      <div style="display:flex; gap:6px; align-items: center;">
        <button class="__spagylo__annotate-tool" data-color="#dc2626" title="Red" style="background:#dc2626; width:22px; height:22px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 2px #0f172a; cursor:pointer; padding:0;"></button>
        <button class="__spagylo__annotate-tool" data-color="#2563eb" title="Blue" style="background:#2563eb; width:22px; height:22px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px #cbd5e1; cursor:pointer; padding:0;"></button>
        <button class="__spagylo__annotate-tool" data-color="#16a34a" title="Green" style="background:#16a34a; width:22px; height:22px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px #cbd5e1; cursor:pointer; padding:0;"></button>
        <button class="__spagylo__annotate-tool" data-color="#eab308" title="Yellow" style="background:#eab308; width:22px; height:22px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px #cbd5e1; cursor:pointer; padding:0;"></button>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:8px;">
        <button class="__spagylo__btn-cancel __spagylo__annotate-cancel">Cancel</button>
        <button class="__spagylo__btn-save __spagylo__annotate-save"><span class="btn-text">Save</span></button>
      </div>
    </div>
    <div class="__spagylo__annotate-canvas-wrap">
      <img class="__spagylo__annotate-bg" src="${screenshot}" />
      <canvas class="__spagylo__annotate-canvas"></canvas>
    </div>
  `;

  document.body.appendChild(annotateEl);

  const canvasWrap = annotateEl.querySelector('.__spagylo__annotate-canvas-wrap');
  const bgImg      = annotateEl.querySelector('.__spagylo__annotate-bg');
  const canvas     = annotateEl.querySelector('.__spagylo__annotate-canvas');
  const ctx        = canvas.getContext('2d');

  let activeTool   = 'rect'; // 'rect', 'circle', 'text'
  let strokeColor  = '#dc2626';
  let selectedFont = 'Arial';

  // Tool Switching (Rectangle, Circle, Text)
  annotateEl.querySelectorAll('.__spagylo__tool-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      activeTool = btn.dataset.tool;
      annotateEl.querySelectorAll('.__spagylo__tool-btn').forEach(b => {
        b.style.background = '#ffffff';
        b.style.color = '#334155';
      });
      btn.style.background = '#2563eb';
      btn.style.color = '#ffffff';
    });
  });

  // Font Selection
  const fontSelect = annotateEl.querySelector('.__spagylo__font-select');
  if (fontSelect) {
    fontSelect.addEventListener('change', e => {
      selectedFont = e.target.value;
    });
  }

  // Color Selection
  annotateEl.querySelectorAll('.__spagylo__annotate-tool').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      strokeColor = btn.dataset.color;
      annotateEl.querySelectorAll('.__spagylo__annotate-tool').forEach(b => b.style.boxShadow = '0 0 0 1px #cbd5e1');
      btn.style.boxShadow = '0 0 0 2px #0f172a';
    });
  });

  const getCanvasCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const initCanvas = () => {
    const natW = bgImg.naturalWidth  || 1200;
    const natH = bgImg.naturalHeight || 800;

    canvas.width  = natW;
    canvas.height = natH;

    const maxW = Math.max(300, window.innerWidth - 80);
    const maxH = Math.max(300, window.innerHeight - 140);
    const ratio = Math.min(maxW / natW, maxH / natH, 1);

    const displayW = Math.round(natW * ratio);
    const displayH = Math.round(natH * ratio);

    canvasWrap.style.width  = `${displayW}px`;
    canvasWrap.style.height = `${displayH}px`;

    bgImg.style.width  = `${displayW}px`;
    bgImg.style.height = `${displayH}px`;

    canvas.style.width  = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    ctx.lineWidth = Math.max(3, Math.round(3 * (natW / displayW)));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  if (bgImg.complete && bgImg.naturalWidth > 0) {
    initCanvas();
  } else {
    bgImg.onload = initCanvas;
    bgImg.onerror = initCanvas;
  }

  let isDrawing = false;
  let startX = 0, startY = 0;
  let savedSnapshot = null;

  canvas.addEventListener('mousedown', e => {
    isDrawing = true;
    const { x, y } = getCanvasCoords(e);
    startX = x;
    startY = y;

    // Save current canvas pixels before starting new shape
    savedSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    e.preventDefault();
  });

  canvas.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);

    // Restore pre-drag canvas state
    if (savedSnapshot) {
      ctx.putImageData(savedSnapshot, 0, 0);
    }

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / (rect.width || 1);
    ctx.lineWidth = Math.max(3, Math.round(3 * scale));

    if (activeTool === 'rect') {
      ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (activeTool === 'circle') {
      const rx = Math.abs(x - startX) / 2;
      const ry = Math.abs(y - startY) / 2;
      const cx = Math.min(startX, x) + rx;
      const cy = Math.min(startY, y) + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (!isDrawing) return;
    isDrawing = false;
    const { x, y } = getCanvasCoords(e);
    const dist = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);

    // If Text tool is active or mouse click without drag
    if (activeTool === 'text' || dist < 4) {
      e.stopPropagation();
      e.preventDefault();

      const existingInput = canvasWrap.querySelector('.__spagylo__temp-text-input');
      if (existingInput) existingInput.remove();

      const input = document.createElement('input');
      input.type = 'text';
      input.className = '__spagylo__temp-text-input';
      input.placeholder = 'Type text...';

      const rect = canvas.getBoundingClientRect();
      const cssX = (startX / canvas.width) * rect.width;
      const cssY = (startY / canvas.height) * rect.height;

      input.style.cssText = `
        position: absolute;
        left: ${cssX}px;
        top: ${cssY - 5}px;
        z-index: 2147483647;
        background: rgba(255, 255, 255, 0.95);
        border: 2px dashed ${strokeColor};
        color: ${strokeColor};
        font-family: ${selectedFont}, sans-serif;
        font-size: 16px;
        font-weight: bold;
        outline: none;
        padding: 4px 6px;
        border-radius: 4px;
        min-width: 120px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      `;

      canvasWrap.appendChild(input);
      input.focus();

      const saveText = () => {
        const text = input.value.trim();
        if (text) {
          const rect = canvas.getBoundingClientRect();
          const scale = canvas.width / (rect.width || 1);
          const fontSize = Math.round(18 * scale);

          ctx.font = `bold ${fontSize}px ${selectedFont}, sans-serif`;
          ctx.fillStyle = strokeColor;
          ctx.textBaseline = 'top';
          ctx.fillText(text, startX, startY);
        }
        input.remove();
      };

      input.addEventListener('keydown', keyEvent => {
        if (keyEvent.key === 'Enter') {
          saveText();
        } else if (keyEvent.key === 'Escape') {
          input.remove();
        }
      });

      input.addEventListener('blur', saveText);
    }
  });

  canvas.addEventListener('mouseleave', () => { isDrawing = false; });

  // Cancel
  annotateEl.querySelector('.__spagylo__annotate-cancel').addEventListener('click', () => {
    annotateEl.remove();
    annotateEl = null;
  });

  // Save — merge drawing canvas with background image
  annotateEl.querySelector('.__spagylo__annotate-save').addEventListener('click', () => {
    const mergeCanvas = document.createElement('canvas');
    mergeCanvas.width  = bgImg.naturalWidth;
    mergeCanvas.height = bgImg.naturalHeight;
    const mCtx = mergeCanvas.getContext('2d');
    mCtx.drawImage(bgImg, 0, 0);
    mCtx.drawImage(canvas, 0, 0);

    const newScreenshot = mergeCanvas.toDataURL('image/jpeg', 0.75);

    // Update screenshot preview in the form
    const strip = document.getElementById('__spagylo__screenshot-strip');
    if (strip) {
      const thumb = strip.querySelector('img');
      if (thumb) thumb.src = newScreenshot;
    }

    if (commentBoxEl) {
      commentBoxEl.__spagylo_screenshot = newScreenshot;
    }

    annotateEl.remove();
    annotateEl = null;
  });

  // Prevent propagation
  annotateEl.addEventListener('click', e => e.stopPropagation());
}

// ── Submit bug report ─────────────────────────────────────────────────────────

async function submitBugReport(pageInfo, originalScreenshot) {
  const titleInput = commentBoxEl?.querySelector('[data-field="title"]');
  const title = titleInput?.value.trim();

  if (!title) {
    titleInput?.focus();
    titleInput?.style.setProperty('border-color', '#dc2626');
    return;
  }

  const textarea  = commentBoxEl?.querySelector('.__spagylo__textarea');
  const comment   = textarea?.value.trim() || '';

  const priority   = commentBoxEl?.querySelector('[data-field="priority"]')?.value || 'Medium';
  const taskType   = commentBoxEl?.querySelector('[data-field="taskType"]')?.value || 'Bug';
  const status     = commentBoxEl?.querySelector('[data-field="status"]')?.value || 'To Do';
  const taskGroupSelect = commentBoxEl?.querySelector('[data-field="taskGroup"]');
  const taskListId = taskGroupSelect?.value || '';
  
  let projectId = '';
  if (taskListId && taskGroupSelect) {
    const selectedOption = taskGroupSelect.options[taskGroupSelect.selectedIndex];
    projectId = selectedOption?.getAttribute('data-project') || '';
  }

  const assigneeId = commentBoxEl?.querySelector('[data-field="assignee"]')?.value || '';
  const dueDate    = commentBoxEl?.querySelector('[data-field="dueDate"]')?.value || '';
  const deliveredDate = commentBoxEl?.querySelector('[data-field="deliveryDate"]')?.value || '';
  const keepSettings = commentBoxEl?.querySelector('[data-field="keepSettings"]')?.checked;

  // Use annotated screenshot if available, else original
  const screenshot = commentBoxEl?.__spagylo_screenshot || originalScreenshot;

  // Save last used task group and assignee
  if (taskListId) localStorage.setItem('lastBugCaptureTaskGroup', taskListId);
  if (assigneeId) localStorage.setItem('lastBugCaptureAssignee', assigneeId);

  // Save settings if checkbox is checked
  if (keepSettings) {
    savedSettings = { priority, taskType, status, projectId, assigneeId, dueDate, deliveredDate, taskListId, keepSettings: true, title: '', description: '' };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ savedSettings });
    }
  } else {
    savedSettings = { keepSettings: false };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ savedSettings });
    }
  }

  // Disable save button
  const saveBtn = commentBoxEl?.querySelector('.__spagylo__btn-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.querySelector('.btn-text').textContent = 'Creating…';
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SUBMIT_BUG',
      data: {
        comment,
        title,
        priority,
        taskType,
        status,
        projectId,
        taskListId,
        assigneeId,
        dueDate,
        deliveredDate,
        screenshot,
        elementInfo: {
          selector: '',
          xpath: '',
          tagName: '',
          id: null,
          classes: [],
          textContent: '',
          htmlSnippet: '',
          bounds: pageInfo.bounds,
          viewportWidth: pageInfo.viewportWidth,
          viewportHeight: pageInfo.viewportHeight,
          scrollX: pageInfo.scrollX,
          scrollY: pageInfo.scrollY,
          devicePixelRatio: pageInfo.devicePixelRatio,
        },
        url:       pageInfo.url,
        pageTitle: pageInfo.pageTitle,
        browser:   navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || navigator.userAgent.substring(0, 60),
        userAgent: navigator.userAgent,
      },
    });

    if (response?.success) {
      closeCommentBox();
      removePin();
      exitCommentMode();
      showToast(`✓ Task ${response.taskNo} created!`, 'success');
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (err) {
    showToast(`✗ ${err.message}`, 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.querySelector('.btn-text').textContent = 'Create task';
    }
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 4000) {
  if (toastEl) { toastEl.remove(); toastEl = null; }
  toastEl = document.createElement('div');
  toastEl.className = `__spagylo__toast ${type}`;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  setTimeout(() => { toastEl?.remove(); toastEl = null; }, duration);
}

// ── Comment mode enter / exit ─────────────────────────────────────────────────

function enterCommentMode() {
  if (commentModeActive) return;
  commentModeActive = true;

  document.body.classList.add('__spagylo__comment-mode');
  createToolbar();

  document.addEventListener('click',   onClick,   true);
  document.addEventListener('keydown', onKeyDown, true);
}

function exitCommentMode() {
  if (!commentModeActive) return;
  commentModeActive = false;

  document.body.classList.remove('__spagylo__comment-mode');
  removeToolbar();
  closeCommentBox();
  removePin();
  if (annotateEl) { annotateEl.remove(); annotateEl = null; }

  document.removeEventListener('click',   onClick,   true);
  document.removeEventListener('keydown', onKeyDown, true);

  // Notify background/popup that mode is off
  chrome.runtime.sendMessage({ type: 'COMMENT_MODE_CHANGED', active: false }).catch(() => {});
}

// ── DOM event handlers ────────────────────────────────────────────────────────

function isSpagyloElement(el) {
  return el && (
    el.classList?.contains('__spagylo__toolbar') ||
    el.closest?.('.__spagylo__toolbar') ||
    el.classList?.contains('__spagylo__comment-box') ||
    el.closest?.('.__spagylo__comment-box') ||
    el.classList?.contains('__spagylo__pin') ||
    el.closest?.('.__spagylo__pin') ||
    el.classList?.contains('__spagylo__toast') ||
    el.classList?.contains('__spagylo__annotate-overlay') ||
    el.closest?.('.__spagylo__annotate-overlay')
  );
}

function onClick(e) {
  const target = e.target;
  if (isSpagyloElement(target)) return;

  e.preventDefault();
  e.stopPropagation();

  // If a comment box is already open, close it + pin first
  if (commentBoxEl) {
    closeCommentBox();
    removePin();
  }

  const clickX = e.clientX;
  const clickY = e.clientY;

  // Place pin
  createPin(clickX, clickY);

  // Hide toolbar for clean screenshot
  if (toolbarEl) toolbarEl.style.display = 'none';
  if (pinEl) pinEl.style.display = 'none';

  const pageInfo = collectPageInfo(clickX, clickY);

  setTimeout(async () => {
    let screenshot = null;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_AND_ANNOTATE',
        elementInfo: pageInfo,
      });
      if (response?.success) {
        screenshot = response.screenshot;
      }
    } catch (err) {
      console.warn('[Spagylo] Screenshot capture failed:', err.message);
    } finally {
      if (toolbarEl) toolbarEl.style.display = '';
      if (pinEl) pinEl.style.display = '';
      openCommentBox(clickX, clickY, pageInfo, screenshot);
    }
  }, 150);
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (annotateEl) {
      annotateEl.remove();
      annotateEl = null;
    } else if (commentBoxEl) {
      closeCommentBox();
      removePin();
    } else {
      exitCommentMode();
    }
  }
}

// ── Message listener (from popup & background) ────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_COMMENT_MODE':
      if (message.active) {
        chrome.runtime.sendMessage({ type: 'GET_META' }, meta => {
          if (meta?.projects)    cachedProjects     = meta.projects;
          if (meta?.users)       cachedUsers        = meta.users;
          if (meta?.currentUser) cachedCurrentUser  = meta.currentUser;
          enterCommentMode();
        });
      } else {
        exitCommentMode();
      }
      sendResponse({ ok: true });
      break;

    case 'RIGHT_CLICK_CREATE_TASK':
      chrome.runtime.sendMessage({ type: 'GET_META' }, meta => {
        if (meta?.projects)    cachedProjects    = meta.projects;
        if (meta?.users)       cachedUsers       = meta.users;
        if (meta?.currentUser) cachedCurrentUser = meta.currentUser;
        
        let clickX, clickY;
        if (typeof message.pageX === 'number' && !isNaN(message.pageX) && message.pageX >= 0) {
          clickX = message.pageX - window.scrollX;
          clickY = message.pageY - window.scrollY;
        } else if (lastRightClickPos && (Date.now() - (lastRightClickPos.timestamp || 0) < 5000) && typeof lastRightClickPos.clientX === 'number' && !isNaN(lastRightClickPos.clientX)) {
          clickX = lastRightClickPos.clientX;
          clickY = lastRightClickPos.clientY;
        } else {
          clickX = Math.round(window.innerWidth / 2);
          clickY = Math.round(window.innerHeight / 2);
        }
        
        lastRightClickPos = null;

        clickX = Math.max(10, Math.min(window.innerWidth - 10, Math.round(clickX)));
        clickY = Math.max(10, Math.min(window.innerHeight - 10, Math.round(clickY)));
        
        createPin(clickX, clickY);

        if (toolbarEl) toolbarEl.style.display = 'none';
        if (pinEl) pinEl.style.display = 'none';

        const pageInfo = collectPageInfo(clickX, clickY);

        setTimeout(async () => {
          let screenshot = null;
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'CAPTURE_AND_ANNOTATE',
              elementInfo: pageInfo,
            });
            if (response?.success) {
              screenshot = response.screenshot;
            }
          } catch (err) {
            console.warn('[Spagylo] Screenshot capture failed:', err.message);
          } finally {
            if (toolbarEl) toolbarEl.style.display = '';
            if (pinEl) pinEl.style.display = '';
            openCommentBox(clickX, clickY, pageInfo, screenshot);
          }
        }, 150);
      });
      sendResponse({ ok: true });
      break;

    case 'GET_STATUS':
      sendResponse({ commentModeActive });
      break;

    case 'PING':
      sendResponse({ pong: true });
      break;
  }
  return true;
});
