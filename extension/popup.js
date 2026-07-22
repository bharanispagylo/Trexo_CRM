/**
 * popup.js — Spagylo Bug Reporter Popup Logic
 *
 * Manages:
 *   - Login / logout flow
 *   - Showing the correct view (login vs main)
 *   - Toggling comment mode on the active tab
 *   - Settings (API URL)
 */

'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────

const loginView          = document.getElementById('login-view');
const mainView           = document.getElementById('main-view');
const settingsPanel      = document.getElementById('settings-panel');

const inputEmail         = document.getElementById('input-email');
const inputPassword      = document.getElementById('input-password');
const btnLogin           = document.getElementById('btn-login');
const loginError         = document.getElementById('login-error');

const userAvatar         = document.getElementById('user-avatar');
const userName           = document.getElementById('user-name');
const userRole           = document.getElementById('user-role');

const modeIndicator      = document.getElementById('mode-indicator');
const btnToggleComment   = document.getElementById('btn-toggle-comment');

const btnSettingsToggle  = document.getElementById('btn-settings-toggle');
const btnSaveUrl         = document.getElementById('btn-save-url');
const inputApiUrl        = document.getElementById('input-api-url');
const btnLogout          = document.getElementById('btn-logout');

const authStatusIndicator = document.getElementById('auth-status-indicator');

// ── State ─────────────────────────────────────────────────────────────────────

let commentModeActive = false;
let activeTabId       = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return 'U';
  return name.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
}

function hideError() {
  loginError.style.display = 'none';
}

function sendToBackground(type, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...data }, response => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

async function sendToActiveTab(type, data = {}) {
  return new Promise((resolve, reject) => {
    if (!activeTabId) return reject(new Error('No active tab'));
    chrome.tabs.sendMessage(activeTabId, { type, ...data }, response => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

// ── Views ─────────────────────────────────────────────────────────────────────

function showLoginView() {
  loginView.style.display = 'block';
  mainView.style.display  = 'none';
  settingsPanel.style.display = 'none';
  btnLogout.style.display = 'none';
  authStatusIndicator.textContent = 'Not signed in';
  authStatusIndicator.style.color = '#94a3b8';
}

function showMainView(user) {
  loginView.style.display = 'none';
  mainView.style.display  = 'block';
  btnLogout.style.display = 'flex';
  authStatusIndicator.textContent = '● Connected';
  authStatusIndicator.style.color = '#16a34a';

  const fullName = user?.fullName || user?.email || 'User';
  userAvatar.textContent = getInitials(fullName);
  userName.textContent   = fullName;
  userRole.textContent   = user?.role || 'Member';
}

function updateCommentModeUI(active) {
  commentModeActive = active;

  if (modeIndicator) {
    modeIndicator.style.display = active ? 'flex' : 'none';
  }
  if (btnToggleComment) {
    if (active) {
      btnToggleComment.className   = 'btn btn-comment-mode active';
      btnToggleComment.innerHTML   = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Exit Comment Mode
      `;
    } else {
      btnToggleComment.className  = 'btn btn-comment-mode';
      btnToggleComment.innerHTML  = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Start Bug Capture
      `;
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Load saved API URL
  const apiRes = await sendToBackground('GET_API_URL').catch(() => ({}));
  inputApiUrl.value = (apiRes?.url && !apiRes.url.includes('localhost')) ? apiRes.url : 'https://crm.spagylo.com';

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id || null;

  // Check auth status
  const status = await sendToBackground('GET_AUTH_STATUS').catch(() => ({ loggedIn: false }));

  if (status?.loggedIn) {
    showMainView(status.user);

    // Check if comment mode is already active on this tab
    if (activeTabId) {
      try {
        const tabStatus = await sendToActiveTab('GET_STATUS');
        if (tabStatus?.commentModeActive) updateCommentModeUI(true);
      } catch {
        // Content script not loaded yet — ignore
      }
    }
  } else {
    showLoginView();
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

btnLogin.addEventListener('click', async () => {
  hideError();
  const email    = inputEmail.value.trim();
  const password = inputPassword.value;
  const url      = inputApiUrl.value.trim();

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  btnLogin.disabled     = true;
  btnLogin.innerHTML    = '<span class="loading-dots">Signing in</span>';

  try {
    if (url) {
      await sendToBackground('SAVE_API_URL', { url });
    }
    const res = await sendToBackground('LOGIN', { email, password });
    if (res?.success) {
      showMainView(res.user);
    } else {
      showError(res?.error || 'Login failed. Please try again.');
      btnLogin.disabled = false;
      btnLogin.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Sign In
      `;
    }
  } catch (err) {
    showError(err.message || 'Network error. Check your API URL in settings.');
    btnLogin.disabled = false;
    btnLogin.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
        <polyline points="10 17 15 12 10 7"/>
        <line x1="15" y1="12" x2="3" y2="12"/>
      </svg>
      Sign In
    `;
  }
});

// Submit on Enter key
inputPassword.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnLogin.click();
});

// ── Logout ────────────────────────────────────────────────────────────────────

btnLogout.addEventListener('click', async () => {
  // Exit comment mode first if active
  if (commentModeActive && activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_COMMENT_MODE', active: false }).catch(() => {});
  }
  await sendToBackground('LOGOUT');
  showLoginView();
});

// ── Toggle comment mode ───────────────────────────────────────────────────────

if (btnToggleComment) {
  btnToggleComment.addEventListener('click', async () => {
    if (!activeTabId) return;

    const newActive = !commentModeActive;

    try {
      // Try to send to content script
      await chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_COMMENT_MODE', active: newActive });
      updateCommentModeUI(newActive);
    } catch {
      // Content script not loaded — inject it
      try {
        await chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });
        await chrome.scripting.insertCSS({ target: { tabId: activeTabId }, files: ['styles.css'] });
        await chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_COMMENT_MODE', active: true });
        updateCommentModeUI(true);
      } catch (err) {
        console.error('[Popup] Failed to inject content script:', err);
      }
    }

    // Close popup so user can interact with the page
    if (newActive) window.close();
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

btnSettingsToggle.addEventListener('click', () => {
  const isVisible = settingsPanel.style.display !== 'none';
  settingsPanel.style.display = isVisible ? 'none' : 'block';
});

btnSaveUrl.addEventListener('click', async () => {
  const url = inputApiUrl.value.trim();
  if (!url) return;

  try {
    await sendToBackground('SAVE_API_URL', { url });
    btnSaveUrl.textContent = '✓';
    setTimeout(() => { btnSaveUrl.textContent = 'Save'; }, 1500);
  } catch (err) {
    console.error('Failed to save URL:', err);
  }
});

// ── Listen for mode changes from content script (via background) ──────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'POPUP_UPDATE_MODE') {
    updateCommentModeUI(message.active);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

init();
