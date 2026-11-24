import { ipcMain, shell, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { access } from 'node:fs/promises';
import type { AppSettings } from '../src/core/settings';
import type { DownloadGroupSort, DownloadState } from '../src/domain/models/download';
import type { VideoDetail, VideoSource } from '../src/domain/models/video';
import * as account from './account';
import * as backup from './backup';
import * as downloads from './downloads';
import * as http from './http';
import * as store from './store';
import * as windows from './windows';

export { getSettings } from './store';

const senderWindow = (event: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)!;

export async function registerIpc() {
  let settings = (await store.readStore('setting.json')) as Partial<AppSettings>;
  store.setSettings(settings);
  const downloadPath = await downloads.normalizeDownloadPath(settings.downloadPath);
  if (downloadPath !== settings.downloadPath) {
    settings = { ...settings, downloadPath };
    await store.writeStore('setting.json', settings);
  }
  await downloads.initialize(settings);

  ipcMain.handle('window:minimize', (event) => senderWindow(event).minimize());
  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = senderWindow(event);
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.handle('window:close', (event) => senderWindow(event).close());
  ipcMain.handle('window:is-maximized', (event) => senderWindow(event).isMaximized());
  ipcMain.handle('window:is-always-on-top', (event) => senderWindow(event).isAlwaysOnTop());
  ipcMain.handle('window:set-always-on-top', (event, value: boolean) => {
    const win = senderWindow(event);
    win.setAlwaysOnTop(value);
    return win.isAlwaysOnTop();
  });

  ipcMain.handle('player:open', (_event, payload: windows.PlayerOpenPayload) =>
    windows.openPlayerWindow(payload),
  );
  ipcMain.handle('player:take-local-video', (_event, id: string) => windows.takeLocalVideo(id));
  ipcMain.handle('player:take-queue', (_event, id: string) => windows.takeQueue(id));
  ipcMain.handle('player:focus-main', (_event, route?: string) => windows.focusMainWindow(route));

  ipcMain.handle('directory:choose', (_event, initialPath: string) =>
    downloads.chooseDirectory(initialPath),
  );
  ipcMain.handle('directory:normalize', (_event, value?: string) =>
    downloads.normalizeDownloadPath(value),
  );
  ipcMain.handle('external:open', (_event, url: string) => shell.openExternal(url));
  ipcMain.handle('file:exists', (_event, file: string) =>
    access(file).then(
      () => true,
      () => false,
    ),
  );

  ipcMain.handle('store:read', (_event, file: string) => store.readStore(file));
  ipcMain.handle('store:write', async (event, file: string, value: unknown) => {
    await store.writeStore(file, value);
    windows.broadcastStoreChange(event.sender, file, value);
    if (file === 'setting.json') {
      await downloads.initialize(store.getSettings());
    }
  });

  ipcMain.handle(
    'http:fetch',
    (_event, url: string, headers?: Record<string, string>, charset?: string) =>
      http.request(url, 'GET', headers, undefined, charset),
  );
  ipcMain.handle(
    'http:request',
    (
      _event,
      url: string,
      method: 'POST' | 'DELETE' | 'PUT',
      data: unknown,
      headers?: Record<string, string>,
      json?: boolean,
      charset?: string,
    ) =>
      http.request(
        url,
        method,
        {
          'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded',
          ...headers,
        },
        json
          ? JSON.stringify(data)
          : new URLSearchParams(data as Record<string, string>).toString(),
        charset,
      ),
  );

  ipcMain.handle('session:cookies', (_event, url: string) => account.cookies(url));
  ipcMain.handle('session:import', (_event, url: string, value: string) =>
    account.importCookies(url, value),
  );
  ipcMain.handle('session:clear', (_event, url: string) => account.clearCookies(url));
  ipcMain.handle('session:login', (event, url: string) => account.login(url, senderWindow(event)));
  ipcMain.handle('session:close-website', (event) => account.closeWebsite(senderWindow(event)));
  ipcMain.handle('session:profile', (event, url: string) =>
    account.openProfile(url, senderWindow(event)),
  );
  ipcMain.handle('session:verify', (event, url: string) =>
    account.openVerification(url, senderWindow(event)),
  );

  ipcMain.handle('downloads:state', () => downloads.getState());
  ipcMain.handle(
    'downloads:create',
    (_event, video: VideoDetail, source: VideoSource, groupId: string) =>
      downloads.create(video, source, groupId),
  );
  ipcMain.handle(
    'downloads:updateGroup',
    (_event, id: string, name: string, sort: DownloadGroupSort) =>
      downloads.updateGroup(id, name, sort),
  );
  ipcMain.handle('downloads:deleteGroup', (_event, id: string) => downloads.deleteGroup(id));
  ipcMain.handle('downloads:deleteTasks', (_event, ids: string[]) => downloads.deleteTasks(ids));
  ipcMain.handle('downloads:togglePinned', (_event, ids: string[]) => downloads.togglePinned(ids));
  ipcMain.handle('downloads:setTaskGroups', (_event, ids: string[], groups: string[]) =>
    downloads.setTaskGroups(ids, groups),
  );
  ipcMain.handle('downloads:retry', (_event, id: string, video: VideoDetail, source: VideoSource) =>
    downloads.retry(id, video, source),
  );
  ipcMain.handle('downloads:replace', (_event, value: DownloadState) => downloads.replace(value));
  ipcMain.handle('downloads:exportCompleted', (_event, destination?: string) =>
    downloads.exportCompleted(destination),
  );

  ipcMain.handle('backup:export', (_event, bundle: Record<string, unknown>) =>
    backup.exportBackup(bundle),
  );
  ipcMain.handle('backup:import', () => backup.importBackup());
}
