import type { VideoDetail } from '../../domain/models/video';
import {
  createPlaylist as playlistModel,
  followingVideoToJson,
  followingVideoFromJson,
  subscribedArtistFromJson,
  playlistToJson,
  type FollowingVideo,
  type Playlist,
  type PlaylistSortOrder,
  type RemoteLibrary,
  type SubscribedArtist,
} from '../../domain/models/library';
import { readJsonStore, updateJsonStore, jsonRecords } from './json_store';
import { queryClient } from '../han1me_repository';
import { queryOptions, useQuery } from '@tanstack/react-query';
import * as accountApi from '../remote/account_api';

export interface LibraryState {
  watchLater: FollowingVideo[];
  favorites: FollowingVideo[];
  playlists: Playlist[];
  artists: SubscribedArtist[];
  subscriptionVideos: Record<string, FollowingVideo[]>;
}
type StoredLibrary = Partial<Omit<LibraryState, 'artists'>> & {
  subscribedArtists?: SubscribedArtist[];
};
export function libraryState(value: StoredLibrary = {}): LibraryState {
  return {
    watchLater: jsonRecords<FollowingVideo>(value.watchLater).map(followingVideoFromJson),
    favorites: jsonRecords<FollowingVideo>(value.favorites).map(followingVideoFromJson),
    playlists: jsonRecords<Playlist>(value.playlists).map((playlist) =>
      playlistModel({
        ...playlist,
        id: playlist.id ?? '',
        title: playlist.title ?? '',
        count: playlist.count ?? 0,
        videos: jsonRecords<FollowingVideo>(playlist.videos).map(followingVideoFromJson),
        sort: ['recentlyAdded', 'oldestAdded', 'title'].includes(playlist.sort ?? '')
          ? playlist.sort
          : 'recentlyAdded',
      }),
    ),
    artists: jsonRecords<SubscribedArtist>(value.subscribedArtists).map(subscribedArtistFromJson),
    subscriptionVideos: Object.fromEntries(
      Object.entries(value.subscriptionVideos ?? {}).map(([id, items]) => [
        id,
        jsonRecords<FollowingVideo>(items).map(followingVideoFromJson),
      ]),
    ),
  };
}
export function libraryToJson(state: LibraryState) {
  return {
    watchLater: state.watchLater.map(followingVideoToJson),
    favorites: state.favorites.map(followingVideoToJson),
    playlists: state.playlists.map(playlistToJson),
    subscribedArtists: state.artists,
    subscriptionVideos: Object.fromEntries(
      Object.entries(state.subscriptionVideos).map(([id, videos]) => [
        id,
        videos.map(followingVideoToJson),
      ]),
    ),
  };
}
export async function loadLibrary() {
  return libraryState(await readJsonStore<StoredLibrary>('following_store.json'));
}
async function update(change: (state: LibraryState) => LibraryState) {
  await updateJsonStore<StoredLibrary>('following_store.json', (value) => {
    const current = libraryState(value);
    const next = change(current);
    return next === current ? value : libraryToJson(next);
  });
  await queryClient.invalidateQueries({ queryKey: ['local-library'] });
}
export function followingVideo(video: VideoDetail): FollowingVideo {
  return {
    videoCode: video.id,
    title: video.title,
    coverUrl: video.coverUrl,
    artistName: video.artist,
    artistAvatarUrl: video.artistAvatarUrl,
    genre: video.genre,
    duration: video.duration,
    views: video.views,
    rating: video.rating,
    uploadTime: video.uploadDate,
    addedAt: Date.now(),
  };
}
export const artistId = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '_');
export function setWatchLater(video: VideoDetail, enabled: boolean) {
  return update((current) => ({
    ...current,
    watchLater: [
      ...(enabled ? [followingVideo(video)] : []),
      ...current.watchLater.filter((item) => item.videoCode !== video.id),
    ],
  }));
}
export function setFavorite(video: VideoDetail, enabled: boolean) {
  return update((current) => ({
    ...current,
    favorites: [
      ...(enabled ? [followingVideo(video)] : []),
      ...current.favorites.filter((item) => item.videoCode !== video.id),
    ],
  }));
}
export function removeFavorites(ids: Set<string>) {
  return update((current) => {
    const favorites = current.favorites.filter((item) => !ids.has(item.videoCode));
    return favorites.length === current.favorites.length ? current : { ...current, favorites };
  });
}
export function removeWatchLater(ids: Set<string>) {
  return update((current) => {
    const watchLater = current.watchLater.filter((item) => !ids.has(item.videoCode));
    return watchLater.length === current.watchLater.length ? current : { ...current, watchLater };
  });
}
export async function createPlaylist(title: string, description = '') {
  const id = crypto.randomUUID();
  await update((current) => ({
    ...current,
    playlists: [
      playlistModel({
        id,
        title,
        count: 0,
        description: description || undefined,
        createdAt: Date.now(),
      }),
      ...current.playlists,
    ],
  }));
  return id;
}
export function createPlaylistWithVideo(video: VideoDetail, title: string, description = '') {
  return update((current) => ({
    ...current,
    playlists: [
      playlistModel({
        id: crypto.randomUUID(),
        title,
        count: 1,
        coverUrl: video.coverUrl,
        videos: [followingVideo(video)],
        description: description || undefined,
        createdAt: Date.now(),
      }),
      ...current.playlists,
    ],
  }));
}
export function saveToPlaylist(video: VideoDetail, id: string) {
  return update((current) => ({
    ...current,
    playlists: current.playlists.map((playlist) => {
      if (playlist.id !== id) {
        return playlist;
      }
      const videos = [
        followingVideo(video),
        ...playlist.videos.filter((item) => item.videoCode !== video.id),
      ];
      return {
        ...playlist,
        videos,
        count: videos.length,
        coverUrl: video.coverUrl ?? playlist.coverUrl,
      };
    }),
  }));
}
export function updatePlaylist(id: string, title?: string, description?: string) {
  return update((current) => ({
    ...current,
    playlists: current.playlists.map((playlist) =>
      playlist.id !== id
        ? playlist
        : {
            ...playlist,
            title: title?.trim() || playlist.title,
            description: description?.trim() ?? playlist.description,
          },
    ),
  }));
}
export function setPlaylistSort(id: string, sort: PlaylistSortOrder) {
  return update((current) => ({
    ...current,
    playlists: current.playlists.map((playlist) =>
      playlist.id === id ? { ...playlist, sort } : playlist,
    ),
  }));
}
export function deletePlaylist(id: string) {
  return update((current) => {
    const playlists = current.playlists.filter((playlist) => playlist.id !== id);
    return playlists.length === current.playlists.length ? current : { ...current, playlists };
  });
}
export function removePlaylistVideos(id: string, ids: Set<string>) {
  return update((current) => ({
    ...current,
    playlists: current.playlists.map((playlist) => {
      if (playlist.id !== id) {
        return playlist;
      }
      const videos = playlist.videos.filter((item) => !ids.has(item.videoCode));
      return {
        ...playlist,
        videos,
        count: videos.length,
        coverUrl: videos.length ? playlist.coverUrl : undefined,
      };
    }),
  }));
}
export function setSubscription(video: VideoDetail, enabled: boolean) {
  const name = video.artist?.trim() ?? '';
  if (!name) {
    return Promise.resolve();
  }
  return update((current) => {
    const id = artistId(name);
    const artists = current.artists.filter((artist) => artist.id !== id);
    const subscriptionVideos = { ...current.subscriptionVideos };
    if (enabled) {
      artists.unshift({
        id,
        name,
        avatarUrl: video.artistAvatarUrl,
        genre: video.genre,
        addedAt: Date.now(),
      });
      subscriptionVideos[id] = [
        followingVideo(video),
        ...(subscriptionVideos[id] ?? []).filter((item) => item.videoCode !== video.id),
      ];
    } else {
      delete subscriptionVideos[id];
    }
    return { ...current, artists, subscriptionVideos };
  });
}
export function addSubscriptionVideo(video: VideoDetail) {
  return update((current) => {
    const name = video.artist?.trim() ?? '';
    const id = artistId(name);
    if (!name || !current.artists.some((artist) => artist.id === id)) {
      return current;
    }
    return {
      ...current,
      subscriptionVideos: {
        ...current.subscriptionVideos,
        [id]: [
          followingVideo(video),
          ...(current.subscriptionVideos[id] ?? []).filter((item) => item.videoCode !== video.id),
        ],
      },
    };
  });
}
export function cacheRemote(remote: RemoteLibrary) {
  return update((current) => ({
    ...current,
    watchLater: remote.watchLater,
    favorites: remote.favorites,
    playlists: remote.playlists,
    artists: remote.subscriptionArtists,
    subscriptionVideos: Object.fromEntries(
      remote.subscriptionArtists.map((artist) => [
        artistId(artist.name),
        remote.subscriptions.filter((video) => video.artistName === artist.name),
      ]),
    ),
  }));
}
export const replaceFavorites = (favorites: FollowingVideo[]) =>
  update((current) => ({ ...current, favorites }));
export const replaceLibrary = (value: LibraryState) => update(() => value);

export const remoteLibrary = (baseUrl: string, id: string) =>
  queryOptions({
    queryKey: ['han1me', 'library', baseUrl, id],
    queryFn: async () => {
      const library = await accountApi.library(baseUrl, id);
      await cacheRemote(library);
      return library;
    },
    staleTime: 300000,
    gcTime: 300000,
  });

export function useLibrary() {
  const resource = useQuery({ queryKey: ['local-library'], queryFn: loadLibrary });
  return resource.data ?? libraryState();
}
