import { app, BrowserWindow, Menu, protocol, session } from 'electron';
import { registerIpc } from './ipc';
import { configureUserAgent, installRequestHeaders, registerLocalMediaProtocol } from './http';
import { getSettings } from './store';
import { createMainWindow } from './windows';

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

  installRequestHeaders(
    session.defaultSession,
    (id) => BrowserWindow.getAllWindows().find((win) => win.webContents.id === id)?.webContents,
    getSettings,
  );

  await createMainWindow();
});

app.on('window-all-closed', () => app.quit());
