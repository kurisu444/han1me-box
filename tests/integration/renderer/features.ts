import { run as dataChecks } from './data';
import * as account from '../../../src/data/remote/account_api';
import * as comics from '../../../src/data/remote/comic_api';
import * as getchu from '../../../src/data/remote/getchu_api';
import { previews } from '../../../src/data/remote/preview_api';
import { translateVideo } from '../../../src/data/remote/google_translate_api';
import * as webdav from '../../../src/data/local/webdav_sync_service';
import * as keyframes from '../../../src/data/local/keyframe_repository';
import { createAppSettings } from '../../../src/core/settings';

const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
export async function run(base: string) {
  const passed = await dataChecks(base);
  const changed = new Promise<import('../../../src/domain/models/download').DownloadState>(
    (resolve) => {
      const unsubscribe = window.electron.downloads.onChange((state) => {
        unsubscribe();
        resolve(state);
      });
    },
  );
  const groupId = await window.electron.downloads.updateGroup('', 'IPC event fixture', 'name');
  equal(
    (await changed).groups.some((group) => group.id === groupId),
    true,
  );
  await window.electron.downloads.deleteGroup(groupId!);
  passed.push('Download IPC notifications carry state without a renderer reload');
  const profile = await account.account(base);
  equal(profile.id, '7');
  equal(profile.name, 'Fixture User');
  equal(profile.email, 'fixture@example.test');
  const watchLaterPage1 = await account.watchLaterPage(base, '7', 1);
  const watchLaterPage2 = await account.watchLaterPage(base, '7', 2);
  equal(
    [...watchLaterPage1.items, ...watchLaterPage2.items].map((item) => item.videoCode),
    ['123', '456'],
  );
  const favoritesPage1 = await account.favoritesPage(base, '7', 1);
  const favoritesPage2 = await account.favoritesPage(base, '7', 2);
  equal([...favoritesPage1.items, ...favoritesPage2.items].length, 2);
  const playlists = await account.playlistsPage(base, '7', 1);
  equal(playlists.items[0].id, '9');
  const subscriptions = await account.subscriptionsPage(base, 1);
  equal(subscriptions.artists[0].name, 'Studio');
  const playlist = await account.playlist(base, '9', 'popular');
  equal(playlist.videos[0].playlistItemId, '8');
  equal(playlist.playlist.title, 'Fixture list');
  passed.push('Account, paginated library, subscription and playlist DOM parsers');
  await account.setFavorite(base, 'token', '7', '123', true);
  await account.saveToPlaylist(base, 'token', 'save', '123', false);
  await account.setSubscription(base, 'token', '7', '4', true);
  await account.createPlaylist(base, 'token', '123', 'List', 'Description');
  await account.updatePlaylist(base, 'token', '9', 'New', 'Description');
  await account.deletePlaylist(base, 'token', '9');
  await account.removePlaylistItem(base, 'token', '8');
  await account.deleteHistory(base, 'token', '123');
  await account.postComment(base, 'token', '7', 'preview', '202610', 'Hello');
  await account.replyComment(base, 'token', '99', 'Reply');
  const comment = {
    id: '99',
    content: 'Fixture',
    username: 'Fixture',
    foreignId: '99',
    likeUserId: '7',
    liked: false,
    disliked: false,
    hasMoreReplies: false,
  };
  await account.voteComment(base, 'token', comment, true);
  await account.reportComment(base, 'token', '7', comment, 'spam');
  await account.updateProfile(base, '7', 'token', 'New', 'new@example.test');
  await account.updatePassword(base, '7', 'token', 'old', 'new', 'new');
  const captured = JSON.parse((await window.electron.http.fetch(base + '/captured')).body);
  equal(captured.find((r: any) => r.path === '/save').body.is_checked, 'false');
  equal(captured.find((r: any) => r.path === '/createComment').body['comment-type'], 'preview');
  equal(captured.filter((r: any) => r.path === '/like').length, 2);
  equal(captured.filter((r: any) => r.path === '/like')[1].body._token, 'fresh-token');
  equal(captured.find((r: any) => r.path === '/playlist/items/8').method, 'DELETE');
  equal(captured.find((r: any) => r.body.type === 'password').body.password_new_confirm, 'new');
  passed.push('All account writes preserve form fields, CSRF 419 refresh and DELETE semantics');
  const historical = await previews(base, '202001');
  equal(historical.items[0].brand, 'Studio');
  equal(historical.items[0].previewImages.length, 1);
  const feed = await comics.home();
  equal(feed.trending[0].id, '88');
  equal(feed.latest.length, 1);
  const browse = await comics.browse('/comics', 2);
  equal(browse.totalPages, 3);
  const comic = await comics.detail('88');
  equal(comic.imageUrls, ['http://images.test/1.webp', 'http://images.test/2.jpg']);
  equal(comic.artist, 'Artist');
  equal(comic.tags[0].type, '作者');
  const getchuFeed = await getchu.previews('202610');
  equal(getchuFeed.groups[0].items[0].id, '555');
  const detail = await getchu.detail('555');
  equal(detail.title, 'Fixture Product');
  equal(detail.brand, 'Studio');
  equal(detail.videoUrls.length, 1);
  equal(detail.seriesItems[0].id, '556');
  equal(detail.sampleImages.length, 1);
  equal(detail.price, '¥1200');
  const translation = await translateVideo(
    {
      id: '1',
      title: 'Title',
      captionTitle: 'Caption',
      description: 'Description',
      sources: [],
      tags: [],
      related: [],
      playlist: [],
    },
    'en',
  );
  equal(translation, {
    title: 'Translated Title',
    captionTitle: 'Translated Caption',
    description: 'Translated Description',
  });
  passed.push(
    'Site previews, Getchu JSON-LD/series, comic reader extensions and translation segments',
  );
  const settings = createAppSettings({
    webDavUrl: base + '/dav/?key=fixture',
    webDavUsername: '用户',
    webDavPassword: '密码',
  });
  const synced = await webdav.syncWatchState(settings, {
    continueItems: [
      { videoCode: '1', title: 'Local', positionMs: 1, durationMs: 10000, updatedAt: 1 },
    ],
    histories: [],
  });
  equal(synced.continueItems[0].title, 'Remote');
  const favorites = await webdav.syncFavorites(settings, [
    { videoCode: '1', title: 'Local', addedAt: 3, playlistItemId: 'temporary' },
  ]);
  equal(favorites[0].title, 'Local');
  const writes = JSON.parse((await window.electron.http.fetch(base + '/captured')).body);
  const put = writes.find(
    (r: any) => r.path.endsWith('han1me-box-favorites.json') && r.method === 'PUT',
  );
  equal(put.body[0].playlistItemId, undefined);
  equal(put.authorization, 'Basic ' + btoa(unescape(encodeURIComponent('用户:密码'))));
  passed.push('WebDAV GET/PUT, UTF-8 credentials, newest entry merge and portable favorites');
  await window.electron.store.write('keyframes.json', { legacy: [20000, 1000] });
  equal(await keyframes.load('legacy'), [1000, 20000]);
  equal(await keyframes.add('legacy', 19000), false);
  equal(await keyframes.add('legacy', 40000, 'Title'), true);
  equal(await keyframes.updatePosition('legacy', 40000, 5000), false);
  equal(await keyframes.updatePosition('legacy', 40000, 50000), true);
  await keyframes.remove('legacy', 1000);
  await keyframes.setTitle('legacy', 'Renamed');
  equal((await keyframes.loadVideos())[0], {
    id: 'legacy',
    title: 'Renamed',
    positions: [20000, 50000],
  });
  await keyframes.deleteVideo('legacy');
  equal(await keyframes.loadVideos(), []);
  passed.push('Keyframe legacy JSON, 10-second spacing, editing, title and deletion');
  return passed;
}
