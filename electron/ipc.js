const comicCache = require('./comic_cache');
const backup = require('./backup');
const downloads = require('./downloads');
const http = require('./http');
const { app, ipcMain, shell, session, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const account = require('./account');
let settings = {};

function configureSession() {
  const userAgent = app.userAgentFallback.replace(/\s+(?:han1me-box|Electron)\/\S+/g, '');
  app.userAgentFallback = userAgent;
  session.defaultSession.setUserAgent(userAgent);
  return userAgent;
}

async function readStore(file) {
  try {
    const value = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), file), 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

async function writeStore(file, value) {
  await fs.writeFile(path.join(app.getPath('userData'), file), JSON.stringify(value), 'utf8');
  if (file === 'setting.json') {
    settings = value;
    await downloads.initialize(value);
  }
}

function fetchHttp(url, headers, charset) {
  return http.request(url, 'GET', headers, undefined, charset);
}
function requestHttp(url, method, data, headers, json, charset) {
  return http.request(
    url,
    method,
    { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded', ...headers },
    json ? JSON.stringify(data) : new URLSearchParams(data).toString(),
    charset,
  );
}

async function registerIpc() {
  ipcMain.handle('directory:choose', (_event, initialPath) =>
    downloads.chooseDirectory(initialPath),
  );
  ipcMain.handle('directory:normalize', (_event, value) => downloads.normalizeDownloadPath(value));
  ipcMain.handle('external:open', (_event, url) => shell.openExternal(url));
  ipcMain.handle('file:exists', (_event, file) =>
    fs.access(file).then(
      () => true,
      () => false,
    ),
  );
  ipcMain.handle('session:tags', (event, url, mode) =>
    account.openTagEditor(url, mode, BrowserWindow.fromWebContents(event.sender)),
  );
  for (const method of [
    'entries',
    'categories',
    'cache',
    'addCategory',
    'deleteCategory',
    'remove',
    'extract',
  ])
    ipcMain.handle(`comics:${method}`, (_event, ...args) => comicCache[method](...args));
  ipcMain.handle('backup:export', (_event, bundle) => backup.exportBackup(bundle));
  ipcMain.handle('backup:import', () => backup.importBackup());
  settings = await readStore('setting.json');
  const downloadPath = await downloads.normalizeDownloadPath(settings.downloadPath);
  if (downloadPath !== settings.downloadPath) {
    settings = { ...settings, downloadPath };
    await fs.writeFile(
      path.join(app.getPath('userData'), 'setting.json'),
      JSON.stringify(settings),
    );
  }
  await downloads.initialize(settings);
  ipcMain.handle('downloads:state', () => downloads.getState());
  for (const method of [
    'create',
    'updateGroup',
    'deleteGroup',
    'deleteTasks',
    'togglePinned',
    'setTaskGroups',
    'retry',
    'replace',
    'exportCompleted',
  ])
    ipcMain.handle(`downloads:${method}`, (_event, ...args) => downloads[method](...args));
  ipcMain.handle('store:read', (_event, file) => readStore(file));
  ipcMain.handle('store:write', (_event, file, value) => writeStore(file, value));
  ipcMain.handle('http:request', (_event, ...args) => requestHttp(...args));
  ipcMain.handle('session:cookies', (_event, url) => account.cookies(url));
  ipcMain.handle('session:import', (_event, url, value) => account.importCookies(url, value));
  ipcMain.handle('session:clear', (_event, url) => account.clearCookies(url));
  ipcMain.handle('session:login', (event, url) =>
    account.login(url, BrowserWindow.fromWebContents(event.sender)),
  );
  ipcMain.handle('session:profile', (event, url) =>
    account.openProfile(url, BrowserWindow.fromWebContents(event.sender)),
  );
  ipcMain.handle('http:fetch', (_event, ...args) => fetchHttp(...args));
  ipcMain.handle('session:verify', (event, url) =>
    account.openVerification(url, BrowserWindow.fromWebContents(event.sender)),
  );
}

module.exports = {
  configureSession,
  registerIpc,
  readStore,
  writeStore,
  fetchHttp,
  getSettings: () => settings,
};
