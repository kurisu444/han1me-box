export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed';
export type DownloadGroupSort = 'defaultOrder' | 'recentlyUpdated' | 'name';
export interface DownloadGroup {
  id: string;
  name: string;
  createdAt: number;
  sort: DownloadGroupSort;
}
export interface DownloadTask {
  id: string;
  videoCode: string;
  title: string;
  groupIds: string[];
  quality: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  coverUrl?: string;
  duration?: string;
  views?: string;
  rating?: string;
  uploadTime?: string;
  sourceUrl?: string;
  localVideoPath?: string;
  localCoverPath?: string;
  localMetaPath?: string;
  localCommentPath?: string;
  errorMessage?: string;
}
export interface DownloadState {
  groups: DownloadGroup[];
  tasks: DownloadTask[];
}

export const localMediaUrl = (path: string) =>
  `han1me-local://media/?${new URLSearchParams({ path })}`;
