/**
 * background.js — Spagylo Bug Reporter Service Worker
 *
 * Handles:
 *   - Auth token storage and refresh
 *   - Screenshot capture via chrome.tabs.captureVisibleTab()
 *   - Screenshot annotation (draws red rect around selected element)
 *   - API requests to Spagylo CRM
 *   - Keyboard shortcut command handling
 *   - Meta data caching (projects/users) for the content script
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_TOKEN    = 'spagylo_jwt';
const STORAGE_KEY_USER     = 'spagylo_user';
const STORAGE_KEY_API_URL  = 'spagylo_api_url';
const DEFAULT_API_URL      = 'https://crm.spagylo.com';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStorage(...keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(obj) {
  return chrome.storage.local.set(obj);
}

async function getApiUrl() {
  const { [STORAGE_KEY_API_URL]: url } = await getStorage(STORAGE_KEY_API_URL);
  if (!url || url.includes('localhost')) {
    return DEFAULT_API_URL;
  }
  return url.replace(/\/$/, '');
}

async function getToken() {
  const { [STORAGE_KEY_TOKEN]: token } = await getStorage(STORAGE_KEY_TOKEN);
  return token || null;
}

async function apiFetch(path, options = {}) {
  const baseUrl = await getApiUrl();
  const token   = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Screenshot capture and annotation ────────────────────────────────────────

async function captureAndAnnotate(tabId, bounds) {
  // Resolve the correct windowId — passing null is unreliable in service workers
  let windowId;
  try {
    if (tabId) {
      const tab = await chrome.tabs.get(tabId);
      windowId = tab.windowId;
    } else {
      const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
      windowId = win.id;
    }
  } catch (e) {
    // Fallback: let Chrome pick (may fail on some versions, but worth trying)
    windowId = undefined;
  }

  // Capture the visible area of the tab
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: 'jpeg',
    quality: 65,
  });

  // Annotate with crosshair marker
  const annotated = await annotateScreenshot(dataUrl, bounds);
  return annotated;
}

async function annotateScreenshot(dataUrl, bounds) {
  try {
    // Convert dataURL to Blob (fetch dataUrl is a clean, standard way to do this in Service Workers)
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    // Load as ImageBitmap (Worker-safe alternative to HTMLImageElement / Image)
    const img = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // Draw original screenshot
    ctx.drawImage(img, 0, 0);

    if (bounds) {
      let scaleX = bounds.devicePixelRatio || 1;
      let scaleY = bounds.devicePixelRatio || 1;

      if (bounds.viewportWidth && bounds.viewportWidth > 0) {
        scaleX = img.width / bounds.viewportWidth;
      }
      if (bounds.viewportHeight && bounds.viewportHeight > 0) {
        scaleY = img.height / bounds.viewportHeight;
      }

      const rawClickX = (bounds.clickX !== undefined && !isNaN(bounds.clickX)) 
        ? bounds.clickX 
        : (bounds.x + bounds.width / 2);
      const rawClickY = (bounds.clickY !== undefined && !isNaN(bounds.clickY)) 
        ? bounds.clickY 
        : (bounds.y + bounds.height / 2);

      const cx = rawClickX * scaleX;
      const cy = rawClickY * scaleY;
      const arrowScale = Math.max(scaleX, scaleY) * 2;

      // Draw solid red cursor arrow mark with tip at (cx, cy) (no shadow, no border)
      ctx.save();

      ctx.fillStyle = '#dc2626'; // Spagylo brand red (#dc2626)

      ctx.beginPath();
      ctx.moveTo(cx, cy); // Tip of arrow pointer at click location
      ctx.lineTo(cx, cy + 30 * arrowScale);
      ctx.lineTo(cx + 7.5 * arrowScale, cy + 22.5 * arrowScale);
      ctx.lineTo(cx + 13.5 * arrowScale, cy + 34.5 * arrowScale);
      ctx.lineTo(cx + 18.5 * arrowScale, cy + 32 * arrowScale);
      ctx.lineTo(cx + 12.5 * arrowScale, cy + 20 * arrowScale);
      ctx.lineTo(cx + 22.5 * arrowScale, cy + 20 * arrowScale);
      ctx.closePath();

      ctx.fill();

      ctx.restore();
    }

    // Convert canvas to Blob
    const outputBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    
    // Convert Blob back to dataURL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(outputBlob);
    });
  } catch (err) {
    console.warn('[Spagylo] Annotation failed, returning raw screenshot:', err);
    return dataUrl;
  }
}

// ── Meta cache (projects + users for comment box dropdowns) ──────────────────

let metaCache = { projects: [], users: [], currentUser: null, fetchedAt: 0 };
const META_CACHE_TTL = 10 * 1000; // 10 seconds (always fresh project members)

async function fetchMeta() {
  const now = Date.now();
  if (now - metaCache.fetchedAt < META_CACHE_TTL) return metaCache;

  try {
    const { [STORAGE_KEY_USER]: storedUser } = await getStorage(STORAGE_KEY_USER);
    const [projects, users] = await Promise.all([
      apiFetch('/api/browser/projects'),
      apiFetch('/api/browser/users'),
    ]);
    metaCache = { projects, users, currentUser: storedUser || null, fetchedAt: now };
  } catch {
    // Use stale cache if available
  }

  return metaCache;
}

// ── Login / logout ────────────────────────────────────────────────────────────

async function login(email, password) {
  const baseUrl = await getApiUrl();
  const res = await fetch(`${baseUrl}/api/browser/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');

  await setStorage({
    [STORAGE_KEY_TOKEN]: data.token,
    [STORAGE_KEY_USER]:  data.user,
  });

  metaCache = { projects: [], users: [], currentUser: null, fetchedAt: 0 }; // clear cache on new login
  return data;
}

async function logout() {
  await chrome.storage.local.remove([STORAGE_KEY_TOKEN, STORAGE_KEY_USER]);
  metaCache = { projects: [], users: [], currentUser: null, fetchedAt: 0 };
}

async function getAuthStatus() {
  const token = await getToken();
  if (!token) return { loggedIn: false };

  try {
    const user = await apiFetch('/api/browser/me');
    return { loggedIn: true, user };
  } catch {
    await logout();
    return { loggedIn: false };
  }
}

// ── Submit bug report ─────────────────────────────────────────────────────────

async function submitBugReport(tabId, payload) {
  const { elementInfo, comment, title, url, pageTitle, browser, userAgent, priority, projectId, assigneeId, severity, status, tags, taskType, dueDate, deliveredDate, taskListId } = payload;

  // Capture + annotate screenshot
  let screenshot = payload.screenshot || null;
  if (!screenshot) {
    try {
      screenshot = await captureAndAnnotate(tabId, {
        ...elementInfo.bounds,
        viewportWidth: elementInfo.viewportWidth,
        viewportHeight: elementInfo.viewportHeight,
        devicePixelRatio: elementInfo.devicePixelRatio,
      });
    } catch (err) {
      console.warn('[Spagylo] Screenshot failed:', err.message);
    }
  }

  const taskPayload = {
    comment,
    title,
    url,
    pageTitle,
    screenshot,
    elementSelector:  elementInfo.selector || '',
    elementXPath:     elementInfo.xpath || '',
    elementHTML:      elementInfo.htmlSnippet || '',
    elementText:      elementInfo.textContent || '',
    elementTag:       elementInfo.tagName || '',
    elementId:        elementInfo.id || null,
    elementClasses:   elementInfo.classes || [],
    bounds:           elementInfo.bounds,
    viewportWidth:    elementInfo.viewportWidth,
    viewportHeight:   elementInfo.viewportHeight,
    scrollX:          elementInfo.scrollX,
    scrollY:          elementInfo.scrollY,
    browser:          browser || navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],
    userAgent,
    priority:         priority || severity || 'Medium',
    projectId:        projectId || null,
    assignees:        assigneeId || null,
    severity:         severity || priority || 'Medium',
    status:           status || 'To Do',
    tags:             tags || '',
    taskType:         taskType || 'Bug',
    dueDate:          dueDate || null,
    deliveredDate:    deliveredDate || null,
    taskListId:       taskListId || null,
  };

  return apiFetch('/api/browser/task', {
    method: 'POST',
    body: JSON.stringify(taskPayload),
  });
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {

    case 'LOGIN':
      login(message.email, message.password)
        .then(data => sendResponse({ success: true, ...data }))
        .catch(err  => sendResponse({ success: false, error: err.message }));
      return true;

    case 'LOGOUT':
      logout().then(() => sendResponse({ success: true }));
      return true;

    case 'GET_AUTH_STATUS':
      getAuthStatus().then(status => sendResponse(status));
      return true;

    case 'GET_META':
      fetchMeta().then(meta => sendResponse(meta));
      return true;

    case 'CAPTURE_AND_ANNOTATE':
      captureAndAnnotate(tabId, {
        ...message.elementInfo.bounds,
        viewportWidth: message.elementInfo.viewportWidth,
        viewportHeight: message.elementInfo.viewportHeight,
        devicePixelRatio: message.elementInfo.devicePixelRatio,
      })
        .then(screenshot => sendResponse({ success: true, screenshot }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SUBMIT_BUG':
      submitBugReport(tabId, message.data)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err   => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SAVE_API_URL':
      setStorage({ [STORAGE_KEY_API_URL]: message.url })
        .then(() => sendResponse({ success: true }));
      return true;

    case 'GET_API_URL':
      getApiUrl().then(url => sendResponse({ url }));
      return true;

    case 'COMMENT_MODE_CHANGED':
      // Notify popup if open to update the toggle button state
      chrome.runtime.sendMessage({ type: 'POPUP_UPDATE_MODE', active: message.active })
        .catch(() => {});
      sendResponse({ ok: true });
      return true;
  }
});

// ── Keyboard shortcut command ─────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-comment-mode') return;

  const token = await getToken();
  if (!token) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Spagylo Bug Capture',
      message: 'Please log in first to use comment mode.',
    });
    return;
  }

  // Toggle on the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Ask content script for current state, then toggle
  try {
    const status = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
    const newActive = !status.commentModeActive;
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_COMMENT_MODE', active: newActive });
  } catch {
    // Content script not ready — inject it
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_COMMENT_MODE', active: true });
  }
});

// ── Context menu registration and click handling ───────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "create-task-menu",
    title: "Create Task",
    contexts: ["all"]
  });
  console.log('[Spagylo Bug Reporter] Extension installed/updated and context menus created.');
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab && tab.id && info.menuItemId === "create-task-menu") {
    chrome.tabs.sendMessage(tab.id, {
      type: 'RIGHT_CLICK_CREATE_TASK',
      pageX: info.pageX,
      pageY: info.pageY
    }).catch(async () => {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
        chrome.tabs.sendMessage(tab.id, {
          type: 'RIGHT_CLICK_CREATE_TASK',
          pageX: info.pageX,
          pageY: info.pageY
        });
      } catch (err) {
        console.error('Failed to inject content script on right click:', err);
      }
    });
  }
});
