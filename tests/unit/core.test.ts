import assert from 'node:assert/strict';
import test from 'node:test';
import { hanimeSiteHosts, siteHomeUrl, siteEndpointUrl } from '../../src/core/site_url.ts';
import {
  createAppSettings,
  appSettingsFromJson,
  mirrorActive,
  homeBaseUrl,
  resolvedBaseUrl,
  resolvedLibraryTabOrder,
  normalizeMirrorUrl,
} from '../../src/core/settings.ts';
import {
  videoAspectRatio,
  isPortraitVideo,
  isPortraitVideoAspectRatio,
  playerHeightLimit,
} from '../../src/core/video_metrics.ts';
import { parseVideoViewCount, meetsMinimumVideoViews } from '../../src/core/video_view_count.ts';

test('首页及接口 URL 保留镜像子路径', () => {
  for (const [base, home, endpoint] of [
    ['', '', ''],
    ['https://example.com', 'https://example.com/', 'https://example.com/watch?v=123'],
    ['https://example.com///', 'https://example.com/', 'https://example.com/watch?v=123'],
    [
      'https://example.com/mirror///',
      'https://example.com/mirror',
      'https://example.com/mirror/watch?v=123',
    ],
    ['/', '/', '/watch?v=123'],
    ['example.com', 'example.com', 'example.com/watch?v=123'],
    ['//example.com', '//example.com/', '//example.com/watch?v=123'],
  ]) {
    assert.equal(siteHomeUrl(base), home);
    assert.equal(siteEndpointUrl(base, '///watch?v=123'), endpoint);
  }
  assert.equal(siteEndpointUrl('https://example.com/mirror/', '  '), 'https://example.com/mirror');
  assert.equal(hanimeSiteHosts.size, 6);
  assert.equal(hanimeSiteHosts.has('hanime1.me'), true);
  assert.equal(hanimeSiteHosts.has('hanime1.me.example.com'), false);
});

test('默认配置保持原值，每次创建拥有独立数组', () => {
  const settings = createAppSettings();
  assert.equal(settings.baseUrl, 'https://hanime1.me');
  assert.equal(settings.preferredQuality, 720);
  assert.equal(settings.resumePlayback, true);
  assert.equal(settings.autoPlayOnOpen, true);
  assert.equal(settings.defaultPlaybackSpeed, 1);
  assert.equal(settings.commentsEnabled, true);
  assert.equal(settings.showHomeFeatured, true);
  assert.equal(settings.skipSeconds, 80);
  assert.deepEqual(appSettingsFromJson({}), settings);
  settings.homeSectionOrder.push('test');
  assert.deepEqual(createAppSettings().homeSectionOrder, []);
});

test('切换主站与镜像时，首页路径与接口路径分别遵循原配置', () => {
  const settings = createAppSettings({ baseUrl: 'https://hanime1.com' });
  assert.equal(homeBaseUrl(settings), 'https://hanime1.com');
  assert.equal(resolvedBaseUrl(settings), 'https://hanime1.com');
  assert.equal(mirrorActive({ ...settings, useCustomMirrorSite: true }), false);
  const mirror = {
    ...settings,
    useCustomMirrorSite: true,
    customMirrorSite: 'https://example.com:8443/mirror',
  };
  assert.equal(mirrorActive(mirror), true);
  assert.equal(homeBaseUrl(mirror), mirror.customMirrorSite);
  assert.equal(resolvedBaseUrl(mirror), mirror.customMirrorSite);
  const rootOnly = { ...mirror, appendCustomMirrorPath: false };
  assert.equal(homeBaseUrl(rootOnly), mirror.customMirrorSite);
  assert.equal(resolvedBaseUrl(rootOnly), 'https://example.com:8443');
  assert.equal(
    resolvedBaseUrl({ ...rootOnly, customMirrorSite: 'https://example.com:443/mirror' }),
    'https://example.com',
  );
  assert.equal(resolvedBaseUrl({ ...rootOnly, useCustomMirrorSite: false }), settings.baseUrl);
});

test('配置读取保留原范围约束，镜像必须是无查询及片段的 HTTPS 地址', () => {
  assert.equal(normalizeMirrorUrl(' https://example.com/mirror/// '), 'https://example.com/mirror');
  for (const value of [
    '',
    '/mirror',
    'example.com',
    'http://example.com',
    'https:///example.com',
    'https:example.com',
    'https://example.com?',
    'https://example.com#',
    'https://example.com?q=1',
  ]) {
    assert.equal(normalizeMirrorUrl(value), '', value);
  }
  const settings = appSettingsFromJson({
    themeMode: 'unknown',
    language: 'unknown',
    videoAspectRatio: 'unknown',
    textScale: 2,
    defaultPlaybackSpeed: 0,
    minimumVideoDurationSeconds: -1,
    minimumVideoViews: 2000000000,
    skipSeconds: 0,
    customMirrorSite: ' https://example.com/mirror/// ',
  });
  assert.equal(settings.themeMode, 'system');
  assert.equal(settings.language, 'system');
  assert.equal(settings.videoAspectRatio, 'auto');
  assert.equal(settings.textScale, 1.4);
  assert.equal(settings.defaultPlaybackSpeed, 0.25);
  assert.equal(settings.minimumVideoDurationSeconds, 0);
  assert.equal(settings.minimumVideoViews, 1000000000);
  assert.equal(settings.skipSeconds, 1);
  assert.equal(settings.customMirrorSite, 'https://example.com/mirror');
});

test('收藏标签去重、排除未知项，并补齐缺失标签', () => {
  const settings = createAppSettings({
    libraryTabOrder: ['history', 'unknown', 'favorites', 'history'],
  });
  assert.deepEqual(resolvedLibraryTabOrder(settings), [
    'history',
    'favorites',
    'watch-later',
    'playlists',
    'subscriptions',
  ]);
  assert.deepEqual(settings.libraryTabOrder, ['history', 'unknown', 'favorites', 'history']);
});

test('原生视频尺寸保留有效比例、竖屏判定及播放器高度限制', () => {
  assert.equal(videoAspectRatio({ videoWidth: 1920, videoHeight: 1080 }), 16 / 9);
  assert.equal(videoAspectRatio({ videoWidth: 0, videoHeight: 0 }), 16 / 9);
  assert.equal(videoAspectRatio({ videoWidth: 10000, videoHeight: 1 }), 16 / 9);
  assert.equal(isPortraitVideo({ videoWidth: 1080, videoHeight: 1920 }), true);
  assert.equal(isPortraitVideoAspectRatio(1), false);
  assert.equal(videoAspectRatio({ videoWidth: 1, videoHeight: 10 }), 0.1);
  assert.equal(videoAspectRatio({ videoWidth: 10, videoHeight: 1 }), 10);
  assert.equal(playerHeightLimit(100), 180);
  assert.equal(playerHeightLimit(600), 276);
  assert.equal(playerHeightLimit(1000), 380);
});

test('播放量解析支持站点格式，过滤阈值以万为单位', () => {
  for (const [text, count] of [
    [null, 0],
    ['', 0],
    ['no views', 0],
    ['1,234 views', 1234],
    ['１.２万', 12000],
    ['2.5萬', 25000],
    ['0.75亿', 75000000],
    ['1億', 100000000],
    ['2k', 2000],
    ['3.4M', 3400000],
    ['5w', 50000],
    ['1.5', 2],
    ['1 万', 1],
  ])
    assert.equal(parseVideoViewCount(text), count, String(text));
  assert.equal(meetsMinimumVideoViews(null, 0), true);
  assert.equal(meetsMinimumVideoViews('2万', 2), true);
  assert.equal(meetsMinimumVideoViews('19,999', 2), false);
});
