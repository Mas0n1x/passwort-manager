const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

// Verschlüsselter Store für Passwörter
const store = new Store({
  name: 'mason-vault',
  encryptionKey: 'mason-local-encryption-key-v1'
});

let mainWindow;
let masterPassword = null;
let nativeMessagingServer = null;

// Verschlüsselungsfunktionen
function encrypt(text, password) {
  return CryptoJS.AES.encrypt(text, password).toString();
}

function decrypt(encryptedText, password) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return null;
  }
}

// Hash für Master-Passwort
function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0d0d0d',
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('src/index.html');

  // DevTools in Entwicklung
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  startNativeMessagingServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (nativeMessagingServer) {
    nativeMessagingServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Native Messaging Server für Browser-Erweiterung
function startNativeMessagingServer() {
  nativeMessagingServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          handleBrowserRequest(data, res);
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else if (req.method === 'GET') {
      if (req.url === '/status') {
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'running',
          unlocked: masterPassword !== null
        }));
      } else if (req.url === '/passwords' && masterPassword) {
        const passwords = getDecryptedPasswords();
        res.writeHead(200);
        res.end(JSON.stringify(passwords.map(p => ({
          id: p.id,
          title: p.title,
          username: p.username,
          url: p.url
        }))));
      } else {
        res.writeHead(404);
        res.end();
      }
    }
  });

  nativeMessagingServer.listen(52849, '127.0.0.1', () => {
    console.log('Native Messaging Server läuft auf Port 52849');
  });
}

function handleBrowserRequest(data, res) {
  if (!masterPassword && data.action !== 'ping') {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Vault ist gesperrt' }));
    return;
  }

  switch (data.action) {
    case 'ping':
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', unlocked: masterPassword !== null }));
      break;

    case 'getPassword':
      const passwords = getDecryptedPasswords();
      const entry = passwords.find(p => p.id === data.id);
      if (entry) {
        res.writeHead(200);
        res.end(JSON.stringify({
          username: entry.username,
          password: entry.password
        }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Nicht gefunden' }));
      }
      break;

    case 'searchByUrl':
      const allPasswords = getDecryptedPasswords();
      const matches = allPasswords.filter(p => {
        if (!p.url) return false;
        try {
          const entryUrl = new URL(p.url);
          const searchUrl = new URL(data.url);
          return entryUrl.hostname === searchUrl.hostname;
        } catch {
          return p.url.includes(data.url);
        }
      });
      res.writeHead(200);
      res.end(JSON.stringify(matches.map(p => ({
        id: p.id,
        title: p.title,
        username: p.username,
        url: p.url
      }))));
      break;

    default:
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Unbekannte Aktion' }));
  }
}

function getDecryptedPasswords() {
  const encrypted = store.get('passwords', []);
  return encrypted.map(entry => {
    try {
      let tags = [];
      if (entry.tags) {
        try {
          tags = JSON.parse(decrypt(entry.tags, masterPassword));
        } catch { tags = []; }
      }

      return {
        id: entry.id,
        title: decrypt(entry.title, masterPassword),
        username: decrypt(entry.username, masterPassword),
        password: decrypt(entry.password, masterPassword),
        url: entry.url ? decrypt(entry.url, masterPassword) : '',
        notes: entry.notes ? decrypt(entry.notes, masterPassword) : '',
        category: entry.category ? decrypt(entry.category, masterPassword) : '',
        tags: tags,
        favorite: entry.favorite || false,
        expiryDate: entry.expiryDate || null,
        passwordHistory: entry.passwordHistory || [],
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// IPC Handlers
ipcMain.handle('check-master-password', () => {
  return store.has('masterHash');
});

ipcMain.handle('set-master-password', (event, password) => {
  const hash = hashPassword(password);
  store.set('masterHash', hash);
  masterPassword = password;
  return true;
});

ipcMain.handle('verify-master-password', (event, password) => {
  const storedHash = store.get('masterHash');
  const inputHash = hashPassword(password);
  if (storedHash === inputHash) {
    masterPassword = password;
    return true;
  }
  return false;
});

ipcMain.handle('lock-vault', () => {
  masterPassword = null;
  return true;
});

ipcMain.handle('get-passwords', () => {
  if (!masterPassword) return [];
  return getDecryptedPasswords();
});

ipcMain.handle('add-password', (event, data) => {
  if (!masterPassword) return false;

  const encrypted = {
    id: uuidv4(),
    title: encrypt(data.title, masterPassword),
    username: encrypt(data.username, masterPassword),
    password: encrypt(data.password, masterPassword),
    url: data.url ? encrypt(data.url, masterPassword) : null,
    notes: data.notes ? encrypt(data.notes, masterPassword) : null,
    category: data.category ? encrypt(data.category, masterPassword) : null,
    tags: data.tags ? encrypt(JSON.stringify(data.tags), masterPassword) : null,
    favorite: data.favorite || false,
    expiryDate: data.expiryDate || null,
    passwordHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const passwords = store.get('passwords', []);
  passwords.push(encrypted);
  store.set('passwords', passwords);

  return encrypted.id;
});

ipcMain.handle('update-password', (event, id, data) => {
  if (!masterPassword) return false;

  const passwords = store.get('passwords', []);
  const index = passwords.findIndex(p => p.id === id);

  if (index === -1) return false;

  // Store old password in history if it changed
  const oldEntry = passwords[index];
  let history = oldEntry.passwordHistory || [];

  const oldPassword = decrypt(oldEntry.password, masterPassword);
  if (oldPassword && oldPassword !== data.password) {
    history.push({
      password: oldEntry.password,
      changedAt: new Date().toISOString()
    });
    // Keep only last 10 entries
    if (history.length > 10) history = history.slice(-10);
  }

  passwords[index] = {
    ...passwords[index],
    title: encrypt(data.title, masterPassword),
    username: encrypt(data.username, masterPassword),
    password: encrypt(data.password, masterPassword),
    url: data.url ? encrypt(data.url, masterPassword) : null,
    notes: data.notes ? encrypt(data.notes, masterPassword) : null,
    category: data.category ? encrypt(data.category, masterPassword) : null,
    tags: data.tags ? encrypt(JSON.stringify(data.tags), masterPassword) : null,
    favorite: data.favorite || false,
    expiryDate: data.expiryDate || null,
    passwordHistory: history,
    updatedAt: new Date().toISOString()
  };

  store.set('passwords', passwords);
  return true;
});

ipcMain.handle('delete-password', (event, id) => {
  const passwords = store.get('passwords', []);
  const filtered = passwords.filter(p => p.id !== id);
  store.set('passwords', filtered);
  return true;
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  setTimeout(() => {
    if (clipboard.readText() === text) {
      clipboard.clear();
    }
  }, 30000); // Automatisch nach 30 Sekunden löschen
  return true;
});

ipcMain.handle('generate-password', (event, options) => {
  const { length, uppercase, lowercase, numbers, symbols } = options;

  let charset = '';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!charset) charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let password = '';
  const randomValues = require('crypto').randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return password;
});

// Window Controls
ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('close-window', () => mainWindow.close());

// Import from Browser CSV
ipcMain.handle('import-from-file', async () => {
  if (!masterPassword) return { success: false, error: 'Tresor ist gesperrt' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Passwörter importieren',
    filters: [
      { name: 'CSV Dateien', extensions: ['csv'] },
      { name: 'JSON Dateien', extensions: ['json'] },
      { name: 'Alle Dateien', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'Abgebrochen' };
  }

  const filePath = result.filePaths[0];
  const extension = path.extname(filePath).toLowerCase();

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let importedPasswords = [];

    if (extension === '.csv') {
      importedPasswords = parseCSV(content);
    } else if (extension === '.json') {
      importedPasswords = parseJSON(content);
    } else {
      // Try CSV first, then JSON
      try {
        importedPasswords = parseCSV(content);
      } catch {
        importedPasswords = parseJSON(content);
      }
    }

    // Save imported passwords
    const passwords = store.get('passwords', []);
    let importCount = 0;

    for (const entry of importedPasswords) {
      if (entry.username && entry.password) {
        const encrypted = {
          id: uuidv4(),
          title: encrypt(entry.title || entry.url || 'Importiert', masterPassword),
          username: encrypt(entry.username, masterPassword),
          password: encrypt(entry.password, masterPassword),
          url: entry.url ? encrypt(entry.url, masterPassword) : null,
          notes: entry.notes ? encrypt(entry.notes, masterPassword) : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        passwords.push(encrypted);
        importCount++;
      }
    }

    store.set('passwords', passwords);
    return { success: true, count: importCount };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Parse CSV (Chrome, Firefox, Opera, Edge format)
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Detect header
  const headerLine = lines[0].toLowerCase();
  const headers = parseCSVLine(lines[0]);
  const headerMap = {};

  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();
    // Chrome/Edge: name, url, username, password
    // Firefox: url, username, password, httpRealm, formActionOrigin, guid, timeCreated, timeLastUsed, timePasswordChanged
    // Opera: similar to Chrome
    if (h.includes('name') || h.includes('title') || h.includes('origin')) {
      headerMap.title = index;
    }
    if (h.includes('url') || h.includes('origin') || h.includes('hostname')) {
      headerMap.url = index;
    }
    if (h.includes('user') || h.includes('login') || h.includes('email')) {
      headerMap.username = index;
    }
    if (h.includes('pass') || h.includes('pwd')) {
      headerMap.password = index;
    }
    if (h.includes('note') || h.includes('comment')) {
      headerMap.notes = index;
    }
  });

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > 0) {
      const entry = {
        title: headerMap.title !== undefined ? values[headerMap.title] : '',
        url: headerMap.url !== undefined ? values[headerMap.url] : '',
        username: headerMap.username !== undefined ? values[headerMap.username] : '',
        password: headerMap.password !== undefined ? values[headerMap.password] : '',
        notes: headerMap.notes !== undefined ? values[headerMap.notes] : ''
      };

      // Use URL as title if no title
      if (!entry.title && entry.url) {
        try {
          entry.title = new URL(entry.url).hostname;
        } catch {
          entry.title = entry.url;
        }
      }

      if (entry.username || entry.password) {
        results.push(entry);
      }
    }
  }

  return results;
}

// Parse CSV line handling quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Parse JSON (various formats)
function parseJSON(content) {
  const data = JSON.parse(content);
  const results = [];

  // Handle array format
  const items = Array.isArray(data) ? data : (data.passwords || data.items || data.logins || [data]);

  for (const item of items) {
    const entry = {
      title: item.title || item.name || item.origin || '',
      url: item.url || item.origin || item.hostname || item.uri || '',
      username: item.username || item.login || item.user || item.email || '',
      password: item.password || item.pass || item.pwd || '',
      notes: item.notes || item.note || item.comment || ''
    };

    if (!entry.title && entry.url) {
      try {
        entry.title = new URL(entry.url).hostname;
      } catch {
        entry.title = entry.url;
      }
    }

    if (entry.username || entry.password) {
      results.push(entry);
    }
  }

  return results;
}

// Export passwords
ipcMain.handle('export-passwords', async () => {
  if (!masterPassword) return { success: false, error: 'Tresor ist gesperrt' };

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Passwörter exportieren',
    defaultPath: 'mason-passwords-export.csv',
    filters: [
      { name: 'CSV Dateien', extensions: ['csv'] },
      { name: 'JSON Dateien', extensions: ['json'] }
    ]
  });

  if (result.canceled) {
    return { success: false, error: 'Abgebrochen' };
  }

  try {
    const passwords = getDecryptedPasswords();
    const extension = path.extname(result.filePath).toLowerCase();

    if (extension === '.json') {
      const jsonData = passwords.map(p => ({
        title: p.title,
        url: p.url,
        username: p.username,
        password: p.password,
        notes: p.notes
      }));
      fs.writeFileSync(result.filePath, JSON.stringify(jsonData, null, 2));
    } else {
      // CSV format
      let csv = 'name,url,username,password,note\n';
      for (const p of passwords) {
        csv += `"${(p.title || '').replace(/"/g, '""')}","${(p.url || '').replace(/"/g, '""')}","${(p.username || '').replace(/"/g, '""')}","${(p.password || '').replace(/"/g, '""')}","${(p.notes || '').replace(/"/g, '""')}"\n`;
      }
      fs.writeFileSync(result.filePath, csv);
    }

    return { success: true, count: passwords.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ===== SECURE NOTES =====
ipcMain.handle('get-notes', () => {
  if (!masterPassword) return [];
  const notes = store.get('notes', []);
  return notes.map(note => {
    try {
      return {
        id: note.id,
        title: decrypt(note.title, masterPassword),
        content: decrypt(note.content, masterPassword),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
});

ipcMain.handle('add-note', (event, data) => {
  if (!masterPassword) return false;
  const notes = store.get('notes', []);
  const newNote = {
    id: uuidv4(),
    title: encrypt(data.title, masterPassword),
    content: encrypt(data.content || '', masterPassword),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  notes.push(newNote);
  store.set('notes', notes);
  return newNote.id;
});

ipcMain.handle('update-note', (event, id, data) => {
  if (!masterPassword) return false;
  const notes = store.get('notes', []);
  const index = notes.findIndex(n => n.id === id);
  if (index === -1) return false;
  notes[index] = {
    ...notes[index],
    title: encrypt(data.title, masterPassword),
    content: encrypt(data.content || '', masterPassword),
    updatedAt: new Date().toISOString()
  };
  store.set('notes', notes);
  return true;
});

ipcMain.handle('delete-note', (event, id) => {
  const notes = store.get('notes', []);
  store.set('notes', notes.filter(n => n.id !== id));
  return true;
});

// ===== CREDIT CARDS =====
ipcMain.handle('get-cards', () => {
  if (!masterPassword) return [];
  const cards = store.get('cards', []);
  return cards.map(card => {
    try {
      return {
        id: card.id,
        name: decrypt(card.name, masterPassword),
        holder: decrypt(card.holder, masterPassword),
        number: decrypt(card.number, masterPassword),
        expiry: decrypt(card.expiry, masterPassword),
        cvv: decrypt(card.cvv, masterPassword),
        type: card.type,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
});

ipcMain.handle('add-card', (event, data) => {
  if (!masterPassword) return false;
  const cards = store.get('cards', []);
  const newCard = {
    id: uuidv4(),
    name: encrypt(data.name, masterPassword),
    holder: encrypt(data.holder, masterPassword),
    number: encrypt(data.number, masterPassword),
    expiry: encrypt(data.expiry, masterPassword),
    cvv: encrypt(data.cvv, masterPassword),
    type: data.type,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  cards.push(newCard);
  store.set('cards', cards);
  return newCard.id;
});

ipcMain.handle('update-card', (event, id, data) => {
  if (!masterPassword) return false;
  const cards = store.get('cards', []);
  const index = cards.findIndex(c => c.id === id);
  if (index === -1) return false;
  cards[index] = {
    ...cards[index],
    name: encrypt(data.name, masterPassword),
    holder: encrypt(data.holder, masterPassword),
    number: encrypt(data.number, masterPassword),
    expiry: encrypt(data.expiry, masterPassword),
    cvv: encrypt(data.cvv, masterPassword),
    type: data.type,
    updatedAt: new Date().toISOString()
  };
  store.set('cards', cards);
  return true;
});

ipcMain.handle('delete-card', (event, id) => {
  const cards = store.get('cards', []);
  store.set('cards', cards.filter(c => c.id !== id));
  return true;
});

// ===== SETTINGS =====
ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    theme: 'dark',
    autoLockTime: 5
  });
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  return true;
});

// ===== PASSWORD HISTORY =====
ipcMain.handle('get-password-history', (event, id) => {
  if (!masterPassword) return [];
  const passwords = store.get('passwords', []);
  const entry = passwords.find(p => p.id === id);
  if (!entry || !entry.passwordHistory) return [];

  return entry.passwordHistory.map(h => ({
    password: decrypt(h.password, masterPassword),
    changedAt: h.changedAt
  }));
});

// Open extension folder
ipcMain.handle('open-extension-folder', () => {
  const extensionPath = path.join(__dirname, 'browser-extension');
  if (fs.existsSync(extensionPath)) {
    shell.openPath(extensionPath);
  } else {
    // If running from packaged app, extension is in parent directory
    const altPath = path.join(path.dirname(process.execPath), 'browser-extension');
    if (fs.existsSync(altPath)) {
      shell.openPath(altPath);
    } else {
      shell.openPath(path.dirname(__dirname));
    }
  }
  return true;
});
