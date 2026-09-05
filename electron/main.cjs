const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const url  = require('url');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

let mainWindow;

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

  const distPath = path.join(__dirname, '../dist/index.html');
  const startUrl = process.env.ELECTRON_START_URL
    ? process.env.ELECTRON_START_URL
    : url.format({ pathname: distPath, protocol: 'file:', slashes: true });

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
