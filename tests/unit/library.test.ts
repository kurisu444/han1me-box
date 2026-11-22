import assert from 'node:assert/strict';
import * as library from '../../src/data/local/library_repository';
import type { VideoDetail } from '../../src/domain/models/video';
const store = new Map<string, unknown>();
globalThis.window = {
  electron: {
    store: {
      read: async (file: string) => structuredClone(store.get(file) ?? {}),
      write: async (file: string, value: unknown) => {
        store.set(file, structuredClone(value));
      },
    },
  },
} as unknown as Window & typeof globalThis;
const video: VideoDetail = {
  id: '1',
  title: 'First',
  artist: ' Test Author ',
  coverUrl: '/cover.jpg',
  sources: [],
  tags: [],
  playlist: [],
  related: [],
};
const other = { ...video, id: '2', title: 'Second' };
await library.setFavorite(video, true);
await library.setFavorite(video, true);
await library.setWatchLater(video, true);
assert.equal((await library.loadLibrary()).favorites.length, 1);
await library.removeFavorites(new Set(['1']));
assert.equal((await library.loadLibrary()).favorites.length, 0);
const id = await library.createPlaylist('Saved', 'description');
await library.saveToPlaylist(video, id);
await library.saveToPlaylist(other, id);
await library.saveToPlaylist(video, id);
let playlist = (await library.loadLibrary()).playlists[0];
assert.equal(playlist.count, 2);
assert.deepEqual(
  playlist.videos.map((item) => item.videoCode),
  ['1', '2'],
);
await library.setPlaylistSort(id, 'title');
await library.updatePlaylist(id, '  Changed  ', '');
await library.removePlaylistVideos(id, new Set(['1', '2']));
playlist = (await library.loadLibrary()).playlists[0];
assert.equal(playlist.count, 0);
assert.equal(playlist.coverUrl, undefined);
assert.equal(playlist.title, 'Changed');
assert.equal(playlist.description, '');
assert.equal(playlist.sort, 'title');
await library.setSubscription(video, true);
await library.addSubscriptionVideo(other);
let state = await library.loadLibrary();
assert.equal(state.artists[0].id, 'test_author');
assert.deepEqual(
  state.subscriptionVideos.test_author.map((item) => item.videoCode),
  ['2', '1'],
);
await library.setSubscription(video, false);
state = await library.loadLibrary();
assert.equal(state.artists.length, 0);
assert.equal(state.subscriptionVideos.test_author, undefined);
await library.deletePlaylist(id);
assert.equal((await library.loadLibrary()).playlists.length, 0);
console.log(
  'PASS library persistence, playlist count/cover/sort, duplicate handling and subscription archive',
);
