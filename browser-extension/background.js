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
});

// Check connection every minute
setInterval(checkConnection, 60000);

// Initial check
checkConnection();
