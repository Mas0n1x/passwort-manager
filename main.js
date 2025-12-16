const { app, BrowserWindow, ipcMain, clipboard, globalShortcut } = require('electron');
const path = require('path');
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
      return {
        id: entry.id,
        title: decrypt(entry.title, masterPassword),
        username: decrypt(entry.username, masterPassword),
        password: decrypt(entry.password, masterPassword),
        url: entry.url ? decrypt(entry.url, masterPassword) : '',
        notes: entry.notes ? decrypt(entry.notes, masterPassword) : '',
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

  passwords[index] = {
    ...passwords[index],
    title: encrypt(data.title, masterPassword),
    username: encrypt(data.username, masterPassword),
    password: encrypt(data.password, masterPassword),
    url: data.url ? encrypt(data.url, masterPassword) : null,
    notes: data.notes ? encrypt(data.notes, masterPassword) : null,
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
