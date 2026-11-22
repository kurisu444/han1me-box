import type {
  ElectronApi,
  Han1meHttpResponse as PreloadHttpResponse,
  StoreFileName as PreloadStoreFileName,
} from '../electron/preload';

declare global {
  type Han1meHttpResponse = PreloadHttpResponse;
  type StoreFileName = PreloadStoreFileName;
  interface Window {
    electron: ElectronApi;
  }
}
