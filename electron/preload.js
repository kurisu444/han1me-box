const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  closeApp: () => ipcRenderer.invoke('app:close'),
  onExitRequested: (listener) => {
    ipcRenderer.on('app:exit-requested', listener);
    return () => ipcRenderer.removeListener('app:exit-requested', listener);
  },
  chooseDirectory: (value) => ipcRenderer.invoke('directory:choose', value),
  normalizeDownloadPath: (value) => ipcRenderer.invoke('directory:normalize', value),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  fileExists: (file) => ipcRenderer.invoke('file:exists', file),
  comics: Object.fromEntries(
    ['entries', 'categories', 'cache', 'addCategory', 'deleteCategory', 'remove', 'extract'].map(
      (method) => [method, (...args) => ipcRenderer.invoke('comics:' + method, ...args)],
    ),
  ),
  backup: {
    export: (bundle) => ipcRenderer.invoke('backup:export', bundle),
    import: () => ipcRenderer.invoke('backup:import'),
  },
  downloads: {
    ...Object.fromEntries(
      [
        'state',
        'create',
        'updateGroup',
        'deleteGroup',
        'deleteTasks',
        'togglePinned',
        'setTaskGroups',
        'retry',
        'replace',
        'exportCompleted',
      ].map((method) => [method, (...args) => ipcRenderer.invoke('downloads:' + method, ...args)]),
    ),
    onChange: (listener) => {
      const callback = (_, state) => listener(state);
      ipcRenderer.on('downloads:changed', callback);
      return () => ipcRenderer.removeListener('downloads:changed', callback);
    },
  },
  session: {
    profile: (url) => ipcRenderer.invoke('session:profile', url),
    tags: (url, mode) => ipcRenderer.invoke('session:tags', url, mode),
    cookies: (url) => ipcRenderer.invoke('session:cookies', url),
    importCookies: (url, value) => ipcRenderer.invoke('session:import', url, value),
    clearCookies: (url) => ipcRenderer.invoke('session:clear', url),
    login: (url) => ipcRenderer.invoke('session:login', url),
    verify: (url) => ipcRenderer.invoke('session:verify', url),
  },
  store: {
    read: (fileName) => ipcRenderer.invoke('store:read', fileName),
    write: (fileName, value) => ipcRenderer.invoke('store:write', fileName, value),
  },
  http: {
    request: (...args) => ipcRenderer.invoke('http:request', ...args),
    fetch: (...args) => ipcRenderer.invoke('http:fetch', ...args),
  },
});
