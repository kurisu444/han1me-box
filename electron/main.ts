import { app, BrowserWindow, Menu, protocol } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { configureUserAgent, installRequestHeaders, registerLocalMediaProtocol } from './http';
import { getSettings } from './store';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'han1me-local',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
]);

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerLocalMediaProtocol();
  configureUserAgent();
  await registerIpc();

  const win = new BrowserWindow({
    frame: false,
    show: false,
    width: 1280,
    height: 800,
    icon: join(__dirname, '../assets/logo.png'),
    webPreferences: { preload: join(__dirname, 'preload.js') },
  });
  win.once('ready-to-show', () => win.show());
  const publishWindowState = () => win.webContents.send('window:maximized', win.isMaximized());
  win.on('maximize', publishWindowState);
  win.on('unmaximize', publishWindowState);
  installRequestHeaders(win.webContents.session, win.webContents, getSettings);

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  if (app.isPackaged) {
    await win.loadFile(join(__dirname, '../dist/index.html'));
  } else {
    await win.loadURL('http://localhost:5173');
  }
});

app.on('window-all-closed', () => app.quit());
