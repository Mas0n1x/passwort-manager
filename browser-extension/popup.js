// Mason Password Manager - Browser Extension Popup

const API_URL = 'http://127.0.0.1:52849';

const statusBar = document.getElementById('status-bar');
const disconnectedState = document.getElementById('disconnected-state');
const lockedState = document.getElementById('locked-state');
const connectedState = document.getElementById('connected-state');
const saveCredentialsState = document.getElementById('save-credentials-state');
const passwordsList = document.getElementById('passwords-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');

let allPasswords = [];
let currentUrl = '';
let pendingCredentials = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await getCurrentTab();
  await checkPendingCredentials();
  await checkConnection();
  setupEventListeners();
});

// Check for pending credentials to save
async function checkPendingCredentials() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getPendingCredentials' });
    if (response && response.credentials) {
      pendingCredentials = response.credentials;
      showSaveCredentialsPrompt();
    }
  } catch (e) {
    console.error('Error checking pending credentials:', e);
  }
}

// Show save credentials prompt
function showSaveCredentialsPrompt() {
  if (!pendingCredentials) return;

  // Update UI
  document.getElementById('save-credentials-title').textContent =
    pendingCredentials.action === 'update' ? 'Passwort aktualisieren?' : 'Login speichern?';
  document.getElementById('save-cred-hostname').textContent = pendingCredentials.hostname;
  document.getElementById('save-cred-username').textContent = pendingCredentials.username;

  // Show save state instead of connected state
  statusBar.className = 'status-bar';
  statusBar.innerHTML = '<span class="status-dot"></span><span class="status-text">Neue Anmeldedaten erkannt</span>';
  disconnectedState.style.display = 'none';
  lockedState.style.display = 'none';
  connectedState.style.display = 'none';
  saveCredentialsState.style.display = 'block';
}

// Get current tab URL
async function getCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      currentUrl = tabs[0].url;
    }
  } catch (e) {
    console.error('Error getting current tab:', e);
  }
}

// Check connection to Mason Password Manager
async function checkConnection() {
  try {
    const response = await fetch(`${API_URL}/status`);
    const data = await response.json();

    if (data.status === 'running') {
      if (data.unlocked) {
        showConnectedState();
        await loadPasswordsForCurrentSite();
      } else {
        showLockedState();
      }
    }
  } catch (e) {
    showDisconnectedState();
  }
}

// Show disconnected state
function showDisconnectedState() {
  statusBar.className = 'status-bar error';
  statusBar.innerHTML = '<span class="status-dot"></span><span class="status-text">Nicht verbunden</span>';
  disconnectedState.style.display = 'flex';
  lockedState.style.display = 'none';
  connectedState.style.display = 'none';
}

// Show locked state
function showLockedState() {
  statusBar.className = 'status-bar warning';
  statusBar.innerHTML = '<span class="status-dot"></span><span class="status-text">Tresor gesperrt</span>';
  disconnectedState.style.display = 'none';
  lockedState.style.display = 'flex';
  connectedState.style.display = 'none';
}

// Show connected state
function showConnectedState() {
  statusBar.className = 'status-bar';
  statusBar.innerHTML = '<span class="status-dot"></span><span class="status-text">Verbunden</span>';
  disconnectedState.style.display = 'none';
  lockedState.style.display = 'none';
  connectedState.style.display = 'block';
}

// Load passwords for current site
async function loadPasswordsForCurrentSite() {
  try {
    // First, try to find passwords matching current URL
    if (currentUrl && currentUrl.startsWith('http')) {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'searchByUrl', url: currentUrl })
      });

      if (response.ok) {
        const matches = await response.json();
        if (matches.length > 0) {
          allPasswords = matches;
          renderPasswords(matches, true);
          return;
        }
      }
    }

    // If no matches, load all passwords
    await loadAllPasswords();
  } catch (e) {
    console.error('Error loading passwords:', e);
    showEmptyState();
  }
}

// Load all passwords
async function loadAllPasswords() {
  try {
    const response = await fetch(`${API_URL}/passwords`);
    if (response.ok) {
      allPasswords = await response.json();
      renderPasswords(allPasswords);
    }
  } catch (e) {
    console.error('Error loading all passwords:', e);
    showEmptyState();
  }
}

// Render passwords list
function renderPasswords(passwords, isMatched = false) {
  passwordsList.innerHTML = '';

  if (passwords.length === 0) {
    showEmptyState();
    return;
  }

  emptyState.style.display = 'none';

  // Show matched indicator
  if (isMatched && passwords.length > 0) {
    const matchedHeader = document.createElement('div');
    matchedHeader.className = 'matched-header';
    matchedHeader.innerHTML = `<i class="fas fa-check-circle"></i> Passend für diese Seite`;
    passwordsList.appendChild(matchedHeader);
  }

  passwords.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'password-item';

    // Extract domain from URL
    let domain = '';
    if (entry.url) {
      try {
        domain = new URL(entry.url).hostname;
      } catch {
        domain = entry.url;
      }
    }

    item.innerHTML = `
      <div class="password-icon">
        <i class="fas fa-key"></i>
      </div>
      <div class="password-info">
        <div class="password-title">${escapeHtml(entry.title)}</div>
        <div class="password-username">${escapeHtml(entry.username)}</div>
        ${domain ? `<div class="password-url">${escapeHtml(domain)}</div>` : ''}
      </div>
      <div class="password-actions">
        <button class="icon-btn fill-btn" title="Ausfüllen">
          <i class="fas fa-fill"></i>
        </button>
        <button class="icon-btn copy-btn" title="Kopieren">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    `;

    // Fill button
    item.querySelector('.fill-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await fillCredentials(entry.id);
    });

    // Copy button
    item.querySelector('.copy-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await copyPassword(entry.id);
    });

    // Click on item to fill
    item.addEventListener('click', () => fillCredentials(entry.id));

    passwordsList.appendChild(item);
  });
}

// Show empty state
function showEmptyState() {
  emptyState.style.display = 'block';
}

// Fill credentials in the page
async function fillCredentials(id) {
  try {
    const response = await fetch(`${API_URL}/passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getPassword', id })
    });

    if (response.ok) {
      const credentials = await response.json();

      // Send to content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillCredentials',
          username: credentials.username,
          password: credentials.password
        });
        showToast('Anmeldedaten eingefügt');
        setTimeout(() => window.close(), 1000);
      }
    }
  } catch (e) {
    console.error('Error filling credentials:', e);
    showToast('Fehler beim Einfügen', true);
  }
}

// Copy password
async function copyPassword(id) {
  try {
    const response = await fetch(`${API_URL}/passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getPassword', id })
    });

    if (response.ok) {
      const credentials = await response.json();
      await navigator.clipboard.writeText(credentials.password);
      showToast('Passwort kopiert');
    }
  } catch (e) {
    console.error('Error copying password:', e);
    showToast('Fehler beim Kopieren', true);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Retry button
  document.getElementById('retry-btn').addEventListener('click', () => {
    checkConnection();
  });

  // Save credentials buttons
  document.getElementById('confirm-save-btn').addEventListener('click', async () => {
    if (!pendingCredentials) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveCredentials',
        credentials: pendingCredentials
      });

      if (response.success) {
        showToast('Login gespeichert');
        await chrome.runtime.sendMessage({ action: 'clearPendingCredentials' });
        pendingCredentials = null;
        saveCredentialsState.style.display = 'none';
        await checkConnection();
      } else {
        showToast(response.error || 'Fehler beim Speichern', true);
      }
    } catch (e) {
      console.error('Error saving credentials:', e);
      showToast('Fehler beim Speichern', true);
    }
  });

  document.getElementById('dismiss-save-btn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearPendingCredentials' });
    pendingCredentials = null;
    saveCredentialsState.style.display = 'none';
    await checkConnection();
  });

  // Search - includes URL search
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      renderPasswords(allPasswords);
      return;
    }

    const filtered = allPasswords.filter(p => {
      // Extract domain from URL for search
      let domain = '';
      if (p.url) {
        try {
          domain = new URL(p.url).hostname.toLowerCase();
        } catch {
          domain = p.url.toLowerCase();
        }
      }

      return p.title.toLowerCase().includes(query) ||
             p.username.toLowerCase().includes(query) ||
             domain.includes(query) ||
             (p.url && p.url.toLowerCase().includes(query));
    });
    renderPasswords(filtered);
  });

  // Show all passwords
  document.getElementById('show-all-btn').addEventListener('click', async () => {
    await loadAllPasswords();
  });
}

// Show toast
function showToast(message, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
    <span>${message}</span>
  `;

  if (isError) {
    toast.style.borderColor = '#ff4757';
    toast.querySelector('i').style.color = '#ff4757';
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
