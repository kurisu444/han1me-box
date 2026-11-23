import { app, BrowserWindow, type WebContents } from 'electron';
import { join } from 'node:path';
import type { PlaylistQueue, VideoDetail } from '../src/domain/models/video';
import { getSettings } from './store';

export interface PlayerOpenPayload {
  id: string;
  localVideo?: VideoDetail;
  queue?: PlaylistQueue;
}

let mainWindow: BrowserWindow | undefined;
let playerWindow: BrowserWindow | undefined;
let quitting = false;
const pendingLocalVideos = new Map<string, VideoDetail>();
const pendingQueues = new Map<string, PlaylistQueue>();

export function markQuitting(): void {
  quitting = true;
}

function bindWindowEvents(win: BrowserWindow) {
  const publishMaximized = () => win.webContents.send('window:maximized', win.isMaximized());
  const publishAlwaysOnTop = () =>
    win.webContents.send('window:always-on-top', win.isAlwaysOnTop());

  win.once('ready-to-show', () => win.show());
  win.on('maximize', publishMaximized);
  win.on('unmaximize', publishMaximized);
  win.on('always-on-top-changed', publishAlwaysOnTop);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
}

async function loadAppRoute(win: BrowserWindow, hash: string, search = '') {
  if (app.isPackaged) {
    await win.loadFile(join(__dirname, '../dist/index.html'), {
      search: search || undefined,
      hash: hash || undefined,
    });
  } else {
    const query = search ? `?${search}` : '';
    const fragment = hash ? `#${hash}` : '';
    await win.loadURL(`http://localhost:5173/${query}${fragment}`);
  }
}

export async function createMainWindow(initialRoute?: string): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    frame: false,
    show: false,
    width: 1280,
    height: 800,
    icon: join(__dirname, '../assets/logo.png'),
    webPreferences: { preload: join(__dirname, 'preload.js') },
  });
  mainWindow = win;
  win.on('close', (event) => {
    if (!quitting && getSettings().minimizeToTray) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = undefined;
    }
  });
  bindWindowEvents(win);
  await loadAppRoute(win, initialRoute ?? '');
  return win;
}

export async function openPlayerWindow(payload: PlayerOpenPayload): Promise<void> {
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send('player:open', payload);
    if (playerWindow.isMinimized()) {
      playerWindow.restore();
    }
    playerWindow.show();
    playerWindow.focus();
    return;
  }

  if (payload.localVideo) {
    pendingLocalVideos.set(payload.id, payload.localVideo);
  }
  if (payload.queue) {
    pendingQueues.set(payload.id, payload.queue);
  }
  const win = new BrowserWindow({
    frame: false,
    show: false,
    width: 1240,
    height: 760,
    minWidth: 820,
    minHeight: 540,
    backgroundColor: '#000000',
    icon: join(__dirname, '../assets/logo.png'),
    webPreferences: { preload: join(__dirname, 'preload.js') },
  });
  playerWindow = win;
  win.on('closed', () => {
    if (playerWindow === win) {
      playerWindow = undefined;
    }
  });
  bindWindowEvents(win);
  const queryParams = new URLSearchParams();
  if (payload.localVideo) {
    queryParams.set('local', '1');
  }
  if (payload.queue) {
    queryParams.set('queue', '1');
  }
  const query = queryParams.size ? `?${queryParams}` : '';
  await loadAppRoute(win, `/video/${encodeURIComponent(payload.id)}${query}`, 'window=player');
}

export function takeLocalVideo(id: string): VideoDetail | undefined {
  const video = pendingLocalVideos.get(id);
  pendingLocalVideos.delete(id);
  return video;
}

export function takeQueue(id: string): PlaylistQueue | undefined {
  const queue = pendingQueues.get(id);
  pendingQueues.delete(id);
  return queue;
}

export async function focusMainWindow(route?: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createMainWindow(route);
    return;
  }
  if (route) {
    mainWindow.webContents.send('app:navigate', route);
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

export function broadcastStoreChange(sender: WebContents, file: string, value: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents.id !== sender.id) {
      win.webContents.send('store:changed', file, value);
    }
  }
}
