import { app, BrowserWindow, Menu, nativeImage, protocol, session, Tray } from 'electron';
import { join } from 'node:path';
import { configureUserAgent, installRequestHeaders, registerLocalMediaProtocol } from './http';
import { registerIpc } from './ipc';
import { getSettings } from './store';
import { createMainWindow, focusMainWindow, markQuitting } from './windows';

let tray: Tray | undefined;

function createTray(): void {
  const icon = nativeImage
    .createFromPath(join(__dirname, '../assets/logo.png'))
    .resize({ width: 22, height: 22 });
  tray = new Tray(icon);
  tray.setToolTip('Han1meBox');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '首页', click: () => void focusMainWindow('/') },
      { label: '设置', click: () => void focusMainWindow('/settings') },
      { type: 'separator' },
      {
        label: '退出应用',
        click: () => {
          markQuitting();
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => void focusMainWindow());
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'han1me-local',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    void focusMainWindow();
  });

  app.on('before-quit', () => {
    markQuitting();
  });

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

    createTray();
    await createMainWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
