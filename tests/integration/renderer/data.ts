import * as repository from '../../../src/data/han1me_repository';
import { queryClient } from '../../../src/data/han1me_repository';
import * as api from '../../../src/data/remote/han1me_api';
import * as watch from '../../../src/data/local/watch_repository';
import * as accounts from '../../../src/data/local/account_store';
import { readHomeCache, writeHomeCache } from '../../../src/data/local/home_cache';
import { loadSettings, saveSettings } from '../../../src/app/settings_context';
import { get } from '../../../src/data/remote/han1me_http_client';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function rejects(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error('Expected rejection');
}

export async function run(baseUrl: string): Promise<string[]> {
  const passed: string[] = [];
  const test = async (name: string, fn: () => void | Promise<void>) => {
    await fn();
    passed.push(name);
  };
  await test('JSON defaults and settings persistence', async () => {
    const settings = await loadSettings();
    equal(settings.preferredQuality, 720);
    await saveSettings({ ...settings, preferredQuality: 1080 });
    equal((await loadSettings()).preferredQuality, 1080);
  });
  await test('Concurrent progress writes, six-item limit and history deletion', async () => {
    equal(await watch.readWatchState(), { continueItems: [], histories: [] });
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        watch.progress({
          id: String(index),
          title: `Video ${index}`,
          positionMs: -1,
          durationMs: 1000,
        }),
      ),
    );
    let state = await watch.readWatchState();
    equal(
      state.continueItems.map((item) => item.videoCode),
      ['7', '6', '5', '4', '3', '2'],
    );
    equal(state.continueItems[0].positionMs, 0);
    await Promise.all([
      watch.addTime('7', 'Video 7', 1000),
      watch.addTime('7', 'Video 7', 2000),
      watch.addTime('7', 'Video 7', 0),
    ]);
    state = await watch.readWatchState();
    equal(state.histories.length, 2);
    await watch.deleteHistories(new Set([state.histories[0].id]));
    equal((await watch.readWatchState()).histories[0].watchedMs, 2000);
  });
  await test('Accounts are isolated by host; activation, replace and removal', async () => {
    await accounts.writeAccount('https://example.com', {
      id: '1',
      cookie: 'fixture=1',
      name: 'First',
    });
    await accounts.writeAccount('https://example.com', { id: '2', cookie: 'fixture=2' });
    equal((await accounts.readAccount('https://example.com'))?.id, '2');
    equal(await accounts.readAllAccounts('https://other.example'), []);
    await accounts.writeAccount('https://example.com', {
      id: '1',
      cookie: 'fixture=1',
      name: 'Updated',
    });
    equal((await accounts.readAllAccounts('https://example.com')).length, 2);
    await accounts.activateAccount('https://example.com', '2');
    await accounts.removeAccount('https://example.com', '2');
    equal((await accounts.readAccount('https://example.com'))?.name, 'Updated');
  });
  await test('Native Session UA, cookies and redirects', async () => {
    const response = await get(`${baseUrl}/echo`);
    const info = JSON.parse(response.body);
    equal(info.ua, navigator.userAgent);
    equal(/Electron\/|han1me-box\//.test(info.ua), false);
    await get(`${baseUrl}/cookie`);
    equal(JSON.parse((await get(`${baseUrl}/echo`)).body).cookie.includes('fixture=present'), true);
    const redirected = await get(`${baseUrl}/redirect`);
    equal(redirected.body, 'redirect destination');
    equal(redirected.url, `${baseUrl}/home/`);
  });
  await test('Home DOM selectors, direct title text and relative image URLs', async () => {
    const feed = await queryClient.fetchQuery(repository.home(`${baseUrl}/home`));
    equal(feed.sections.length, 1);
    equal(feed.sections[0].title, 'Recent');
    equal(feed.sections[0].videos[0].views, '12万');
    equal(feed.sections[0].videos[0].rating, '98%');
    equal(feed.sections[0].videos[0].coverUrl, `${baseUrl}/cover.jpg`);
    equal(feed.featured?.id, '123');
    await Promise.all([
      writeHomeCache(baseUrl, undefined, feed),
      writeHomeCache(baseUrl, '7', { sections: [] }),
    ]);
    equal((await readHomeCache(baseUrl))?.sections.length, 1);
    equal((await readHomeCache(baseUrl, '7'))?.sections.length, 0);
    equal(await readHomeCache('https://different.example'), undefined);
  });
  await test('Video fields, hidden tags, deduplication, media rewrite and request coalescing', async () => {
    const counts = async () =>
      JSON.parse((await get(`${baseUrl}/request-counts`)).body)['/watch'] ?? 0;
    const before = await counts();
    const [detail, duplicate] = await Promise.all([
      queryClient.fetchQuery(repository.video(baseUrl, '123')),
      queryClient.fetchQuery(repository.video(baseUrl, '123')),
    ]);
    equal(duplicate, detail);
    equal(await counts(), before + 1);
    await queryClient.fetchQuery(repository.video(baseUrl, '123'));
    equal(await counts(), before + 2);
    equal(detail.title, 'Sample title');
    equal(detail.duration, '1:02:03');
    equal(detail.artist, 'Studio');
    equal(detail.uploader, 'Uploader');
    equal(detail.captionTitle, 'Caption title');
    equal(detail.description, 'Sample description');
    equal(detail.uploadDate, '2026-11-01');
    equal(detail.commentCount, 12);
    equal(
      detail.tags.map((tag) => tag.name),
      ['sample'],
    );
    equal(detail.playlist.length, 1);
    equal(detail.related[0].id, '456');
    equal(detail.sources[0].url, 'https://1497203185.rsc.cdn77.org/media.mp4');
  });
  await test('Source fallbacks and ISO duration parsing', () => {
    const html =
      '<meta itemprop="duration" content="PT2M3S"><script>const source = "https://example.com/a.mp4"; const player = {file:"https://example.com/b.m3u8"};</script>';
    const detail = api.parseVideo(
      new DOMParser().parseFromString(html, 'text/html'),
      baseUrl,
      '1',
      html,
    );
    equal(detail.duration, '02:03');
    equal(
      detail.sources.map((source) => source.url),
      ['https://example.com/b.m3u8', 'https://example.com/a.mp4'],
    );
    const preload = '<link rel="preload" as="video" href="/preload.mp4">';
    equal(
      api.parseVideo(new DOMParser().parseFromString(preload, 'text/html'), baseUrl, '1', preload)
        .sources[0].url,
      `${baseUrl}/preload.mp4`,
    );
  });
  await test('Comments in JSON and HTML, replies and action metadata', async () => {
    const page = await queryClient.fetchQuery(repository.comments(baseUrl, '123'));
    equal(page.csrfToken, 'fixture-token');
    equal(page.comments[0].id, '99');
    equal(page.comments[0].content, 'Sample comment');
    equal(page.comments[0].replyCount, 2);
    equal(page.comments[0].likesCount, 3);
    equal(page.comments[0].liked, true);
    equal((await queryClient.fetchQuery(repository.comments(baseUrl, 'html'))).comments.length, 1);
    equal(
      (await queryClient.fetchQuery(repository.replies(baseUrl, '99'))).comments[0].disliked,
      true,
    );
  });
  await test('CF challenge and HTTP errors are surfaced; failed requests can be retried', async () => {
    try {
      await queryClient.fetchQuery(repository.video(`${baseUrl}/challenge`, '1'));
      throw new Error('Challenge not detected');
    } catch (error) {
      equal(error instanceof api.CloudflareChallengeException, true);
    }
    await rejects(() => queryClient.fetchQuery(repository.video(`${baseUrl}/error`, '1')));
    const first = queryClient.fetchQuery(repository.video(`${baseUrl}/error`, '1'));
    await rejects(() => first);
    const retry = queryClient.fetchQuery(repository.video(`${baseUrl}/error`, '1'));
    equal(first === retry, false);
    await rejects(() => retry);
  });

  return passed;
}
