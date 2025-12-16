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
let activityLog = [];
let sharedPasswords = [];
let dashboardSettings = {
  widgets: {
    stats: true,
    security: true,
    favorites: true,
    recent: true,
    expiring: true,
    activity: true
  }
};

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

  // Stats refresh button
  document.getElementById('refresh-stats').addEventListener('click', () => {
    updateStats();
    showToast('Statistiken aktualisiert');
  });

  // Compact view toggle
  initCompactView();

  // Backups
  initBackups();
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

  // Initialize new features
  loadActivityLog();
  loadSharedPasswords();
  initDashboard();
  initActivityLog();
  initShareModal();

  // Log login activity
  logActivity('login', null, 'Tresor', {});
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
      logActivity('copy', entry.id, entry.title, { category: entry.category });
      showToast('Passwort kopiert (wird in 30s gelöscht)');
    });

    card.querySelector('.edit-entry').addEventListener('click', (e) => {
      e.stopPropagation();
      logActivity('view', entry.id, entry.title, { category: entry.category });
      openModal(entry);
    });

    card.querySelector('.delete-entry').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Möchten Sie diesen Eintrag wirklich löschen?')) {
        logActivity('delete', entry.id, entry.title, { category: entry.category });
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

  // Update stats when switching to stats view
  if (view === 'stats') {
    updateStats();
  }
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
    // Show share button if editing
    document.getElementById('show-share-btn').style.display = 'inline-flex';
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
    // Hide share button for new entries
    document.getElementById('show-share-btn').style.display = 'none';
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
    logActivity('edit', editId, data.title, { category: data.category });
    showToast('Passwort aktualisiert');
  } else {
    const newEntry = await ipcRenderer.invoke('add-password', data);
    logActivity('create', newEntry?.id || Date.now().toString(), data.title, { category: data.category });
    showToast('Passwort gespeichert');
  }

  closeModal();
  await loadPasswords();
  updateDashboard();
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

  // Add click handlers for website buttons (to change password on website)
  document.querySelectorAll('.issue-change-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      const id = btn.dataset.id;
      const entry = passwords.find(p => p.id === id);

      if (url) {
        // Open the website in browser
        require('electron').shell.openExternal(url);

        // Copy current password to clipboard so user can verify
        if (entry) {
          await copyToClipboard(entry.password);
          showToast('Webseite geöffnet - aktuelles Passwort in Zwischenablage');
        }
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

  // Generate password change URL based on entry URL
  let changePasswordUrl = '';
  if (entry.url) {
    try {
      const url = new URL(entry.url);
      // Common password change paths
      const commonPaths = [
        '/settings/password',
        '/account/password',
        '/profile/password',
        '/security',
        '/settings/security',
        '/password/change',
        '/account/security',
        '/my-account',
        '/settings'
      ];
      // Try to construct a smart password change URL
      changePasswordUrl = `${url.origin}${commonPaths[0]}`;
    } catch {
      changePasswordUrl = entry.url;
    }
  }

  const websiteBtn = entry.url ? `
    <button class="btn btn-primary issue-change-btn" data-url="${escapeHtml(entry.url)}" data-id="${entry.id}" title="Webseite öffnen um Passwort zu ändern">
      <i class="fas fa-external-link-alt"></i> Webseite
    </button>
  ` : '';

  return `
    <div class="issue-item">
      <div class="issue-icon ${type}">
        <i class="fas ${icons[type]}"></i>
      </div>
      <div class="issue-info">
        <div class="issue-title">${escapeHtml(entry.title)}</div>
        <div class="issue-desc">${description}</div>
        ${entry.url ? `<div class="issue-url">${escapeHtml(new URL(entry.url).hostname)}</div>` : ''}
      </div>
      <div class="issue-actions">
        ${websiteBtn}
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

// ============================================
// STATS DASHBOARD
// ============================================

function updateStats() {
  // Overview stats
  document.getElementById('stats-total').textContent = passwords.length;
  document.getElementById('stats-notes').textContent = notes.length;
  document.getElementById('stats-cards').textContent = cards.length;
  document.getElementById('stats-favorites').textContent = passwords.filter(p => p.favorite).length;

  // Strength distribution
  const strengthCounts = { veryStrong: 0, strong: 0, medium: 0, weak: 0 };

  passwords.forEach(p => {
    const score = analyzePasswordStrength(p.password).score;
    if (score >= 6) strengthCounts.veryStrong++;
    else if (score >= 5) strengthCounts.strong++;
    else if (score >= 3) strengthCounts.medium++;
    else strengthCounts.weak++;
  });

  const maxCount = Math.max(...Object.values(strengthCounts), 1);

  document.getElementById('bar-very-strong').style.width = `${(strengthCounts.veryStrong / maxCount) * 100}%`;
  document.getElementById('bar-strong').style.width = `${(strengthCounts.strong / maxCount) * 100}%`;
  document.getElementById('bar-medium').style.width = `${(strengthCounts.medium / maxCount) * 100}%`;
  document.getElementById('bar-weak').style.width = `${(strengthCounts.weak / maxCount) * 100}%`;

  document.getElementById('count-very-strong').textContent = strengthCounts.veryStrong;
  document.getElementById('count-strong').textContent = strengthCounts.strong;
  document.getElementById('count-medium').textContent = strengthCounts.medium;
  document.getElementById('count-weak').textContent = strengthCounts.weak;

  // Age distribution
  const now = new Date();
  const ageCounts = { fresh: 0, recent: 0, old: 0, veryOld: 0 };

  passwords.forEach(p => {
    const created = new Date(p.createdAt || p.updatedAt);
    const daysOld = Math.floor((now - created) / (1000 * 60 * 60 * 24));

    if (daysOld < 30) ageCounts.fresh++;
    else if (daysOld < 90) ageCounts.recent++;
    else if (daysOld < 180) ageCounts.old++;
    else ageCounts.veryOld++;
  });

  document.getElementById('age-fresh').textContent = ageCounts.fresh;
  document.getElementById('age-recent').textContent = ageCounts.recent;
  document.getElementById('age-old').textContent = ageCounts.old;
  document.getElementById('age-very-old').textContent = ageCounts.veryOld;

  // Category distribution
  const categories = {};
  passwords.forEach(p => {
    const cat = p.category || 'Keine Kategorie';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const categoryStats = document.getElementById('category-stats');
  categoryStats.innerHTML = '';

  // Sort by count descending
  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);

  sortedCategories.forEach(([name, count]) => {
    const item = document.createElement('div');
    item.className = 'category-stat-item';
    item.innerHTML = `
      <span class="category-stat-name">${escapeHtml(name)}</span>
      <span class="category-stat-count">${count}</span>
    `;
    categoryStats.appendChild(item);
  });
}

// Compact view toggle
function initCompactView() {
  const toggle = document.getElementById('compact-view-toggle');
  const passwordsList = document.getElementById('passwords-list');

  // Load saved preference
  const isCompact = settings.compactView || false;
  toggle.checked = isCompact;
  passwordsList.classList.toggle('compact', isCompact);

  toggle.addEventListener('change', (e) => {
    const compact = e.target.checked;
    passwordsList.classList.toggle('compact', compact);
    settings.compactView = compact;
    saveSettings();
    showToast(compact ? 'Kompakte Ansicht aktiviert' : 'Normale Ansicht aktiviert');
  });
}

// ============================================
// BACKUPS
// ============================================

function initBackups() {
  // Update last backup info
  updateBackupInfo();

  // Create backup button
  document.getElementById('create-backup-btn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('create-backup');
    if (result.success) {
      showToast('Backup erstellt: ' + result.filename);
      updateBackupInfo();
    } else {
      showToast('Backup fehlgeschlagen: ' + result.error, 'error');
    }
  });

  // Restore backup button
  document.getElementById('restore-backup-btn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('restore-backup');
    if (result.success) {
      showToast(`Wiederhergestellt: ${result.stats.passwords} Passwörter, ${result.stats.notes} Notizen, ${result.stats.cards} Karten`);
      // Reload data
      await loadPasswords();
      await loadNotes();
      await loadCards();
    } else if (result.error !== 'Abgebrochen') {
      showToast('Wiederherstellung fehlgeschlagen: ' + result.error, 'error');
    }
  });

  // Open backup folder
  document.getElementById('open-backup-folder-btn').addEventListener('click', async () => {
    await ipcRenderer.invoke('open-backup-folder');
  });

  // Auto backup toggle
  const autoBackupToggle = document.getElementById('auto-backup-toggle');
  autoBackupToggle.checked = settings.autoBackup || false;

  autoBackupToggle.addEventListener('change', async (e) => {
    settings.autoBackup = e.target.checked;
    saveSettings();

    // Setup or clear auto backup interval (24 hours)
    await ipcRenderer.invoke('setup-auto-backup', e.target.checked ? 24 : 0);

    showToast(e.target.checked ? 'Automatisches Backup aktiviert' : 'Automatisches Backup deaktiviert');
  });

  // Setup auto backup if enabled
  if (settings.autoBackup) {
    ipcRenderer.invoke('setup-auto-backup', 24);
  }

  // Listen for auto backup notifications
  ipcRenderer.on('auto-backup-created', (event, result) => {
    if (result.success) {
      updateBackupInfo();
    }
  });
}

function updateBackupInfo() {
  const infoEl = document.getElementById('last-backup-info');
  if (settings.lastBackup) {
    const date = new Date(settings.lastBackup);
    const formatted = date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    infoEl.textContent = 'Letztes Backup: ' + formatted;
  } else {
    infoEl.textContent = 'Letztes Backup: Noch nie';
  }
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

function initDashboard() {
  loadDashboardSettings();
  updateDashboard();

  // Quick action buttons
  document.getElementById('dash-add-password')?.addEventListener('click', () => {
    switchView('passwords');
    openPasswordModal();
  });

  document.getElementById('dash-add-note')?.addEventListener('click', () => {
    switchView('notes');
    openNoteModal();
  });

  document.getElementById('dash-security-check')?.addEventListener('click', () => {
    switchView('security');
  });

  document.getElementById('dash-generator')?.addEventListener('click', () => {
    switchView('generator');
    generatePassword();
  });

  // Customize dashboard button
  document.getElementById('customize-dashboard-btn')?.addEventListener('click', () => {
    openDashboardCustomizeModal();
  });

  // Dashboard customize modal
  document.getElementById('dashboard-customize-close')?.addEventListener('click', closeDashboardCustomizeModal);
  document.getElementById('save-dashboard-settings')?.addEventListener('click', saveDashboardSettings);
  document.getElementById('reset-dashboard')?.addEventListener('click', resetDashboardSettings);
}

function loadDashboardSettings() {
  const saved = localStorage.getItem('dashboardSettings');
  if (saved) {
    dashboardSettings = JSON.parse(saved);
  }
  applyDashboardSettings();
}

function applyDashboardSettings() {
  const widgets = document.querySelectorAll('.dashboard-widget');
  widgets.forEach(widget => {
    const widgetName = widget.dataset.widget;
    if (dashboardSettings.widgets[widgetName] === false) {
      widget.classList.add('hidden');
    } else {
      widget.classList.remove('hidden');
    }
  });
}

function updateDashboard() {
  // Update quick stats
  document.getElementById('dash-passwords').textContent = passwords.length;
  document.getElementById('dash-notes').textContent = notes.length;
  document.getElementById('dash-cards').textContent = cards.length;

  // Update favorites widget
  const favoritesEl = document.getElementById('dash-favorites');
  const favorites = passwords.filter(p => p.favorite).slice(0, 5);
  if (favorites.length > 0) {
    favoritesEl.innerHTML = favorites.map(p => `
      <div class="dash-item" data-id="${p.id}">
        <div class="dash-item-icon"><i class="fas fa-star"></i></div>
        <div class="dash-item-info">
          <div class="dash-item-title">${escapeHtml(p.title)}</div>
          <div class="dash-item-meta">${escapeHtml(p.username)}</div>
        </div>
      </div>
    `).join('');

    favoritesEl.querySelectorAll('.dash-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const entry = passwords.find(p => p.id === id);
        if (entry) {
          switchView('passwords');
          openPasswordModal(entry);
        }
      });
    });
  } else {
    favoritesEl.innerHTML = '<p class="widget-empty">Keine Favoriten</p>';
  }

  // Update recent widget
  const recentEl = document.getElementById('dash-recent');
  const recent = activityLog
    .filter(a => a.type === 'view' || a.type === 'copy')
    .slice(0, 5)
    .map(a => {
      const entry = passwords.find(p => p.id === a.entryId);
      return entry ? { ...a, entry } : null;
    })
    .filter(Boolean);

  if (recent.length > 0) {
    recentEl.innerHTML = recent.map(r => `
      <div class="dash-item" data-id="${r.entry.id}">
        <div class="dash-item-icon"><i class="fas fa-clock"></i></div>
        <div class="dash-item-info">
          <div class="dash-item-title">${escapeHtml(r.entry.title)}</div>
          <div class="dash-item-meta">${formatTimeAgo(r.timestamp)}</div>
        </div>
      </div>
    `).join('');

    recentEl.querySelectorAll('.dash-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const entry = passwords.find(p => p.id === id);
        if (entry) {
          switchView('passwords');
          openPasswordModal(entry);
        }
      });
    });
  } else {
    recentEl.innerHTML = '<p class="widget-empty">Keine Einträge</p>';
  }

  // Update expiring widget
  const expiringEl = document.getElementById('dash-expiring');
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiring = passwords.filter(p => {
    if (!p.expiryDate) return false;
    const expiry = new Date(p.expiryDate);
    return expiry <= thirtyDaysFromNow && expiry >= now;
  }).slice(0, 5);

  if (expiring.length > 0) {
    expiringEl.innerHTML = expiring.map(p => {
      const days = Math.ceil((new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24));
      return `
        <div class="dash-item" data-id="${p.id}">
          <div class="dash-item-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="dash-item-info">
            <div class="dash-item-title">${escapeHtml(p.title)}</div>
            <div class="dash-item-meta">${days} Tage übrig</div>
          </div>
        </div>
      `;
    }).join('');

    expiringEl.querySelectorAll('.dash-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const entry = passwords.find(p => p.id === id);
        if (entry) {
          switchView('passwords');
          openPasswordModal(entry);
        }
      });
    });
  } else {
    expiringEl.innerHTML = '<p class="widget-empty">Keine ablaufenden Passwörter</p>';
  }

  // Update activity preview
  const activityPreviewEl = document.getElementById('dash-activity');
  const recentActivity = activityLog.slice(0, 5);
  if (recentActivity.length > 0) {
    activityPreviewEl.innerHTML = recentActivity.map(a => `
      <div class="activity-preview-item">
        <i class="fas ${getActivityIcon(a.type)}"></i>
        <span>${getActivityText(a)}</span>
        <time>${formatTimeAgo(a.timestamp)}</time>
      </div>
    `).join('');
  } else {
    activityPreviewEl.innerHTML = '<p class="widget-empty">Keine Aktivität</p>';
  }

  // Update security mini score
  updateSecurityMiniScore();
}

function updateSecurityMiniScore() {
  const scoreEl = document.getElementById('dash-security-score');
  const circleEl = document.getElementById('dash-security-circle');
  const weakEl = document.getElementById('dash-weak-count');
  const reusedEl = document.getElementById('dash-reused-count');

  if (!scoreEl) return;

  let weakCount = 0;
  let reusedCount = 0;
  const passwordCounts = {};

  passwords.forEach(p => {
    const strength = calculatePasswordStrength(p.password);
    if (strength.score < 40) weakCount++;

    if (passwordCounts[p.password]) {
      passwordCounts[p.password]++;
    } else {
      passwordCounts[p.password] = 1;
    }
  });

  Object.values(passwordCounts).forEach(count => {
    if (count > 1) reusedCount += count;
  });

  const totalIssues = weakCount + reusedCount;
  const score = passwords.length > 0
    ? Math.max(0, 100 - (totalIssues / passwords.length * 100))
    : 100;

  scoreEl.textContent = Math.round(score);
  weakEl.textContent = weakCount;
  reusedEl.textContent = reusedCount;

  circleEl.className = 'mini-score-circle';
  if (score < 50) {
    circleEl.classList.add('danger');
  } else if (score < 80) {
    circleEl.classList.add('warning');
  }
}

function openDashboardCustomizeModal() {
  const modal = document.getElementById('dashboard-customize-modal');

  // Set checkbox states
  Object.keys(dashboardSettings.widgets).forEach(widget => {
    const checkbox = document.getElementById(`widget-${widget}`);
    if (checkbox) {
      checkbox.checked = dashboardSettings.widgets[widget];
    }
  });

  modal.classList.add('active');
}

function closeDashboardCustomizeModal() {
  document.getElementById('dashboard-customize-modal').classList.remove('active');
}

function saveDashboardSettings() {
  Object.keys(dashboardSettings.widgets).forEach(widget => {
    const checkbox = document.getElementById(`widget-${widget}`);
    if (checkbox) {
      dashboardSettings.widgets[widget] = checkbox.checked;
    }
  });

  localStorage.setItem('dashboardSettings', JSON.stringify(dashboardSettings));
  applyDashboardSettings();
  closeDashboardCustomizeModal();
  showToast('Dashboard-Einstellungen gespeichert');
}

function resetDashboardSettings() {
  dashboardSettings = {
    widgets: {
      stats: true,
      security: true,
      favorites: true,
      recent: true,
      expiring: true,
      activity: true
    }
  };

  Object.keys(dashboardSettings.widgets).forEach(widget => {
    const checkbox = document.getElementById(`widget-${widget}`);
    if (checkbox) {
      checkbox.checked = true;
    }
  });

  localStorage.setItem('dashboardSettings', JSON.stringify(dashboardSettings));
  applyDashboardSettings();
}

// ============================================
// ACTIVITY LOG FUNCTIONS
// ============================================

function initActivityLog() {
  loadActivityLog();

  document.getElementById('activity-filter-btn')?.addEventListener('click', () => {
    document.getElementById('activity-filter-menu')?.classList.toggle('show');
  });

  document.getElementById('activity-type-filter')?.addEventListener('change', renderActivityLog);

  document.getElementById('clear-activity-btn')?.addEventListener('click', async () => {
    if (confirm('Möchten Sie den gesamten Aktivitätsverlauf löschen?')) {
      activityLog = [];
      await saveActivityLog();
      renderActivityLog();
      updateDashboard();
      showToast('Aktivitätsverlauf gelöscht');
    }
  });

  document.getElementById('export-activity-btn')?.addEventListener('click', exportActivityLog);
}

function loadActivityLog() {
  const saved = localStorage.getItem('activityLog');
  if (saved) {
    activityLog = JSON.parse(saved);
  }
}

async function saveActivityLog() {
  localStorage.setItem('activityLog', JSON.stringify(activityLog));
}

function logActivity(type, entryId, entryTitle, details = {}) {
  const activity = {
    id: Date.now().toString(),
    type,
    entryId,
    entryTitle,
    details,
    timestamp: new Date().toISOString()
  };

  activityLog.unshift(activity);

  // Keep only last 500 entries
  if (activityLog.length > 500) {
    activityLog = activityLog.slice(0, 500);
  }

  saveActivityLog();

  // Update dashboard if visible
  if (document.getElementById('dashboard-view')?.style.display !== 'none') {
    updateDashboard();
  }
}

function renderActivityLog() {
  const timeline = document.getElementById('activity-timeline');
  if (!timeline) return;

  const filterType = document.getElementById('activity-type-filter')?.value || '';
  const filtered = filterType
    ? activityLog.filter(a => a.type === filterType)
    : activityLog;

  if (filtered.length === 0) {
    timeline.innerHTML = `
      <div class="activity-empty">
        <i class="fas fa-history"></i>
        <h3>Keine Aktivitäten</h3>
        <p>Ihre Aktivitäten werden hier protokolliert</p>
      </div>
    `;
    return;
  }

  // Group by day
  const grouped = {};
  filtered.forEach(activity => {
    const date = new Date(activity.timestamp).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(activity);
  });

  let html = '';
  Object.keys(grouped).forEach(date => {
    html += `<div class="activity-day-header">${date}</div>`;

    grouped[date].forEach(activity => {
      html += `
        <div class="activity-item">
          <div class="activity-icon ${activity.type}">
            <i class="fas ${getActivityIcon(activity.type)}"></i>
          </div>
          <div class="activity-details">
            <div class="activity-action">${getActivityText(activity)}</div>
            <div class="activity-meta">${activity.details.category || ''}</div>
          </div>
          <div class="activity-time">${formatTime(activity.timestamp)}</div>
        </div>
      `;
    });
  });

  timeline.innerHTML = html;
}

function getActivityIcon(type) {
  const icons = {
    view: 'fa-eye',
    copy: 'fa-copy',
    create: 'fa-plus',
    edit: 'fa-edit',
    delete: 'fa-trash',
    login: 'fa-sign-in-alt'
  };
  return icons[type] || 'fa-circle';
}

function getActivityText(activity) {
  const texts = {
    view: `<strong>${escapeHtml(activity.entryTitle)}</strong> angesehen`,
    copy: `Passwort von <strong>${escapeHtml(activity.entryTitle)}</strong> kopiert`,
    create: `<strong>${escapeHtml(activity.entryTitle)}</strong> erstellt`,
    edit: `<strong>${escapeHtml(activity.entryTitle)}</strong> bearbeitet`,
    delete: `<strong>${escapeHtml(activity.entryTitle)}</strong> gelöscht`,
    login: 'Tresor entsperrt'
  };
  return texts[activity.type] || activity.type;
}

function formatTimeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days < 7) return `vor ${days} Tagen`;

  return date.toLocaleDateString('de-DE');
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function exportActivityLog() {
  const data = JSON.stringify(activityLog, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `mason-activity-log-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showToast('Aktivitätsprotokoll exportiert');
}

// ============================================
// SHARE FUNCTIONS
// ============================================

let currentShareEntry = null;
let currentShareQR = null;

function initShareModal() {
  document.getElementById('share-modal-close')?.addEventListener('click', closeShareModal);
  document.getElementById('generate-share-link')?.addEventListener('click', generateShareLink);
  document.getElementById('copy-share-link')?.addEventListener('click', copyShareLink);
  document.getElementById('revoke-share-link')?.addEventListener('click', revokeShareLink);

  document.getElementById('show-share-btn')?.addEventListener('click', () => {
    const id = document.getElementById('edit-id').value;
    if (id) {
      const entry = passwords.find(p => p.id === id);
      if (entry) openShareModal(entry);
    }
  });
}

function openShareModal(entry) {
  currentShareEntry = entry;
  const modal = document.getElementById('share-modal');

  // Reset state
  document.getElementById('share-link').value = '';
  document.getElementById('share-expires-at').textContent = 'Läuft ab in: --';
  document.getElementById('share-views-left').textContent = 'Aufrufe übrig: --';
  document.getElementById('generate-share-link').style.display = 'flex';
  document.getElementById('revoke-share-link').style.display = 'none';
  document.getElementById('share-qr-code').innerHTML = '';

  // Check for existing share
  const existing = sharedPasswords.find(s => s.entryId === entry.id && !isShareExpired(s));
  if (existing) {
    displayExistingShare(existing);
  }

  modal.classList.add('active');
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('active');
  currentShareEntry = null;
}

function generateShareLink() {
  if (!currentShareEntry) return;

  const expiryMinutes = parseInt(document.getElementById('share-expiry').value);
  const maxViews = parseInt(document.getElementById('share-views').value);

  // Generate encrypted share data
  const shareData = {
    title: currentShareEntry.title,
    username: currentShareEntry.username,
    password: currentShareEntry.password,
    url: currentShareEntry.url || ''
  };

  // Create share token
  const shareToken = btoa(JSON.stringify({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    data: btoa(JSON.stringify(shareData)),
    created: Date.now()
  }));

  // Save share record
  const share = {
    id: Date.now().toString(),
    entryId: currentShareEntry.id,
    token: shareToken,
    expiresAt: new Date(Date.now() + expiryMinutes * 60000).toISOString(),
    maxViews,
    viewCount: 0,
    createdAt: new Date().toISOString()
  };

  sharedPasswords.push(share);
  localStorage.setItem('sharedPasswords', JSON.stringify(sharedPasswords));

  displayExistingShare(share);
  logActivity('share', currentShareEntry.id, currentShareEntry.title, { expiryMinutes, maxViews });
  showToast('Freigabe-Link erstellt');
}

function displayExistingShare(share) {
  const link = `mason://share/${share.token}`;
  document.getElementById('share-link').value = link;

  const expiresAt = new Date(share.expiresAt);
  const now = new Date();
  const diffMinutes = Math.ceil((expiresAt - now) / 60000);

  if (diffMinutes > 60) {
    const hours = Math.floor(diffMinutes / 60);
    document.getElementById('share-expires-at').textContent = `Läuft ab in: ${hours} Std.`;
  } else {
    document.getElementById('share-expires-at').textContent = `Läuft ab in: ${diffMinutes} Min.`;
  }

  document.getElementById('share-views-left').textContent = `Aufrufe übrig: ${share.maxViews - share.viewCount}`;

  document.getElementById('generate-share-link').style.display = 'none';
  document.getElementById('revoke-share-link').style.display = 'flex';

  // Generate QR code
  const qrContainer = document.getElementById('share-qr-code');
  qrContainer.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: link,
      width: 150,
      height: 150,
      colorDark: '#000000',
      colorLight: '#ffffff'
    });
  }
}

function copyShareLink() {
  const link = document.getElementById('share-link').value;
  if (link) {
    navigator.clipboard.writeText(link);
    showToast('Link kopiert');
  }
}

function revokeShareLink() {
  if (!currentShareEntry) return;

  const index = sharedPasswords.findIndex(s => s.entryId === currentShareEntry.id);
  if (index > -1) {
    sharedPasswords.splice(index, 1);
    localStorage.setItem('sharedPasswords', JSON.stringify(sharedPasswords));

    // Reset UI
    document.getElementById('share-link').value = '';
    document.getElementById('share-expires-at').textContent = 'Läuft ab in: --';
    document.getElementById('share-views-left').textContent = 'Aufrufe übrig: --';
    document.getElementById('generate-share-link').style.display = 'flex';
    document.getElementById('revoke-share-link').style.display = 'none';
    document.getElementById('share-qr-code').innerHTML = '';

    showToast('Freigabe widerrufen');
  }
}

function isShareExpired(share) {
  const now = new Date();
  const expiresAt = new Date(share.expiresAt);
  return now > expiresAt || share.viewCount >= share.maxViews;
}

function loadSharedPasswords() {
  const saved = localStorage.getItem('sharedPasswords');
  if (saved) {
    sharedPasswords = JSON.parse(saved);
    // Clean up expired shares
    sharedPasswords = sharedPasswords.filter(s => !isShareExpired(s));
    localStorage.setItem('sharedPasswords', JSON.stringify(sharedPasswords));
  }
}

// ============================================
// SWITCH VIEW HELPER
// ============================================

function switchView(viewName) {
  const views = document.querySelectorAll('.view');
  const navItems = document.querySelectorAll('.nav-item');

  views.forEach(view => view.style.display = 'none');
  navItems.forEach(item => item.classList.remove('active'));

  const targetView = document.getElementById(`${viewName}-view`);
  const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);

  if (targetView) targetView.style.display = 'block';
  if (targetNav) targetNav.classList.add('active');

  // Update content based on view
  if (viewName === 'dashboard') {
    updateDashboard();
  } else if (viewName === 'activity') {
    renderActivityLog();
  }
}
