export interface FollowingVideo {
  videoCode: string;
  title: string;
  coverUrl?: string;
  artistName?: string;
  artistAvatarUrl?: string;
  genre?: string;
  duration?: string;
  views?: string;
  rating?: string;
  uploadTime?: string;
  addedAt: number;
  playlistItemId?: string;
}

// playlistItemId 是远端操作使用的临时字段，不存入本地 JSON。
export function followingVideoToJson({
  playlistItemId,
  ...video
}: FollowingVideo): Omit<FollowingVideo, 'playlistItemId'> {
  return video;
}

export interface SubscribedArtist {
  id: string;
  name: string;
  avatarUrl?: string;
  genre?: string;
  addedAt: number;
}

export interface WatchProgress {
  videoCode: string;
  title: string;
  coverUrl?: string;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
}

export interface WatchHistory {
  id: string;
  videoCode: string;
  title: string;
  coverUrl?: string;
  watchedMs: number;
  date: string;
  createdAt: number;
}

export type PlaylistSortOrder = 'recentlyAdded' | 'oldestAdded' | 'title';

export interface Playlist {
  id: string;
  title: string;
  count: number;
  coverUrl?: string;
  videos: FollowingVideo[];
  description?: string;
  createdAt?: number;
  sort: PlaylistSortOrder;
}

export function createPlaylist(
  values: Pick<Playlist, 'id' | 'title' | 'count'> &
    Partial<Omit<Playlist, 'id' | 'title' | 'count'>>,
): Playlist {
  return { videos: [], sort: 'recentlyAdded', ...values };
}

export function playlistToJson(playlist: Playlist) {
  return { ...playlist, videos: playlist.videos.map(followingVideoToJson) };
}

export function sortPlaylistVideos(
  order: PlaylistSortOrder,
  videos: FollowingVideo[],
): FollowingVideo[] {
  const items = [...videos];
  if (order === 'title') {
    items.sort((left, right) => {
      const a = left.title.toLowerCase();
      const b = right.title.toLowerCase();
      return a < b ? -1 : a > b ? 1 : 0;
    });
  } else if (order === 'oldestAdded') {
    items.sort((left, right) => left.addedAt - right.addedAt);
  } else {
    items.sort((left, right) => right.addedAt - left.addedAt);
  }
  return items;
}

export interface PlaylistDetail {
  playlist: Playlist;
  author?: string;
  description?: string;
  viewCount?: number;
  videos: FollowingVideo[];
}

export interface RemoteLibrary {
  watchLater: FollowingVideo[];
  favorites: FollowingVideo[];
  playlists: Playlist[];
  subscriptionArtists: SubscribedArtist[];
  subscriptions: FollowingVideo[];
  history: FollowingVideo[];
  csrfToken?: string;
}

export function followingVideoFromJson(value: Partial<FollowingVideo>): FollowingVideo {
  const { playlistItemId, ...persisted } = value;
  return {
    ...persisted,
    videoCode: value.videoCode ?? '',
    title: value.title ?? '',
    addedAt: value.addedAt ?? 0,
  };
}
export function subscribedArtistFromJson(value: Partial<SubscribedArtist>): SubscribedArtist {
  return { ...value, id: value.id ?? '', name: value.name ?? '', addedAt: value.addedAt ?? 0 };
}
export function watchProgressFromJson(value: Partial<WatchProgress>): WatchProgress {
  return {
    ...value,
    videoCode: value.videoCode ?? '',
    title: value.title ?? '',
    positionMs: value.positionMs ?? 0,
    durationMs: value.durationMs ?? 0,
    updatedAt: value.updatedAt ?? 0,
  };
}
export function watchHistoryFromJson(value: Partial<WatchHistory>): WatchHistory {
  return {
    id: value.id ?? '',
    videoCode: value.videoCode ?? '',
    title: value.title ?? '',
    coverUrl: value.coverUrl,
    watchedMs: value.watchedMs ?? 0,
    date: value.date ?? '',
    createdAt: value.createdAt ?? 0,
  };
}
