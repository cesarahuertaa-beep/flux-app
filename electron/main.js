const { app, BrowserWindow, shell, session } = require('electron');
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
    icon: path.join(__dirname, '../public/favicon.svg'),
    backgroundColor: '#F7F9FC',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  const distPath = path.join(__dirname, '../dist/index.html');
  const startUrl = process.env.ELECTRON_START_URL
    ? process.env.ELECTRON_START_URL + '/#/login'
    : url.format({ pathname: distPath, protocol: 'file:', slashes: true }) + '#/login';

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
  // FIX CORS: cuando la app corre desde file://, el Origin es null y Supabase lo rechaza.
  // Interceptamos las peticiones salientes a Supabase y ponemos un Origin válido.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://mciyywpqihnxhvqbznmq.supabase.co/*'] },
    function(details, callback) {
      details.requestHeaders['Origin'] = 'https://mciyywpqihnxhvqbznmq.supabase.co';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Permitir las respuestas CORS de Supabase aunque el Origin sea file://
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://mciyywpqihnxhvqbznmq.supabase.co/*'] },
    function(details, callback) {
      const headers = Object.assign({}, details.responseHeaders);
      headers['Access-Control-Allow-Origin'] = ['*'];
      headers['Access-Control-Allow-Headers'] = ['*'];
      callback({ responseHeaders: headers });
    }
  );

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
