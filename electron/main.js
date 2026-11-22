const { app, BrowserWindow, Menu, protocol, ipcMain } = require('electron');
const path = require('node:path');
const { configureSession, registerIpc } = require('./ipc');
const { installRequestHeaders, registerLocalMediaProtocol } = require('./http');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'han1me-local',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
]);
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerLocalMediaProtocol();
  configureSession();
  await registerIpc();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../assets/logo.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  installRequestHeaders(win.webContents.session, win.webContents);
  function requestExit(event) {
    event.preventDefault();
    win.webContents.send('app:exit-requested');
  }
  win.on('close', requestExit);
  ipcMain.handle('app:close', () => {
    win.removeListener('close', requestExit);
    win.close();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
});

app.on('window-all-closed', () => app.quit());
