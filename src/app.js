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
let isNewUser = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkMasterPassword();
  setupEventListeners();
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

  items.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'password-card';
    card.innerHTML = `
      <div class="password-icon">
        <i class="fas fa-key"></i>
      </div>
      <div class="password-info">
        <div class="password-title">${escapeHtml(entry.title)}</div>
        <div class="password-username">${escapeHtml(entry.username)}</div>
      </div>
      <div class="password-actions">
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
  } else {
    modalTitle.textContent = 'Neues Passwort';
    editIdInput.value = '';
    passwordForm.reset();
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
    notes: document.getElementById('entry-notes').value
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
