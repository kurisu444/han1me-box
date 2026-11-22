interface Han1meHttpResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  url: string;
}

type StoreFileName =
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

interface Window {
  electron: {
    closeApp(): Promise<void>;
    onExitRequested(listener: () => void): () => void;
    chooseDirectory(initialPath: string): Promise<string | undefined>;
    normalizeDownloadPath(value: string): Promise<string>;
    openExternal(url: string): Promise<void>;
    fileExists(file: string): Promise<boolean>;
    comics: {
      entries(): Promise<import('./domain/models/comic').ComicCacheEntry[]>;
      categories(): Promise<string[]>;
      cache(detail: import('./domain/models/comic').ComicDetail, category: string): Promise<void>;
      addCategory(name: string): Promise<void>;
      deleteCategory(name: string): Promise<void>;
      remove(entry: import('./domain/models/comic').ComicCacheEntry): Promise<void>;
      extract(entry: import('./domain/models/comic').ComicCacheEntry): Promise<string[]>;
    };
    backup: {
      export(bundle: Record<string, unknown>): Promise<boolean>;
      import(): Promise<import('./features/settings/data_settings').BackupBundle | undefined>;
    };
    downloads: {
      state(): Promise<import('./domain/models/download').DownloadState>;
      create(
        video: import('./domain/models/video').VideoDetail,
        source: import('./domain/models/video').VideoSource,
        groupId: string,
      ): Promise<'queued' | 'alreadyDownloaded' | 'alreadyQueued'>;
      updateGroup(
        id: string,
        name: string,
        sort: import('./domain/models/download').DownloadGroupSort,
      ): Promise<string | undefined>;
      deleteGroup(id: string): Promise<void>;
      deleteTasks(ids: string[]): Promise<void>;
      togglePinned(ids: string[]): Promise<void>;
      setTaskGroups(ids: string[], groups: string[]): Promise<void>;
      retry(
        id: string,
        video: import('./domain/models/video').VideoDetail,
        source: import('./domain/models/video').VideoSource,
      ): Promise<void>;
      replace(value: import('./domain/models/download').DownloadState): Promise<void>;
      onChange(
        listener: (state: import('./domain/models/download').DownloadState) => void,
      ): () => void;
      exportCompleted(destination?: string): Promise<void>;
    };
    session: {
      profile(url: string): Promise<void>;
      tags(url: string, mode: 'add' | 'remove'): Promise<void>;
      cookies(url: string): Promise<string>;
      importCookies(url: string, value: string): Promise<void>;
      clearCookies(url: string): Promise<void>;
      login(url: string): Promise<boolean>;
      verify(url: string): Promise<void>;
    };
    store: {
      read(fileName: StoreFileName): Promise<unknown>;
      write(fileName: StoreFileName, value: unknown): Promise<void>;
    };
    http: {
      request(
        url: string,
        method: 'POST' | 'DELETE' | 'PUT',
        data: unknown,
        headers?: Record<string, string>,
        json?: boolean,
        charset?: string,
      ): Promise<Han1meHttpResponse>;
      fetch(
        url: string,
        headers?: Record<string, string>,
        charset?: string,
      ): Promise<Han1meHttpResponse>;
    };
  };
}
