// Mason Password Manager - Content Script

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fillCredentials') {
    fillCredentials(message.username, message.password);
    sendResponse({ success: true });
  }
  return true;
});

// Fill credentials in login forms
function fillCredentials(username, password) {
  // Find username/email fields
  const usernameFields = findUsernameFields();
  const passwordFields = findPasswordFields();

  // Fill username
  if (usernameFields.length > 0 && username) {
    fillField(usernameFields[0], username);
  }

  // Fill password
  if (passwordFields.length > 0 && password) {
    fillField(passwordFields[0], password);
  }

  // Show visual feedback
  showFillNotification();
}

// Find username/email input fields
function findUsernameFields() {
  const selectors = [
    'input[type="email"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][name*="email"]',
    'input[type="text"][name*="login"]',
    'input[type="text"][id*="user"]',
    'input[type="text"][id*="email"]',
    'input[type="text"][id*="login"]',
    'input[type="text"][autocomplete="username"]',
    'input[type="text"][autocomplete="email"]',
    'input[name="username"]',
    'input[name="email"]',
    'input[name="login"]',
    'input[id="username"]',
    'input[id="email"]',
    'input[id="login"]'
  ];

  for (const selector of selectors) {
    const fields = document.querySelectorAll(selector);
    const visible = Array.from(fields).filter(isVisible);
    if (visible.length > 0) {
      return visible;
    }
  }

  // Fallback: find any visible text input before a password field
  const passwordField = document.querySelector('input[type="password"]');
  if (passwordField) {
    const form = passwordField.closest('form');
    if (form) {
      const textInputs = form.querySelectorAll('input[type="text"], input[type="email"]');
      return Array.from(textInputs).filter(isVisible);
    }
  }

  return [];
}

// Find password input fields
function findPasswordFields() {
  const fields = document.querySelectorAll('input[type="password"]');
  return Array.from(fields).filter(isVisible);
}

// Check if element is visible
function isVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         element.offsetWidth > 0 &&
         element.offsetHeight > 0;
}

// Fill a field with value
function fillField(field, value) {
  // Focus the field
  field.focus();

  // Clear existing value
  field.value = '';

  // Set new value
  field.value = value;

  // Trigger input events for React/Vue/Angular apps
  const inputEvent = new Event('input', { bubbles: true });
  field.dispatchEvent(inputEvent);

  const changeEvent = new Event('change', { bubbles: true });
  field.dispatchEvent(changeEvent);

  // Also trigger keydown/keyup for some frameworks
  field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  // Highlight the field
  highlightField(field);
}

// Highlight filled field
function highlightField(field) {
  const originalBorder = field.style.border;
  const originalBoxShadow = field.style.boxShadow;

  field.style.border = '2px solid #00ff88';
  field.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.3)';

  setTimeout(() => {
    field.style.border = originalBorder;
    field.style.boxShadow = originalBoxShadow;
  }, 2000);
}

// Show fill notification
function showFillNotification() {
  // Remove existing notification
  const existing = document.getElementById('mason-fill-notification');
  if (existing) existing.remove();

  // Create notification
  const notification = document.createElement('div');
  notification.id = 'mason-fill-notification';
  notification.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>Mason: Anmeldedaten eingefügt</span>
  `;

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #1a1a1a, #0d0d0d);
    border: 1px solid #00ff88;
    border-radius: 8px;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 999999;
    box-shadow: 0 4px 20px rgba(0, 255, 136, 0.2);
    animation: masonSlideIn 0.3s ease;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes masonSlideIn {
      from { opacity: 0; transform: translateX(100px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);

  // Set SVG color
  notification.querySelector('svg').style.color = '#00ff88';

  document.body.appendChild(notification);

  // Remove after delay
  setTimeout(() => {
    notification.style.animation = 'masonSlideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Detect login forms and add Mason button
function detectLoginForms() {
  const passwordFields = findPasswordFields();

  passwordFields.forEach(field => {
    // Check if button already added
    if (field.dataset.masonButton) return;
    field.dataset.masonButton = 'true';

    // Create Mason button
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C9.24 2 7 4.24 7 7v2H6c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v2H9V7c0-1.66 1.34-3 3-3zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
      </svg>
    `;

    button.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 4px;
      background: #00ff88;
      color: #0d0d0d;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: all 0.2s ease;
    `;

    button.title = 'Mit Mason ausfüllen';

    button.addEventListener('mouseenter', () => {
      button.style.background = '#00cc6a';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#00ff88';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Open popup
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });

    // Position button relative to field
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: relative;
      display: inline-block;
      width: 100%;
    `;

    // Handle field positioning
    if (field.parentElement) {
      const parent = field.parentElement;
      const fieldRect = field.getBoundingClientRect();
      const parentStyle = window.getComputedStyle(parent);

      if (parentStyle.position === 'static') {
        parent.style.position = 'relative';
      }

      button.style.position = 'absolute';
      button.style.right = '8px';
      button.style.top = '50%';
      button.style.transform = 'translateY(-50%)';

      parent.appendChild(button);

      // Adjust field padding
      field.style.paddingRight = '44px';
    }
  });
}

// Run detection on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectLoginForms);
} else {
  detectLoginForms();
}

// Watch for dynamic content
const observer = new MutationObserver((mutations) => {
  let shouldCheck = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldCheck = true;
      break;
    }
  }
  if (shouldCheck) {
    setTimeout(detectLoginForms, 100);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// ============================================
// PASSWORD CAPTURE - Detect form submissions
// ============================================

function setupPasswordCapture() {
  // Listen for form submissions
  document.addEventListener('submit', handleFormSubmit, true);

  // Also listen for button clicks that might submit forms
  document.addEventListener('click', (e) => {
    const button = e.target.closest('button[type="submit"], input[type="submit"]');
    if (button) {
      const form = button.closest('form');
      if (form) {
        setTimeout(() => checkForCredentials(form), 100);
      }
    }
  }, true);
}

function handleFormSubmit(e) {
  const form = e.target;
  checkForCredentials(form);
}

function checkForCredentials(form) {
  const passwordField = form.querySelector('input[type="password"]');
  if (!passwordField || !passwordField.value) return;

  // Find username field
  const usernameField = findUsernameField(form);
  if (!usernameField || !usernameField.value) return;

  const credentials = {
    url: window.location.href,
    hostname: window.location.hostname,
    username: usernameField.value,
    password: passwordField.value,
    title: document.title || window.location.hostname
  };

  // Check if this looks like a login (not registration)
  const isRegistration = detectRegistrationForm(form);

  // Send to background script
  chrome.runtime.sendMessage({
    action: 'credentialsCaptured',
    credentials: credentials,
    isNewAccount: isRegistration
  });
}

function findUsernameField(form) {
  // Priority order for finding username
  const selectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[name="login"]',
    'input[name="user"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="text"]'
  ];

  for (const selector of selectors) {
    const field = form.querySelector(selector);
    if (field && field.value && field !== form.querySelector('input[type="password"]')) {
      return field;
    }
  }

  return null;
}

function detectRegistrationForm(form) {
  // Check for multiple password fields (usually means registration)
  const passwordFields = form.querySelectorAll('input[type="password"]');
  if (passwordFields.length > 1) return true;

  // Check for common registration indicators
  const formHtml = form.outerHTML.toLowerCase();
  const registrationKeywords = ['register', 'signup', 'sign up', 'create account', 'registrieren', 'anmelden', 'erstellen'];

  return registrationKeywords.some(keyword => formHtml.includes(keyword));
}

// Initialize password capture
setupPasswordCapture();
