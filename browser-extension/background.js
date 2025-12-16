// Mason Password Manager - Background Service Worker

const API_URL = 'http://127.0.0.1:52849';

// Check connection status periodically
async function checkConnection() {
  try {
    const response = await fetch(`${API_URL}/status`);
    const data = await response.json();

    // Update badge based on status
    if (data.status === 'running' && data.unlocked) {
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#00ff88' });
    } else if (data.status === 'running') {
      chrome.action.setBadgeText({ text: '🔒' });
      chrome.action.setBadgeBackgroundColor({ color: '#ffa502' });
    }
  } catch (e) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4757' });
  }
}

// Check connection on startup
chrome.runtime.onStartup.addListener(() => {
  checkConnection();
});

// Check connection when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  checkConnection();
});

// Store for pending credentials to save
let pendingCredentials = null;

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openPopup') {
    // Can't programmatically open popup, but we can show a notification
    chrome.action.openPopup?.() || console.log('Cannot open popup programmatically');
  }

  if (message.action === 'checkStatus') {
    checkConnection().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Handle captured credentials from content script
  if (message.action === 'credentialsCaptured') {
    handleCapturedCredentials(message.credentials, message.isNewAccount, sender.tab);
  }

  // Get pending credentials (called from popup)
  if (message.action === 'getPendingCredentials') {
    sendResponse({ credentials: pendingCredentials });
    return true;
  }

  // Clear pending credentials
  if (message.action === 'clearPendingCredentials') {
    pendingCredentials = null;
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
    return true;
  }

  // Save credentials to Mason
  if (message.action === 'saveCredentials') {
    saveCredentialsToMason(message.credentials).then(result => {
      sendResponse(result);
    });
    return true;
  }
});

// Handle captured credentials
async function handleCapturedCredentials(credentials, isNewAccount, tab) {
  try {
    // Check if Mason is connected and unlocked
    const response = await fetch(`${API_URL}/status`);
    const data = await response.json();

    if (data.status !== 'running' || !data.unlocked) {
      return; // Don't show prompt if Mason is not ready
    }

    // Check if we already have this credential saved
    const existing = await checkExistingCredential(credentials.hostname, credentials.username);

    if (existing && !isNewAccount) {
      // Existing login - check if password changed
      if (existing.needsUpdate) {
        pendingCredentials = {
          ...credentials,
          existingId: existing.id,
          action: 'update'
        };
        showSavePrompt(tab, 'Passwort aktualisieren?');
      }
      // Same password - don't prompt
    } else {
      // New credential
      pendingCredentials = {
        ...credentials,
        action: 'new'
      };
      showSavePrompt(tab, 'Login speichern?');
    }
  } catch (e) {
    console.error('Error handling credentials:', e);
  }
}

// Check if credential exists
async function checkExistingCredential(hostname, username) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'searchByUrl', url: `https://${hostname}` })
    });

    if (response.ok) {
      const matches = await response.json();
      const existing = matches.find(m =>
        m.username.toLowerCase() === username.toLowerCase()
      );

      if (existing) {
        return { id: existing.id, needsUpdate: true }; // We'll check password difference in popup
      }
    }
  } catch (e) {
    console.error('Error checking existing credential:', e);
  }

  return null;
}

// Show save prompt badge
function showSavePrompt(tab, message) {
  chrome.action.setBadgeText({ text: '+', tabId: tab?.id });
  chrome.action.setBadgeBackgroundColor({ color: '#00ff88', tabId: tab?.id });
  chrome.action.setTitle({ title: message, tabId: tab?.id });
}

// Save credentials to Mason
async function saveCredentialsToMason(credentials) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addPassword',
        data: {
          title: credentials.title || credentials.hostname,
          username: credentials.username,
          password: credentials.password,
          url: credentials.url
        }
      })
    });

    if (response.ok) {
      pendingCredentials = null;
      chrome.action.setBadgeText({ text: '' });
      return { success: true };
    } else {
      return { success: false, error: 'Speichern fehlgeschlagen' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Check connection every minute
setInterval(checkConnection, 60000);

// Initial check
checkConnection();
