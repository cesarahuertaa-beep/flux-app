const { app, BrowserWindow, shell, protocol } = require('electron');
const path = require('path');
const fs   = require('fs');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

let mainWindow;

// Registrar protocolo app:// ANTES de que la app este lista
// Esto sirve los archivos del dist/ con un origen real (no file://)
// y permite que fetch() funcione correctamente hacia Supabase.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 375, minHeight: 600,
    title: 'FLUX',
    backgroundColor: '#F7F9FC',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  const startUrl = process.env.ELECTRON_START_URL
    ? process.env.ELECTRON_START_URL + '/#/login'
    : 'app://flux/#/login';

  mainWindow.loadURL(startUrl);
  mainWindow.once('ready-to-show', function() { mainWindow.show(); });

  mainWindow.webContents.setWindowOpenHandler(function(details) {
    if (details.url.startsWith('http')) {
      shell.openExternal(details.url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', function() { mainWindow = null; });
}

app.whenReady().then(function() {
  // Servir el dist/ bajo app://flux/
  const distDir = path.join(__dirname, '../dist');
  protocol.registerFileProtocol('app', function(request, callback) {
    let filePath = request.url.slice('app://flux'.length) || '/index.html';
    // Quitar el hash y query
    filePath = filePath.split('#')[0].split('?')[0];
    if (!filePath || filePath === '/') filePath = '/index.html';
    const fullPath = path.join(distDir, filePath);
    // Si el archivo existe, servirlo; si no, servir index.html (SPA fallback)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      callback({ path: fullPath });
    } else {
      callback({ path: path.join(distDir, 'index.html') });
    }
  });

  createWindow();
  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', function() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
