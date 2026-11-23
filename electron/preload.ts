import { contextBridge, ipcRenderer } from 'electron';
import type { ComicCacheEntry, ComicDetail } from '../src/domain/models/comic';
import type { DownloadGroupSort, DownloadState } from '../src/domain/models/download';
import type { PlaylistQueue, VideoDetail, VideoSource } from '../src/domain/models/video';
import type { BackupBundle } from '../src/features/settings/data_settings';

export interface Han1meHttpResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  url: string;
}

export type StoreFileName =
  | 'setting.json'
  | 'watch_store.json'
  | 'home_cache.json'
  | 'accounts.json'
  | 'search_history.json'
  | 'following_store.json'
  | 'comic_reader.json'
  | 'comic_library.json'
  | 'keyframes.json'
  | 'check_ins.json'
  | 'checkin_store.json';

const electronApi = {
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggle-maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximized: (listener: (maximized: boolean) => void): (() => void) => {
      const callback = (_event: unknown, maximized: boolean) => listener(maximized);
      ipcRenderer.on('window:maximized', callback);
      return () => ipcRenderer.removeListener('window:maximized', callback);
    },
    isAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:is-always-on-top'),
    setAlwaysOnTop: (value: boolean): Promise<boolean> =>
      ipcRenderer.invoke('window:set-always-on-top', value),
    onAlwaysOnTop: (listener: (alwaysOnTop: boolean) => void): (() => void) => {
      const callback = (_event: unknown, alwaysOnTop: boolean) => listener(alwaysOnTop);
      ipcRenderer.on('window:always-on-top', callback);
      return () => ipcRenderer.removeListener('window:always-on-top', callback);
    },
    onNavigate: (listener: (route: string) => void): (() => void) => {
      const callback = (_event: unknown, route: string) => listener(route);
      ipcRenderer.on('app:navigate', callback);
      return () => ipcRenderer.removeListener('app:navigate', callback);
    },
  },
  player: {
    open: (payload: {
      id: string;
      localVideo?: VideoDetail;
      queue?: PlaylistQueue;
    }): Promise<void> => ipcRenderer.invoke('player:open', payload),
    takeLocalVideo: (id: string): Promise<VideoDetail | undefined> =>
      ipcRenderer.invoke('player:take-local-video', id),
    takeQueue: (id: string): Promise<PlaylistQueue | undefined> =>
      ipcRenderer.invoke('player:take-queue', id),
    focusMain: (route?: string): Promise<void> => ipcRenderer.invoke('player:focus-main', route),
    onOpen: (
      listener: (payload: { id: string; localVideo?: VideoDetail; queue?: PlaylistQueue }) => void,
    ): (() => void) => {
      const callback = (
        _event: unknown,
        payload: { id: string; localVideo?: VideoDetail; queue?: PlaylistQueue },
      ) => listener(payload);
      ipcRenderer.on('player:open', callback);
      return () => ipcRenderer.removeListener('player:open', callback);
    },
  },
  chooseDirectory: (initialPath: string): Promise<string | undefined> =>
    ipcRenderer.invoke('directory:choose', initialPath),
  normalizeDownloadPath: (value: string): Promise<string> =>
    ipcRenderer.invoke('directory:normalize', value),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('external:open', url),
  fileExists: (file: string): Promise<boolean> => ipcRenderer.invoke('file:exists', file),

  comics: {
    entries: (): Promise<ComicCacheEntry[]> => ipcRenderer.invoke('comics:entries'),
    categories: (): Promise<string[]> => ipcRenderer.invoke('comics:categories'),
    cache: (detail: ComicDetail, category: string): Promise<void> =>
      ipcRenderer.invoke('comics:cache', detail, category),
    addCategory: (name: string): Promise<void> => ipcRenderer.invoke('comics:addCategory', name),
    deleteCategory: (name: string): Promise<void> =>
      ipcRenderer.invoke('comics:deleteCategory', name),
    remove: (entry: ComicCacheEntry): Promise<void> => ipcRenderer.invoke('comics:remove', entry),
    extract: (entry: ComicCacheEntry): Promise<string[]> =>
      ipcRenderer.invoke('comics:extract', entry),
  },

  backup: {
    export: (bundle: Record<string, unknown>): Promise<boolean> =>
      ipcRenderer.invoke('backup:export', bundle),
    import: (): Promise<BackupBundle | undefined> => ipcRenderer.invoke('backup:import'),
  },

  downloads: {
    state: (): Promise<DownloadState> => ipcRenderer.invoke('downloads:state'),
    create: (
      video: VideoDetail,
      source: VideoSource,
      groupId: string,
    ): Promise<'queued' | 'alreadyDownloaded' | 'alreadyQueued'> =>
      ipcRenderer.invoke('downloads:create', video, source, groupId),
    updateGroup: (id: string, name: string, sort: DownloadGroupSort): Promise<string | undefined> =>
      ipcRenderer.invoke('downloads:updateGroup', id, name, sort),
    deleteGroup: (id: string): Promise<void> => ipcRenderer.invoke('downloads:deleteGroup', id),
    deleteTasks: (ids: string[]): Promise<void> => ipcRenderer.invoke('downloads:deleteTasks', ids),
    togglePinned: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke('downloads:togglePinned', ids),
    setTaskGroups: (ids: string[], groups: string[]): Promise<void> =>
      ipcRenderer.invoke('downloads:setTaskGroups', ids, groups),
    retry: (id: string, video: VideoDetail, source: VideoSource): Promise<void> =>
      ipcRenderer.invoke('downloads:retry', id, video, source),
    replace: (value: DownloadState): Promise<void> =>
      ipcRenderer.invoke('downloads:replace', value),
    onChange: (listener: (state: DownloadState) => void): (() => void) => {
      const callback = (_event: unknown, state: DownloadState) => listener(state);
      ipcRenderer.on('downloads:changed', callback);
      return () => ipcRenderer.removeListener('downloads:changed', callback);
    },
    exportCompleted: (destination?: string): Promise<void> =>
      ipcRenderer.invoke('downloads:exportCompleted', destination),
  },

  session: {
    closeWebsite: (): Promise<void> => ipcRenderer.invoke('session:close-website'),
    onWebsiteChanged: (listener: (title: string | null) => void): (() => void) => {
      const callback = (_event: unknown, title: string | null) => listener(title);
      ipcRenderer.on('session:website-changed', callback);
      return () => ipcRenderer.removeListener('session:website-changed', callback);
    },
    profile: (url: string): Promise<void> => ipcRenderer.invoke('session:profile', url),
    cookies: (url: string): Promise<string> => ipcRenderer.invoke('session:cookies', url),
    importCookies: (url: string, value: string): Promise<void> =>
      ipcRenderer.invoke('session:import', url, value),
    clearCookies: (url: string): Promise<void> => ipcRenderer.invoke('session:clear', url),
    login: (url: string): Promise<boolean> => ipcRenderer.invoke('session:login', url),
    verify: (url: string): Promise<void> => ipcRenderer.invoke('session:verify', url),
  },

  store: {
    read: (fileName: StoreFileName): Promise<unknown> => ipcRenderer.invoke('store:read', fileName),
    write: (fileName: StoreFileName, value: unknown): Promise<void> =>
      ipcRenderer.invoke('store:write', fileName, value),
    onChange: (listener: (fileName: StoreFileName, value: unknown) => void): (() => void) => {
      const callback = (_event: unknown, fileName: StoreFileName, value: unknown) =>
        listener(fileName, value);
      ipcRenderer.on('store:changed', callback);
      return () => ipcRenderer.removeListener('store:changed', callback);
    },
  },

  http: {
    request: (
      url: string,
      method: 'POST' | 'DELETE' | 'PUT',
      data: unknown,
      headers?: Record<string, string>,
      json?: boolean,
      charset?: string,
    ): Promise<Han1meHttpResponse> =>
      ipcRenderer.invoke('http:request', url, method, data, headers, json, charset),
    fetch: (
      url: string,
      headers?: Record<string, string>,
      charset?: string,
    ): Promise<Han1meHttpResponse> => ipcRenderer.invoke('http:fetch', url, headers, charset),
  },
};

export type ElectronApi = typeof electronApi;

contextBridge.exposeInMainWorld('electron', electronApi);
