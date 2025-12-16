const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, dialog, shell, Tray, Menu, nativeImage } = require('electron');
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
let tray = null;
let isQuitting = false;

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

  // Minimieren in System Tray statt schließen
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

// System Tray erstellen
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'logo.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    // Resize für Tray (16x16 oder 32x32 je nach System)
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch (e) {
    console.error('Tray icon not found:', e);
    return;
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Mason Password Manager');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mason öffnen',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Tresor sperren',
      click: () => {
        masterPassword = null;
        mainWindow.webContents.send('vault-locked');
      }
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Doppelklick auf Tray-Icon öffnet App
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// Prüfe ob App versteckt starten soll (Autostart)
const shouldStartHidden = process.argv.includes('--hidden');

app.whenReady().then(() => {
  createWindow();
  createTray();
  startNativeMessagingServer();

  // Versteckt starten wenn --hidden Flag gesetzt
  if (shouldStartHidden) {
    mainWindow.hide();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

// Verhindere dass App beendet wird wenn alle Fenster geschlossen sind
app.on('window-all-closed', () => {
  // App läuft im Tray weiter - nicht beenden
});

// Wirkliches Beenden wenn isQuitting true ist
app.on('before-quit', () => {
  isQuitting = true;
  if (nativeMessagingServer) {
    nativeMessagingServer.close();
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

    case 'addPassword':
      try {
        const newEntry = {
          id: uuidv4(),
          title: encrypt(data.data.title || '', masterPassword),
          username: encrypt(data.data.username || '', masterPassword),
          password: encrypt(data.data.password || '', masterPassword),
          url: data.data.url ? encrypt(data.data.url, masterPassword) : '',
          notes: '',
          category: '',
          tags: '',
          favorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const existingPasswords = store.get('passwords', []);
        existingPasswords.push(newEntry);
        store.set('passwords', existingPasswords);

        // Notify renderer to refresh
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('passwords-updated');
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, id: newEntry.id }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      break;

    case 'updatePassword':
      try {
        const existingPws = store.get('passwords', []);
        const index = existingPws.findIndex(p => p.id === data.id);
        if (index === -1) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Passwort nicht gefunden' }));
          return;
        }

        // Update password field
        existingPws[index].password = encrypt(data.password, masterPassword);
        existingPws[index].updatedAt = new Date().toISOString();
        store.set('passwords', existingPws);

        // Notify renderer to refresh
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('passwords-updated');
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
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

// Parse CSV (Chrome, Firefox, Opera, Edge, LastPass, Bitwarden, 1Password, KeePass format)
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Detect header
  const headerLine = lines[0].toLowerCase();
  const headers = parseCSVLine(lines[0]);
  const headerMap = {};

  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();

    // Title/Name detection
    // Chrome/Edge: name | Firefox: - | LastPass: name | Bitwarden: name | 1Password: Title | KeePass: Title
    if (h === 'name' || h === 'title' || h === 'entry') {
      headerMap.title = index;
    }

    // URL detection
    // Chrome/Edge: url | Firefox: url | LastPass: url | Bitwarden: login_uri | 1Password: URL | KeePass: URL
    if (h === 'url' || h === 'login_uri' || h === 'website' || h === 'location' || h.includes('hostname')) {
      headerMap.url = index;
    }

    // Username detection
    // Chrome/Edge: username | Firefox: username | LastPass: username | Bitwarden: login_username | 1Password: username | KeePass: UserName
    if (h === 'username' || h === 'login_username' || h === 'user' || h === 'login' || h === 'email' || h === 'e-mail') {
      headerMap.username = index;
    }

    // Password detection
    // Chrome/Edge: password | Firefox: password | LastPass: password | Bitwarden: login_password | 1Password: password | KeePass: Password
    if (h === 'password' || h === 'login_password' || h === 'pass' || h === 'pwd') {
      headerMap.password = index;
    }

    // Notes detection
    // LastPass: extra | Bitwarden: notes | 1Password: notes | KeePass: Notes
    if (h === 'notes' || h === 'note' || h === 'extra' || h === 'comment' || h === 'comments') {
      headerMap.notes = index;
    }

    // Category/Folder detection
    // LastPass: grouping | Bitwarden: folder | 1Password: type | KeePass: Group
    if (h === 'grouping' || h === 'folder' || h === 'group' || h === 'category' || h === 'type') {
      headerMap.category = index;
    }

    // TOTP detection (for future 2FA support)
    if (h === 'totp' || h === 'login_totp' || h === 'otp' || h === 'otpauth') {
      headerMap.totp = index;
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
        notes: headerMap.notes !== undefined ? values[headerMap.notes] : '',
        category: headerMap.category !== undefined ? values[headerMap.category] : '',
        totp: headerMap.totp !== undefined ? values[headerMap.totp] : ''
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
  let results = [];

  // Detect format and parse accordingly
  if (data.encrypted !== undefined || data.items?.some(i => i.login)) {
    // Bitwarden JSON format
    results = parseBitwardenJSON(data);
  } else if (data.accounts || (Array.isArray(data) && data[0]?.ainfo)) {
    // 1Password format
    results = parse1PasswordJSON(data);
  } else if (data.entries || data.Root?.Entry) {
    // KeePass JSON format
    results = parseKeePassJSON(data);
  } else {
    // Generic JSON / LastPass export format
    const items = Array.isArray(data) ? data : (data.passwords || data.items || data.logins || [data]);

    for (const item of items) {
      const entry = {
        title: item.title || item.name || item.origin || item.grouping || '',
        url: item.url || item.origin || item.hostname || item.uri || '',
        username: item.username || item.login || item.user || item.email || '',
        password: item.password || item.pass || item.pwd || '',
        notes: item.notes || item.note || item.comment || item.extra || '',
        category: item.grouping || item.group || item.folder || ''
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
  }

  return results;
}

// Parse Bitwarden JSON export
function parseBitwardenJSON(data) {
  const results = [];
  const items = data.items || [];

  for (const item of items) {
    // Only process login items (type 1)
    if (item.type !== 1 || !item.login) continue;

    const login = item.login;
    const entry = {
      title: item.name || '',
      url: login.uris?.[0]?.uri || '',
      username: login.username || '',
      password: login.password || '',
      notes: item.notes || '',
      category: item.folderId || ''
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

// Parse 1Password JSON export
function parse1PasswordJSON(data) {
  const results = [];
  const accounts = data.accounts || [];

  // 1Password 1pux format or CSV-to-JSON format
  const items = data.items || data.accounts || (Array.isArray(data) ? data : []);

  for (const item of items) {
    // 1Password CSV export fields
    if (item.ainfo || item.uuid) {
      const entry = {
        title: item.title || item.ainfo || '',
        url: item.url || item.location || '',
        username: item.username || item.ainfo || '',
        password: item.password || '',
        notes: item.notes || item.notesPlain || '',
        category: item.type || item.category || ''
      };

      // Handle 1Password fields array
      if (item.fields) {
        for (const field of item.fields) {
          if (field.designation === 'username' || field.name === 'username') {
            entry.username = field.value || entry.username;
          }
          if (field.designation === 'password' || field.name === 'password') {
            entry.password = field.value || entry.password;
          }
        }
      }

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

// Parse KeePass JSON export (via KeePassXC or similar)
function parseKeePassJSON(data) {
  const results = [];

  // KeePassXC exports as { Root: { Entry: [...] } }
  const entries = data.entries || data.Root?.Entry || data.Root?.Group?.Entry || [];
  const items = Array.isArray(entries) ? entries : [entries];

  function parseKeePassEntry(entry) {
    const getString = (key) => {
      if (entry.String) {
        const field = entry.String.find(s => s.Key === key);
        return field?.Value || '';
      }
      return entry[key] || entry[key.toLowerCase()] || '';
    };

    return {
      title: getString('Title') || entry.title || '',
      url: getString('URL') || entry.url || '',
      username: getString('UserName') || entry.username || '',
      password: getString('Password') || entry.password || '',
      notes: getString('Notes') || entry.notes || '',
      category: entry.Group || ''
    };
  }

  for (const entry of items) {
    const parsed = parseKeePassEntry(entry);

    if (!parsed.title && parsed.url) {
      try {
        parsed.title = new URL(parsed.url).hostname;
      } catch {
        parsed.title = parsed.url;
      }
    }

    if (parsed.username || parsed.password) {
      results.push(parsed);
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
  const settings = store.get('settings', {
    theme: 'dark',
    autoLockTime: 5,
    autostart: false,
    minimizeToTray: true
  });

  // Aktuelle Autostart-Einstellung aus System lesen
  const loginItemSettings = app.getLoginItemSettings();
  settings.autostart = loginItemSettings.openAtLogin;

  return settings;
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);

  // Autostart in Windows setzen
  if (settings.autostart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: settings.autostart,
      path: process.execPath,
      args: ['--hidden']
    });
  }

  return true;
});

// Autostart-Status abfragen
ipcMain.handle('get-autostart', () => {
  const loginItemSettings = app.getLoginItemSettings();
  return loginItemSettings.openAtLogin;
});

// Autostart setzen
ipcMain.handle('set-autostart', (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: enabled ? ['--hidden'] : []
  });
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

// ===== AUTOMATIC BACKUPS =====
const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');

// Ensure backup directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

// Create encrypted backup
ipcMain.handle('create-backup', async () => {
  if (!masterPassword) return { success: false, error: 'Tresor ist gesperrt' };

  try {
    ensureBackupDir();

    const backupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      passwords: store.get('passwords', []),
      notes: store.get('notes', []),
      cards: store.get('cards', []),
      settings: store.get('settings', {})
    };

    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(backupData),
      masterPassword
    ).toString();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mason-backup-${timestamp}.bak`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, encrypted);

    // Update last backup time
    const settings = store.get('settings', {});
    settings.lastBackup = new Date().toISOString();
    store.set('settings', settings);

    return { success: true, path: filepath, filename };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Restore from backup
ipcMain.handle('restore-backup', async () => {
  if (!masterPassword) return { success: false, error: 'Tresor ist gesperrt' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Backup wiederherstellen',
    defaultPath: BACKUP_DIR,
    filters: [
      { name: 'Mason Backup', extensions: ['bak'] },
      { name: 'Alle Dateien', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'Abgebrochen' };
  }

  try {
    const encrypted = fs.readFileSync(result.filePaths[0], 'utf-8');
    const decrypted = CryptoJS.AES.decrypt(encrypted, masterPassword);
    const jsonStr = decrypted.toString(CryptoJS.enc.Utf8);

    if (!jsonStr) {
      return { success: false, error: 'Falsches Passwort oder beschädigte Datei' };
    }

    const backupData = JSON.parse(jsonStr);

    // Restore data
    if (backupData.passwords) store.set('passwords', backupData.passwords);
    if (backupData.notes) store.set('notes', backupData.notes);
    if (backupData.cards) store.set('cards', backupData.cards);

    return {
      success: true,
      stats: {
        passwords: backupData.passwords?.length || 0,
        notes: backupData.notes?.length || 0,
        cards: backupData.cards?.length || 0
      }
    };
  } catch (e) {
    return { success: false, error: 'Backup konnte nicht gelesen werden: ' + e.message };
  }
});

// Get backup list
ipcMain.handle('get-backups', () => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.bak'))
      .map(f => {
        const filepath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          path: filepath,
          size: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
  } catch (e) {
    return [];
  }
});

// Delete old backups (keep last N)
ipcMain.handle('cleanup-backups', (event, keepCount = 5) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.bak'))
      .map(f => ({
        filename: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Delete files beyond keepCount
    const toDelete = files.slice(keepCount);
    toDelete.forEach(f => fs.unlinkSync(f.path));

    return { deleted: toDelete.length };
  } catch (e) {
    return { deleted: 0, error: e.message };
  }
});

// Open backup folder
ipcMain.handle('open-backup-folder', () => {
  ensureBackupDir();
  shell.openPath(BACKUP_DIR);
  return true;
});

// Auto backup on interval (called from renderer)
let autoBackupInterval = null;

ipcMain.handle('setup-auto-backup', (event, intervalHours) => {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }

  if (intervalHours > 0) {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    autoBackupInterval = setInterval(async () => {
      if (masterPassword) {
        const result = await createAutoBackup();
        if (result.success) {
          mainWindow.webContents.send('auto-backup-created', result);
        }
      }
    }, intervalMs);
  }

  return true;
});

async function createAutoBackup() {
  if (!masterPassword) return { success: false };

  try {
    ensureBackupDir();

    const backupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      auto: true,
      passwords: store.get('passwords', []),
      notes: store.get('notes', []),
      cards: store.get('cards', [])
    };

    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(backupData),
      masterPassword
    ).toString();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mason-auto-backup-${timestamp}.bak`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, encrypted);

    // Cleanup old auto-backups (keep last 10)
    const autoBackups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('mason-auto-backup-'))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    autoBackups.slice(10).forEach(f => fs.unlinkSync(f.path));

    return { success: true, filename };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
