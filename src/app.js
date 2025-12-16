const { ipcRenderer } = require('electron');

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const masterPasswordInput = document.getElementById('master-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const confirmPasswordGroup = document.getElementById('confirm-password-group');
const loginSubtitle = document.getElementById('login-subtitle');
const loginBtn = document.getElementById('login-btn');

const passwordsList = document.getElementById('passwords-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');

const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form');
const modalTitle = document.getElementById('modal-title');
const editIdInput = document.getElementById('edit-id');

const generatedPasswordInput = document.getElementById('generated-password');
const passwordLengthInput = document.getElementById('password-length');
const lengthValue = document.getElementById('length-value');
const strengthFill = document.getElementById('strength-fill');
const strengthText = document.getElementById('strength-text');

let passwords = [];
let notes = [];
let cards = [];
let isNewUser = false;
let currentTags = [];
let isFavorite = false;
let autoLockTimer = null;
let settings = { theme: 'dark', autoLockTime: 5 };

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkMasterPassword();
  await loadSettings();
  setupEventListeners();
  setupAutoLock();
});

// Check if master password exists
async function checkMasterPassword() {
  const hasPassword = await ipcRenderer.invoke('check-master-password');
  isNewUser = !hasPassword;

  if (isNewUser) {
    loginSubtitle.textContent = 'Erstellen Sie Ihr Master-Passwort';
    confirmPasswordGroup.style.display = 'block';
    loginBtn.innerHTML = '<i class="fas fa-plus-circle"></i><span>Erstellen</span>';
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Window controls
  document.getElementById('minimize-btn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
  });

  document.getElementById('maximize-btn').addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
  });

  document.getElementById('close-btn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
  });

  // Login form
  loginForm.addEventListener('submit', handleLogin);

  // Password visibility toggles
  document.getElementById('toggle-master').addEventListener('click', () => {
    togglePasswordVisibility(masterPasswordInput, document.getElementById('toggle-master'));
  });

  document.getElementById('toggle-confirm').addEventListener('click', () => {
    togglePasswordVisibility(confirmPasswordInput, document.getElementById('toggle-confirm'));
  });

  document.getElementById('toggle-entry-password').addEventListener('click', () => {
    const input = document.getElementById('entry-password');
    togglePasswordVisibility(input, document.getElementById('toggle-entry-password'));
  });

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });

  // Lock vault
  document.getElementById('lock-vault-btn').addEventListener('click', lockVault);

  // Add password button
  document.getElementById('add-password-btn').addEventListener('click', () => {
    openModal();
  });

  // Modal controls
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-modal').addEventListener('click', closeModal);
  document.querySelector('.modal-overlay').addEventListener('click', closeModal);

  // Password form
  passwordForm.addEventListener('submit', handlePasswordSave);

  // Generate password in modal
  document.getElementById('generate-entry-password').addEventListener('click', async () => {
    const password = await generatePassword();
    document.getElementById('entry-password').value = password;
    document.getElementById('entry-password').type = 'text';
    document.getElementById('toggle-entry-password').querySelector('i').className = 'fas fa-eye-slash';
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    filterPasswords(e.target.value);
  });

  // Generator controls
  passwordLengthInput.addEventListener('input', (e) => {
    lengthValue.textContent = e.target.value;
  });

  document.getElementById('generate-btn').addEventListener('click', async () => {
    const password = await generatePassword();
    generatedPasswordInput.value = password;
    updateStrengthIndicator(password);
  });

  document.getElementById('regenerate').addEventListener('click', async () => {
    const password = await generatePassword();
    generatedPasswordInput.value = password;
    updateStrengthIndicator(password);
  });

  document.getElementById('copy-generated').addEventListener('click', () => {
    if (generatedPasswordInput.value) {
      copyToClipboard(generatedPasswordInput.value);
    }
  });

  // Initial password generation
  setTimeout(async () => {
    const password = await generatePassword();
    generatedPasswordInput.value = password;
    updateStrengthIndicator(password);
  }, 500);

  // Import/Export buttons
  document.getElementById('import-browser-btn').addEventListener('click', importFromBrowser);
  document.getElementById('import-data').addEventListener('click', importFromBrowser);
  document.getElementById('export-data').addEventListener('click', exportPasswords);

  // Browser extension install buttons
  document.getElementById('install-chrome').addEventListener('click', (e) => {
    e.preventDefault();
    showExtensionInstallModal('chrome');
  });
  document.getElementById('install-firefox').addEventListener('click', (e) => {
    e.preventDefault();
    showExtensionInstallModal('firefox');
  });
  document.getElementById('install-opera').addEventListener('click', (e) => {
    e.preventDefault();
    showExtensionInstallModal('opera');
  });

  // Security check buttons
  document.getElementById('run-security-check').addEventListener('click', runSecurityCheck);
  document.getElementById('check-breach-btn').addEventListener('click', () => {
    const email = document.getElementById('breach-email').value.trim();
    if (email) {
      checkEmailBreach(email);
    } else {
      showToast('Bitte E-Mail-Adresse eingeben', 'error');
    }
  });

  // Filter dropdown
  document.getElementById('filter-btn').addEventListener('click', () => {
    document.getElementById('filter-menu').classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown')) {
      document.getElementById('filter-menu').classList.remove('active');
    }
  });

  document.getElementById('filter-category').addEventListener('change', applyFilters);
  document.getElementById('filter-favorites').addEventListener('change', applyFilters);
  document.getElementById('filter-expiring').addEventListener('change', applyFilters);

  // Favorite button in modal
  document.getElementById('entry-favorite').addEventListener('click', () => {
    isFavorite = !isFavorite;
    const btn = document.getElementById('entry-favorite');
    btn.classList.toggle('active', isFavorite);
    btn.querySelector('i').className = isFavorite ? 'fas fa-star' : 'far fa-star';
  });

  // Tags input
  document.getElementById('entry-tags-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target;
      const tag = input.value.trim();
      if (tag && !currentTags.includes(tag)) {
        currentTags.push(tag);
        renderTags();
      }
      input.value = '';
    }
  });

  // Notes view
  document.getElementById('add-note-btn').addEventListener('click', () => openNoteModal());
  document.getElementById('note-modal-close').addEventListener('click', closeNoteModal);
  document.getElementById('cancel-note-modal').addEventListener('click', closeNoteModal);
  document.getElementById('note-form').addEventListener('submit', handleNoteSave);
  document.getElementById('search-notes').addEventListener('input', (e) => filterNotes(e.target.value));

  // Cards view
  document.getElementById('add-card-btn').addEventListener('click', () => openCardModal());
  document.getElementById('card-modal-close').addEventListener('click', closeCardModal);
  document.getElementById('cancel-card-modal').addEventListener('click', closeCardModal);
  document.getElementById('card-form').addEventListener('submit', handleCardSave);

  // Card number formatting
  document.getElementById('card-number').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
    value = value.match(/.{1,4}/g)?.join(' ') || value;
    e.target.value = value;
  });

  // Card expiry formatting
  document.getElementById('card-expiry').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    e.target.value = value;
  });

  // QR Code button
  document.getElementById('show-qr-btn').addEventListener('click', showQRCode);
  document.getElementById('qr-modal-close').addEventListener('click', () => {
    document.getElementById('qr-modal').classList.remove('active');
  });

  // History button
  document.getElementById('show-history-btn').addEventListener('click', showPasswordHistory);
  document.getElementById('history-modal-close').addEventListener('click', () => {
    document.getElementById('history-modal').classList.remove('active');
  });

  // Theme toggle
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      setTheme(theme);
    });
  });

  // Auto-lock setting
  document.getElementById('auto-lock-time').addEventListener('change', (e) => {
    settings.autoLockTime = parseInt(e.target.value);
    saveSettings();
    setupAutoLock();
  });

  // Autostart toggle
  document.getElementById('autostart-toggle').addEventListener('change', async (e) => {
    settings.autostart = e.target.checked;
    await ipcRenderer.invoke('set-autostart', e.target.checked);
    saveSettings();
    showToast(e.target.checked ? 'Autostart aktiviert' : 'Autostart deaktiviert');
  });

  // Minimize to tray toggle
  document.getElementById('minimize-to-tray-toggle').addEventListener('change', (e) => {
    settings.minimizeToTray = e.target.checked;
    saveSettings();
  });

  // Modal overlays for new modals
  document.querySelectorAll('#note-modal .modal-overlay, #card-modal .modal-overlay, #qr-modal .modal-overlay, #history-modal .modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      overlay.closest('.modal').classList.remove('active');
    });
  });
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const password = masterPasswordInput.value;

  if (isNewUser) {
    const confirm = confirmPasswordInput.value;
    if (password !== confirm) {
      showToast('Passwörter stimmen nicht überein', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('Passwort muss mindestens 8 Zeichen haben', 'error');
      return;
    }

    await ipcRenderer.invoke('set-master-password', password);
    showToast('Tresor erstellt!', 'success');
  } else {
    const valid = await ipcRenderer.invoke('verify-master-password', password);
    if (!valid) {
      showToast('Falsches Passwort', 'error');
      masterPasswordInput.value = '';
      masterPasswordInput.focus();
      return;
    }
  }

  loginScreen.style.display = 'none';
  mainApp.style.display = 'flex';
  await loadPasswords();
  await loadNotes();
  await loadCards();
}

// Load passwords
async function loadPasswords() {
  passwords = await ipcRenderer.invoke('get-passwords');
  renderPasswords();
}

// Render passwords list
function renderPasswords(filtered = null) {
  const items = filtered || passwords;
  passwordsList.innerHTML = '';

  if (items.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // Sort: favorites first
  const sorted = [...items].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return 0;
  });

  sorted.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'password-card';

    // Extract domain from URL for display
    let websiteDisplay = '';
    if (entry.url) {
      try {
        const url = new URL(entry.url);
        websiteDisplay = url.hostname;
      } catch {
        websiteDisplay = entry.url;
      }
    }

    // Check expiry status
    let expiryBadge = '';
    if (entry.expiryDate) {
      const now = new Date();
      const expiry = new Date(entry.expiryDate);
      const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        expiryBadge = '<span class="badge badge-expired"><i class="fas fa-exclamation-circle"></i> Abgelaufen</span>';
      } else if (daysUntilExpiry <= 30) {
        expiryBadge = `<span class="badge badge-expiring"><i class="fas fa-clock"></i> ${daysUntilExpiry} Tage</span>`;
      }
    }

    // Build badges
    let badges = '';
    if (entry.category || expiryBadge || (entry.tags && entry.tags.length > 0)) {
      badges = '<div class="password-card-badges">';
      if (entry.category) {
        badges += `<span class="badge badge-category">${escapeHtml(entry.category)}</span>`;
      }
      if (expiryBadge) {
        badges += expiryBadge;
      }
      badges += '</div>';
    }

    card.innerHTML = `
      <div class="password-icon">
        <i class="fas fa-key"></i>
      </div>
      <div class="password-info">
        <div class="password-title">
          ${escapeHtml(entry.title)}
          ${entry.favorite ? '<i class="fas fa-star favorite-indicator"></i>' : ''}
        </div>
        <div class="password-meta">
          <span class="password-username"><i class="fas fa-user"></i> ${escapeHtml(entry.username)}</span>
          ${websiteDisplay ? `<span class="password-url"><i class="fas fa-globe"></i> ${escapeHtml(websiteDisplay)}</span>` : ''}
        </div>
        ${badges}
      </div>
      <div class="password-actions">
        ${entry.url ? `<button class="icon-btn open-url" title="Webseite öffnen">
          <i class="fas fa-external-link-alt"></i>
        </button>` : ''}
        <button class="icon-btn copy-user" title="Benutzer kopieren">
          <i class="fas fa-user"></i>
        </button>
        <button class="icon-btn copy-pass" title="Passwort kopieren">
          <i class="fas fa-copy"></i>
        </button>
        <button class="icon-btn edit-entry" title="Bearbeiten">
          <i class="fas fa-edit"></i>
        </button>
        <button class="icon-btn delete-entry" title="Löschen">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Event listeners for card actions
    const openUrlBtn = card.querySelector('.open-url');
    if (openUrlBtn) {
      openUrlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        require('electron').shell.openExternal(entry.url);
      });
    }

    card.querySelector('.copy-user').addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(entry.username);
      showToast('Benutzername kopiert');
    });

    card.querySelector('.copy-pass').addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(entry.password);
      showToast('Passwort kopiert (wird in 30s gelöscht)');
    });

    card.querySelector('.edit-entry').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(entry);
    });

    card.querySelector('.delete-entry').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Möchten Sie diesen Eintrag wirklich löschen?')) {
        await ipcRenderer.invoke('delete-password', entry.id);
        await loadPasswords();
        showToast('Eintrag gelöscht');
      }
    });

    // Click on card to view details
    card.addEventListener('click', () => {
      openModal(entry);
    });

    passwordsList.appendChild(card);
  });
}

// Filter passwords
function filterPasswords(query) {
  if (!query) {
    renderPasswords();
    return;
  }

  const filtered = passwords.filter(p =>
    p.title.toLowerCase().includes(query.toLowerCase()) ||
    p.username.toLowerCase().includes(query.toLowerCase()) ||
    (p.url && p.url.toLowerCase().includes(query.toLowerCase()))
  );

  renderPasswords(filtered);
}

// Switch view
function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  document.querySelectorAll('.view').forEach(v => {
    v.style.display = 'none';
  });

  document.getElementById(`${view}-view`).style.display = 'block';
}

// Open modal
function openModal(entry = null) {
  passwordModal.classList.add('active');

  if (entry) {
    modalTitle.textContent = 'Passwort bearbeiten';
    editIdInput.value = entry.id;
    document.getElementById('entry-title').value = entry.title;
    document.getElementById('entry-username').value = entry.username;
    document.getElementById('entry-password').value = entry.password;
    document.getElementById('entry-url').value = entry.url || '';
    document.getElementById('entry-notes').value = entry.notes || '';
    document.getElementById('entry-category').value = entry.category || '';
    document.getElementById('entry-expiry').value = entry.expiryDate || '';

    // Set favorite
    isFavorite = entry.favorite || false;
    const favBtn = document.getElementById('entry-favorite');
    favBtn.classList.toggle('active', isFavorite);
    favBtn.querySelector('i').className = isFavorite ? 'fas fa-star' : 'far fa-star';

    // Set tags
    currentTags = entry.tags || [];
    renderTags();

    // Show history button if editing
    document.getElementById('show-history-btn').style.display = 'inline-flex';
  } else {
    modalTitle.textContent = 'Neues Passwort';
    editIdInput.value = '';
    passwordForm.reset();

    // Reset favorite
    isFavorite = false;
    const favBtn = document.getElementById('entry-favorite');
    favBtn.classList.remove('active');
    favBtn.querySelector('i').className = 'far fa-star';

    // Reset tags
    currentTags = [];
    renderTags();

    // Hide history button for new entries
    document.getElementById('show-history-btn').style.display = 'none';
  }
}

// Close modal
function closeModal() {
  passwordModal.classList.remove('active');
  passwordForm.reset();
  editIdInput.value = '';
}

// Handle password save
async function handlePasswordSave(e) {
  e.preventDefault();

  const data = {
    title: document.getElementById('entry-title').value,
    username: document.getElementById('entry-username').value,
    password: document.getElementById('entry-password').value,
    url: document.getElementById('entry-url').value,
    notes: document.getElementById('entry-notes').value,
    category: document.getElementById('entry-category').value,
    tags: currentTags,
    favorite: isFavorite,
    expiryDate: document.getElementById('entry-expiry').value || null
  };

  const editId = editIdInput.value;

  if (editId) {
    await ipcRenderer.invoke('update-password', editId, data);
    showToast('Passwort aktualisiert');
  } else {
    await ipcRenderer.invoke('add-password', data);
    showToast('Passwort gespeichert');
  }

  closeModal();
  await loadPasswords();
}

// Lock vault
async function lockVault() {
  await ipcRenderer.invoke('lock-vault');
  mainApp.style.display = 'none';
  loginScreen.style.display = 'flex';
  masterPasswordInput.value = '';
  isNewUser = false;
  loginSubtitle.textContent = 'Entsperren Sie Ihren Tresor';
  confirmPasswordGroup.style.display = 'none';
  loginBtn.innerHTML = '<i class="fas fa-unlock-alt"></i><span>Entsperren</span>';
}

// Generate password
async function generatePassword() {
  const options = {
    length: parseInt(passwordLengthInput.value),
    uppercase: document.getElementById('opt-uppercase').checked,
    lowercase: document.getElementById('opt-lowercase').checked,
    numbers: document.getElementById('opt-numbers').checked,
    symbols: document.getElementById('opt-symbols').checked
  };

  return await ipcRenderer.invoke('generate-password', options);
}

// Update strength indicator
function updateStrengthIndicator(password) {
  let strength = 0;
  let label = '';
  let color = '';

  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  if (password.length >= 16) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;

  if (strength <= 2) {
    label = 'Schwach';
    color = '#ff4757';
  } else if (strength <= 4) {
    label = 'Mittel';
    color = '#ffa502';
  } else if (strength <= 5) {
    label = 'Stark';
    color = '#2ed573';
  } else {
    label = 'Sehr stark';
    color = '#00ff88';
  }

  const percentage = (strength / 7) * 100;
  strengthFill.style.width = percentage + '%';
  strengthFill.style.background = color;
  strengthText.textContent = label;
  strengthText.style.color = color;
}

// Copy to clipboard
async function copyToClipboard(text) {
  await ipcRenderer.invoke('copy-to-clipboard', text);
}

// Toggle password visibility
function togglePasswordVisibility(input, button) {
  const icon = button.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show toast notification
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
    <span>${message}</span>
  `;

  if (type === 'error') {
    toast.style.borderColor = '#ff4757';
    toast.querySelector('i').style.color = '#ff4757';
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Import from browser CSV/JSON
async function importFromBrowser() {
  const result = await ipcRenderer.invoke('import-from-file');

  if (result.success) {
    showToast(`${result.count} Passwörter importiert!`);
    await loadPasswords();
  } else if (result.error !== 'Abgebrochen') {
    showToast(`Fehler: ${result.error}`, 'error');
  }
}

// Export passwords
async function exportPasswords() {
  const result = await ipcRenderer.invoke('export-passwords');

  if (result.success) {
    showToast(`${result.count} Passwörter exportiert!`);
  } else if (result.error !== 'Abgebrochen') {
    showToast(`Fehler: ${result.error}`, 'error');
  }
}

// Show extension install modal
function showExtensionInstallModal(browser) {
  const browserNames = {
    chrome: 'Chrome / Edge',
    firefox: 'Firefox',
    opera: 'Opera GX'
  };

  const browserUrls = {
    chrome: 'chrome://extensions',
    firefox: 'about:debugging#/runtime/this-firefox',
    opera: 'opera://extensions'
  };

  const steps = {
    chrome: [
      `1. Öffne <strong>${browserUrls.chrome}</strong> im Browser`,
      '2. Aktiviere den <strong>"Entwicklermodus"</strong> (oben rechts)',
      '3. Klicke auf <strong>"Entpackte Erweiterung laden"</strong>',
      '4. Wähle den <strong>browser-extension</strong> Ordner aus dem Mason-Verzeichnis'
    ],
    firefox: [
      `1. Öffne <strong>${browserUrls.firefox}</strong> im Browser`,
      '2. Klicke auf <strong>"Temporäres Add-on laden"</strong>',
      '3. Navigiere zum <strong>browser-extension</strong> Ordner',
      '4. Wähle die <strong>manifest.json</strong> Datei aus'
    ],
    opera: [
      `1. Öffne <strong>${browserUrls.opera}</strong> im Browser`,
      '2. Aktiviere den <strong>"Entwicklermodus"</strong> (oben rechts)',
      '3. Klicke auf <strong>"Entpackte Erweiterung laden"</strong>',
      '4. Wähle den <strong>browser-extension</strong> Ordner aus dem Mason-Verzeichnis'
    ]
  };

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'extension-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2><i class="fas fa-puzzle-piece"></i> ${browserNames[browser]} Extension</h2>
        <button class="modal-close" id="ext-modal-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="extension-install-content">
        <div class="install-steps">
          ${steps[browser].map(step => `<p class="install-step">${step}</p>`).join('')}
        </div>

        <div class="extension-path">
          <label>Extension-Ordner Pfad:</label>
          <div class="path-box">
            <code id="ext-path">browser-extension</code>
            <button class="icon-btn" id="copy-ext-path" title="Pfad kopieren">
              <i class="fas fa-copy"></i>
            </button>
            <button class="icon-btn" id="open-ext-folder" title="Ordner öffnen">
              <i class="fas fa-folder-open"></i>
            </button>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-outline" id="close-ext-modal">Schließen</button>
          <button class="btn btn-primary" id="open-browser-url">
            <i class="fas fa-external-link-alt"></i>
            URL kopieren
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  const closeModal = () => modal.remove();

  modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
  modal.querySelector('#ext-modal-close').addEventListener('click', closeModal);
  modal.querySelector('#close-ext-modal').addEventListener('click', closeModal);

  modal.querySelector('#copy-ext-path').addEventListener('click', async () => {
    await ipcRenderer.invoke('copy-to-clipboard', 'browser-extension');
    showToast('Pfad kopiert!');
  });

  modal.querySelector('#open-ext-folder').addEventListener('click', async () => {
    await ipcRenderer.invoke('open-extension-folder');
  });

  modal.querySelector('#open-browser-url').addEventListener('click', async () => {
    await ipcRenderer.invoke('copy-to-clipboard', browserUrls[browser]);
    showToast(`${browserUrls[browser]} kopiert! Füge es in deinen Browser ein.`);
  });
}

// ============================================
// SECURITY CHECK FUNCTIONS
// ============================================

// Run security analysis
async function runSecurityCheck() {
  const btn = document.getElementById('run-security-check');
  btn.innerHTML = '<span class="loading-spinner"></span> Analysiere...';
  btn.disabled = true;

  const results = {
    weak: [],
    reused: [],
    leaked: [],
    strong: []
  };

  // Analyze each password
  const passwordCounts = {};

  for (const entry of passwords) {
    const strength = analyzePasswordStrength(entry.password);

    // Check for reused passwords
    if (passwordCounts[entry.password]) {
      passwordCounts[entry.password].push(entry);
    } else {
      passwordCounts[entry.password] = [entry];
    }

    if (strength.score <= 2) {
      results.weak.push({ entry, reason: strength.reason });
    } else if (strength.score >= 5) {
      results.strong.push(entry);
    }
  }

  // Find reused passwords
  for (const [pwd, entries] of Object.entries(passwordCounts)) {
    if (entries.length > 1) {
      for (const entry of entries) {
        if (!results.reused.find(r => r.entry.id === entry.id)) {
          results.reused.push({ entry, count: entries.length });
        }
      }
    }
  }

  // Check for leaked passwords (using k-anonymity with HIBP API)
  for (const entry of passwords) {
    const isLeaked = await checkPasswordLeaked(entry.password);
    if (isLeaked) {
      results.leaked.push({ entry, count: isLeaked });
    }
  }

  // Update UI
  updateSecurityUI(results);

  btn.innerHTML = '<i class="fas fa-search"></i><span>Analyse starten</span>';
  btn.disabled = false;
}

// Analyze password strength
function analyzePasswordStrength(password) {
  let score = 0;
  let reasons = [];

  if (!password) return { score: 0, reason: 'Kein Passwort' };

  if (password.length >= 8) score += 1;
  else reasons.push('zu kurz');

  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  if (/[a-z]/.test(password)) score += 1;
  else reasons.push('keine Kleinbuchstaben');

  if (/[A-Z]/.test(password)) score += 1;
  else reasons.push('keine Großbuchstaben');

  if (/[0-9]/.test(password)) score += 1;
  else reasons.push('keine Zahlen');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else reasons.push('keine Sonderzeichen');

  // Check for common patterns
  if (/^[a-z]+$|^[A-Z]+$|^[0-9]+$/i.test(password)) {
    score -= 2;
    reasons.push('nur ein Zeichentyp');
  }

  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    reasons.push('wiederholte Zeichen');
  }

  // Common passwords check
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password1', 'admin', 'letmein', 'welcome'];
  if (commonPasswords.includes(password.toLowerCase())) {
    score = 0;
    reasons = ['sehr häufiges Passwort'];
  }

  return {
    score: Math.max(0, Math.min(7, score)),
    reason: reasons.length > 0 ? reasons.join(', ') : 'Stark'
  };
}

// Check if password has been leaked using HIBP k-anonymity API
async function checkPasswordLeaked(password) {
  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) return false;

    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return parseInt(count.trim());
      }
    }

    return false;
  } catch (e) {
    console.error('HIBP check failed:', e);
    return false;
  }
}

// Update security UI with results
function updateSecurityUI(results) {
  const totalPasswords = passwords.length;
  const issuesCount = results.weak.length + results.reused.length + results.leaked.length;

  // Calculate score (100 - penalties)
  let score = 100;
  score -= results.weak.length * 15;
  score -= results.reused.length * 10;
  score -= results.leaked.length * 25;
  score = Math.max(0, Math.min(100, score));

  // Update score circle
  const scoreValue = document.getElementById('security-score');
  const scoreFill = document.getElementById('score-circle-fill');
  const scoreStatus = document.getElementById('security-status');
  const scoreSummary = document.getElementById('security-summary');

  scoreValue.textContent = score;

  // Animate score circle (283 is the circumference)
  const offset = 283 - (283 * score / 100);
  scoreFill.style.strokeDashoffset = offset;

  // Set color based on score
  scoreFill.classList.remove('warning', 'danger');
  if (score < 50) {
    scoreFill.classList.add('danger');
    scoreValue.style.color = '#ff4757';
  } else if (score < 80) {
    scoreFill.classList.add('warning');
    scoreValue.style.color = '#ffa502';
  } else {
    scoreValue.style.color = '#00ff88';
  }

  // Update status text
  if (score >= 80) {
    scoreStatus.textContent = 'Ausgezeichnet!';
    scoreSummary.textContent = 'Deine Passwörter sind gut geschützt.';
  } else if (score >= 50) {
    scoreStatus.textContent = 'Verbesserungsbedarf';
    scoreSummary.textContent = `${issuesCount} Problem${issuesCount !== 1 ? 'e' : ''} gefunden. Überprüfe die Details unten.`;
  } else {
    scoreStatus.textContent = 'Kritisch!';
    scoreSummary.textContent = `${issuesCount} Problem${issuesCount !== 1 ? 'e' : ''} gefunden. Dringend handeln!`;
  }

  // Update stats
  document.getElementById('weak-count').textContent = results.weak.length;
  document.getElementById('reused-count').textContent = results.reused.length;
  document.getElementById('leaked-count').textContent = results.leaked.length;
  document.getElementById('strong-count').textContent = results.strong.length;

  // Update issues list
  const issuesList = document.getElementById('issues-list');

  if (issuesCount === 0) {
    issuesList.innerHTML = `
      <div class="no-issues" style="color: var(--accent);">
        <i class="fas fa-check-circle" style="color: var(--accent);"></i>
        <p>Keine Probleme gefunden! Alle Passwörter sind sicher.</p>
      </div>
    `;
  } else {
    issuesList.innerHTML = '';

    // Leaked passwords (highest priority)
    for (const { entry, count } of results.leaked) {
      issuesList.innerHTML += createIssueItem(entry, 'leaked', `In ${count.toLocaleString()} Datenlecks gefunden!`);
    }

    // Weak passwords
    for (const { entry, reason } of results.weak) {
      if (!results.leaked.find(l => l.entry.id === entry.id)) {
        issuesList.innerHTML += createIssueItem(entry, 'weak', `Schwaches Passwort: ${reason}`);
      }
    }

    // Reused passwords
    for (const { entry, count } of results.reused) {
      if (!results.leaked.find(l => l.entry.id === entry.id) && !results.weak.find(w => w.entry.id === entry.id)) {
        issuesList.innerHTML += createIssueItem(entry, 'reused', `Wird bei ${count} Einträgen verwendet`);
      }
    }
  }

  // Add click handlers for edit buttons
  document.querySelectorAll('.issue-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const entry = passwords.find(p => p.id === id);
      if (entry) {
        switchView('passwords');
        setTimeout(() => openModal(entry), 100);
      }
    });
  });
}

// Create issue item HTML
function createIssueItem(entry, type, description) {
  const icons = {
    weak: 'fa-exclamation-triangle',
    reused: 'fa-copy',
    leaked: 'fa-unlock-alt'
  };

  return `
    <div class="issue-item">
      <div class="issue-icon ${type}">
        <i class="fas ${icons[type]}"></i>
      </div>
      <div class="issue-info">
        <div class="issue-title">${escapeHtml(entry.title)}</div>
        <div class="issue-desc">${description}</div>
      </div>
      <div class="issue-action">
        <button class="btn btn-outline issue-edit-btn" data-id="${entry.id}">
          <i class="fas fa-edit"></i> Ändern
        </button>
      </div>
    </div>
  `;
}

// Check email for breaches using HIBP website
async function checkEmailBreach(email) {
  const resultsDiv = document.getElementById('breach-results');

  // Since HIBP API requires a paid API key for email breach checks,
  // we'll open the website directly for the user to check manually.
  // This provides a better UX than showing an error message.

  const hibpUrl = `https://haveibeenpwned.com/account/${encodeURIComponent(email)}`;

  resultsDiv.innerHTML = `
    <div class="breach-result-item" style="flex-direction: column; align-items: flex-start; gap: 15px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <i class="fas fa-external-link-alt" style="color: var(--accent); font-size: 24px;"></i>
        <div class="breach-info">
          <div class="breach-name">E-Mail-Prüfung bei Have I Been Pwned</div>
          <div class="breach-date">Die E-Mail-Prüfung wird direkt auf haveibeenpwned.com durchgeführt.</div>
        </div>
      </div>
      <div style="display: flex; gap: 10px; width: 100%;">
        <button class="btn btn-primary" id="open-hibp-btn" style="flex: 1;">
          <i class="fas fa-external-link-alt"></i>
          <span>Jetzt prüfen auf HIBP</span>
        </button>
      </div>
      <div class="breach-info-note" style="color: var(--text-muted); font-size: 12px; margin-top: 5px;">
        <i class="fas fa-info-circle"></i>
        Have I Been Pwned ist ein kostenloser Dienst von Sicherheitsforscher Troy Hunt.
        Die Prüfung erfolgt sicher und deine E-Mail wird nicht gespeichert.
      </div>
    </div>
  `;

  // Add click handler for the button
  document.getElementById('open-hibp-btn').addEventListener('click', () => {
    require('electron').shell.openExternal(hibpUrl);
    showToast('HIBP-Website geöffnet');
  });
}

// ============================================
// SETTINGS & THEME
// ============================================

async function loadSettings() {
  settings = await ipcRenderer.invoke('get-settings');
  applySettings();
}

function applySettings() {
  // Apply theme
  if (settings.theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }

  // Update UI
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === settings.theme);
  });

  document.getElementById('auto-lock-time').value = settings.autoLockTime;

  // Autostart toggle
  document.getElementById('autostart-toggle').checked = settings.autostart || false;

  // Minimize to tray toggle
  document.getElementById('minimize-to-tray-toggle').checked = settings.minimizeToTray !== false;
}

async function saveSettings() {
  await ipcRenderer.invoke('save-settings', settings);
}

function setTheme(theme) {
  settings.theme = theme;
  applySettings();
  saveSettings();
}

// ============================================
// AUTO-LOCK
// ============================================

function setupAutoLock() {
  // Clear existing timer
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }

  if (settings.autoLockTime <= 0) return;

  // Reset timer on user activity
  const resetTimer = () => {
    if (autoLockTimer) clearTimeout(autoLockTimer);
    if (settings.autoLockTime > 0 && mainApp.style.display !== 'none') {
      autoLockTimer = setTimeout(() => {
        lockVault();
        showToast('Tresor automatisch gesperrt', 'info');
      }, settings.autoLockTime * 60 * 1000);
    }
  };

  document.addEventListener('mousemove', resetTimer);
  document.addEventListener('keypress', resetTimer);
  document.addEventListener('click', resetTimer);

  resetTimer();
}

// ============================================
// FILTERS
// ============================================

function applyFilters() {
  const category = document.getElementById('filter-category').value;
  const onlyFavorites = document.getElementById('filter-favorites').checked;
  const onlyExpiring = document.getElementById('filter-expiring').checked;

  let filtered = passwords;

  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }

  if (onlyFavorites) {
    filtered = filtered.filter(p => p.favorite);
  }

  if (onlyExpiring) {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(p => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      return expiry <= thirtyDays;
    });
  }

  renderPasswords(filtered);
}

// ============================================
// TAGS
// ============================================

function renderTags() {
  const container = document.getElementById('entry-tags-list');
  container.innerHTML = currentTags.map(tag => `
    <span class="tag">
      ${escapeHtml(tag)}
      <span class="tag-remove" data-tag="${escapeHtml(tag)}">&times;</span>
    </span>
  `).join('');

  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTags = currentTags.filter(t => t !== btn.dataset.tag);
      renderTags();
    });
  });
}

// ============================================
// NOTES
// ============================================

async function loadNotes() {
  notes = await ipcRenderer.invoke('get-notes');
  renderNotes();
}

function renderNotes(filtered = null) {
  const items = filtered || notes;
  const notesList = document.getElementById('notes-list');
  const emptyState = document.getElementById('empty-notes');

  notesList.innerHTML = '';

  if (items.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  items.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-card-header">
        <div class="note-card-title">${escapeHtml(note.title)}</div>
        <div class="note-card-date">${new Date(note.updatedAt).toLocaleDateString('de-DE')}</div>
      </div>
      <div class="note-card-preview">${escapeHtml(note.content).substring(0, 150)}...</div>
      <div class="note-card-actions">
        <button class="icon-btn edit-note" title="Bearbeiten">
          <i class="fas fa-edit"></i>
        </button>
        <button class="icon-btn delete-note" title="Löschen">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    card.querySelector('.edit-note').addEventListener('click', (e) => {
      e.stopPropagation();
      openNoteModal(note);
    });

    card.querySelector('.delete-note').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Notiz wirklich löschen?')) {
        await ipcRenderer.invoke('delete-note', note.id);
        await loadNotes();
        showToast('Notiz gelöscht');
      }
    });

    card.addEventListener('click', () => openNoteModal(note));

    notesList.appendChild(card);
  });
}

function filterNotes(query) {
  if (!query) {
    renderNotes();
    return;
  }
  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(query.toLowerCase()) ||
    n.content.toLowerCase().includes(query.toLowerCase())
  );
  renderNotes(filtered);
}

function openNoteModal(note = null) {
  const modal = document.getElementById('note-modal');
  const title = document.getElementById('note-modal-title');
  const form = document.getElementById('note-form');

  modal.classList.add('active');

  if (note) {
    title.textContent = 'Notiz bearbeiten';
    document.getElementById('note-edit-id').value = note.id;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
  } else {
    title.textContent = 'Neue Notiz';
    document.getElementById('note-edit-id').value = '';
    form.reset();
  }
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.remove('active');
  document.getElementById('note-form').reset();
}

async function handleNoteSave(e) {
  e.preventDefault();

  const data = {
    title: document.getElementById('note-title').value,
    content: document.getElementById('note-content').value
  };

  const editId = document.getElementById('note-edit-id').value;

  if (editId) {
    await ipcRenderer.invoke('update-note', editId, data);
    showToast('Notiz aktualisiert');
  } else {
    await ipcRenderer.invoke('add-note', data);
    showToast('Notiz gespeichert');
  }

  closeNoteModal();
  await loadNotes();
}

// ============================================
// CREDIT CARDS
// ============================================

async function loadCards() {
  cards = await ipcRenderer.invoke('get-cards');
  renderCards();
}

function renderCards() {
  const cardsList = document.getElementById('cards-list');
  const emptyState = document.getElementById('empty-cards');

  cardsList.innerHTML = '';

  if (cards.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  cards.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = `credit-card ${card.type}`;

    const maskedNumber = card.number.replace(/\d(?=\d{4})/g, '*');
    const typeIcons = {
      visa: 'fab fa-cc-visa',
      mastercard: 'fab fa-cc-mastercard',
      amex: 'fab fa-cc-amex',
      other: 'fas fa-credit-card'
    };

    cardEl.innerHTML = `
      <div class="card-type-logo"><i class="${typeIcons[card.type] || typeIcons.other}"></i></div>
      <div class="card-chip"></div>
      <div class="card-number">${maskedNumber}</div>
      <div class="card-details">
        <div class="card-holder">
          <div class="card-holder-label">Karteninhaber</div>
          <div class="card-holder-name">${escapeHtml(card.holder)}</div>
        </div>
        <div class="card-expiry">
          <div class="card-expiry-label">Gültig bis</div>
          <div class="card-expiry-date">${escapeHtml(card.expiry)}</div>
        </div>
      </div>
      <div class="card-actions">
        <button class="icon-btn copy-card-number" title="Kartennummer kopieren">
          <i class="fas fa-copy"></i>
        </button>
        <button class="icon-btn copy-card-cvv" title="CVV kopieren">
          <i class="fas fa-key"></i>
        </button>
        <button class="icon-btn edit-card" title="Bearbeiten">
          <i class="fas fa-edit"></i>
        </button>
        <button class="icon-btn delete-card" title="Löschen">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    cardEl.querySelector('.copy-card-number').addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(card.number.replace(/\s/g, ''));
      showToast('Kartennummer kopiert');
    });

    cardEl.querySelector('.copy-card-cvv').addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(card.cvv);
      showToast('CVV kopiert (wird in 30s gelöscht)');
    });

    cardEl.querySelector('.edit-card').addEventListener('click', (e) => {
      e.stopPropagation();
      openCardModal(card);
    });

    cardEl.querySelector('.delete-card').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Karte wirklich löschen?')) {
        await ipcRenderer.invoke('delete-card', card.id);
        await loadCards();
        showToast('Karte gelöscht');
      }
    });

    cardsList.appendChild(cardEl);
  });
}

function openCardModal(card = null) {
  const modal = document.getElementById('card-modal');
  const title = document.getElementById('card-modal-title');
  const form = document.getElementById('card-form');

  modal.classList.add('active');

  if (card) {
    title.textContent = 'Karte bearbeiten';
    document.getElementById('card-edit-id').value = card.id;
    document.getElementById('card-name').value = card.name;
    document.getElementById('card-holder').value = card.holder;
    document.getElementById('card-number').value = card.number;
    document.getElementById('card-expiry').value = card.expiry;
    document.getElementById('card-cvv').value = card.cvv;
    document.getElementById('card-type').value = card.type;
  } else {
    title.textContent = 'Neue Karte';
    document.getElementById('card-edit-id').value = '';
    form.reset();
  }
}

function closeCardModal() {
  document.getElementById('card-modal').classList.remove('active');
  document.getElementById('card-form').reset();
}

async function handleCardSave(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById('card-name').value,
    holder: document.getElementById('card-holder').value.toUpperCase(),
    number: document.getElementById('card-number').value,
    expiry: document.getElementById('card-expiry').value,
    cvv: document.getElementById('card-cvv').value,
    type: document.getElementById('card-type').value
  };

  const editId = document.getElementById('card-edit-id').value;

  if (editId) {
    await ipcRenderer.invoke('update-card', editId, data);
    showToast('Karte aktualisiert');
  } else {
    await ipcRenderer.invoke('add-card', data);
    showToast('Karte gespeichert');
  }

  closeCardModal();
  await loadCards();
}

// ============================================
// QR CODE
// ============================================

function showQRCode() {
  const editId = document.getElementById('edit-id').value;
  if (!editId) {
    showToast('Erst Eintrag speichern', 'error');
    return;
  }

  const entry = passwords.find(p => p.id === editId);
  if (!entry) return;

  const modal = document.getElementById('qr-modal');
  const container = document.getElementById('qr-code-container');
  container.innerHTML = '';

  // Create QR data
  const qrData = JSON.stringify({
    title: entry.title,
    username: entry.username,
    password: entry.password,
    url: entry.url
  });

  // Generate QR code
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: qrData,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff'
    });
  } else {
    container.innerHTML = '<p>QR-Code Bibliothek nicht geladen</p>';
  }

  modal.classList.add('active');
}

// ============================================
// PASSWORD HISTORY
// ============================================

async function showPasswordHistory() {
  const editId = document.getElementById('edit-id').value;
  if (!editId) return;

  const history = await ipcRenderer.invoke('get-password-history', editId);
  const modal = document.getElementById('history-modal');
  const list = document.getElementById('history-list');

  if (history.length === 0) {
    list.innerHTML = '<div class="no-issues"><i class="fas fa-history"></i><p>Keine älteren Passwörter gespeichert</p></div>';
  } else {
    list.innerHTML = history.map(h => `
      <div class="history-item">
        <div>
          <div class="history-password">${escapeHtml(h.password)}</div>
          <div class="history-date">${new Date(h.changedAt).toLocaleString('de-DE')}</div>
        </div>
        <button class="icon-btn copy-history" data-password="${escapeHtml(h.password)}" title="Kopieren">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.copy-history').forEach(btn => {
      btn.addEventListener('click', () => {
        copyToClipboard(btn.dataset.password);
        showToast('Altes Passwort kopiert');
      });
    });
  }

  modal.classList.add('active');
}
