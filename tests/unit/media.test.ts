import assert from 'node:assert/strict';
import { createAppSettings } from '../../src/core/settings';
import { appTheme } from '../../src/app/app_theme';
import { translateLabel } from '../../src/app/i18n';
import { applyHomeSectionLayout, homeSectionKey } from '../../src/features/explore/explore_page';
import {
  preferredSource,
  downloadSource,
  resumePosition,
  nextEpisode,
  homeVideoVisible,
  visibleComments,
} from '../../src/features/video/video_helpers';
import { type Comment, type VideoDetail } from '../../src/domain/models/video';

function test(name: string, run: () => void) {
  run();
  console.log(`PASS ${name}`);
}
const settings = createAppSettings();
const detail: VideoDetail = {
  id: '1',
  title: 'Sample <title>',
  description: '<script>alert(1)</script>',
  sources: [
    { quality: '1080p', url: 'https://example.com/1080.mp4' },
    { quality: '720p', url: 'https://example.com/720.mp4' },
  ],
  tags: [{ name: 'Sample' }],
  playlist: [
    { id: '1', title: 'First', coverUrl: '' },
    { id: '2', title: 'Second', coverUrl: '' },
  ],
  related: [{ id: '3', title: 'Related', coverUrl: '' }],
};

test('Language follows explicit selection and the system locale', () => {
  assert.equal(translateLabel('设置', 'english', 'zh-CN'), 'Settings');
  assert.equal(translateLabel('设置', 'traditionalChinese', 'en-US'), '設定');
  assert.equal(translateLabel('设置', 'system', 'en-US'), 'Settings');
  assert.equal(translateLabel('设置', 'system', 'zh-TW'), '設定');
  assert.equal(translateLabel('设置', 'system', 'zh-CN'), '设置');
  assert.equal(translateLabel('{0} 个视频', 'english', 'en-US', 3), '3 videos');
});

test('Download quality has its own default, lower-quality tie and unknown-label fallback', () => {
  assert.equal(settings.downloadQuality, 1080);
  assert.equal(downloadSource(detail.sources, 900)?.quality, '720p');
  assert.equal(
    downloadSource([{ quality: 'Default', url: 'a' }, ...detail.sources], 100)?.url,
    'a',
  );
  assert.equal(downloadSource([], 720), undefined);
});

test('Theme follows system mode, explicit overrides and text scaling', () => {
  assert.equal(appTheme('system', 1, true).palette.mode, 'dark');
  assert.equal(appTheme('system', 1, false).palette.mode, 'light');
  assert.equal(appTheme('light', 1, true).palette.mode, 'light');
  assert.equal(appTheme('dark', 1, false).palette.mode, 'dark');
  const light = appTheme('light', 1, false);
  const scaled = appTheme('light', 1.5, false);
  assert.equal(light.palette.primary.main, '#6d3f90');
  assert.equal(
    parseFloat(String(scaled.typography.body1.fontSize)),
    parseFloat(String(light.typography.body1.fontSize)) * 1.5,
  );
  assert.equal(
    parseFloat(String(scaled.typography.button.fontSize)),
    parseFloat(String(light.typography.button.fontSize)) * 1.5,
  );
});

test('Home sections use genre/sort/query keys, preserve unknown order and hide configured sections', () => {
  const sections = ['a', 'b', 'c'].map((title) => ({
    title,
    videos: [],
    isFeatured: false,
    moreUrl: `/search?genre=${title}`,
  }));
  assert.deepEqual(
    applyHomeSectionLayout(sections, ['c'], ['b']).map((section) => section.title),
    ['c', 'a'],
  );
  assert.deepEqual(
    sections.map((section) => section.title),
    ['a', 'b', 'c'],
  );
  assert.equal(homeSectionKey({ ...sections[0], moreUrl: '/search?genre=&sort=latest' }), 'a');
});

test('Recommendation filters honor title, author, duration, views and subscribed exemption', () => {
  const video = {
    id: '1',
    title: 'Sample',
    coverUrl: '',
    artist: 'Studio',
    views: '12万',
    duration: '01:30',
  };
  assert.equal(
    homeVideoVisible(video, {
      ...settings,
      minimumVideoDurationSeconds: 90,
      minimumVideoViews: 12,
    }),
    true,
  );
  assert.equal(homeVideoVisible(video, { ...settings, minimumVideoDurationSeconds: 91 }), false);
  assert.equal(homeVideoVisible(video, { ...settings, blockedAuthors: ['STUDIO'] }), false);
  assert.equal(
    homeVideoVisible(
      video,
      { ...settings, blockedVideoTitleKeywords: ['sample'] },
      new Set(['studio']),
    ),
    true,
  );
});

test('Quality uses nearest numeric label, keeps the first tie and defaults unnamed quality to 720', () => {
  assert.equal(preferredSource(detail.sources, 720)?.quality, '720p');
  assert.equal(preferredSource(detail.sources, 900)?.quality, '1080p');
  assert.equal(
    preferredSource([{ quality: 'Default', url: 'a' }, ...detail.sources], 720)?.url,
    'a',
  );
  assert.equal(preferredSource([], 720), undefined);
});

test('Resume does not restart nearly completed videos; next episode follows original wrap behavior', () => {
  const saved = {
    videoCode: '1',
    title: 'Sample',
    positionMs: 9000,
    durationMs: 15000,
    updatedAt: 0,
  };
  assert.equal(resumePosition(saved), 9);
  assert.equal(resumePosition({ ...saved, positionMs: 12000 }), 0);
  assert.equal(resumePosition(), 0);
  assert.equal(nextEpisode(detail)?.id, '2');
  assert.equal(nextEpisode({ ...detail, id: '2' })?.id, '1');
  assert.equal(nextEpisode({ ...detail, playlist: [detail.playlist[0]] }), undefined);
});

test('Comment filtering and all five sorting modes preserve input order and source semantics', () => {
  const comments: Comment[] = [
    {
      id: '20',
      username: 'Reader',
      content: 'Good',
      hasMoreReplies: true,
      liked: false,
      disliked: false,
      replyCount: 2,
      likesCount: 9,
      likesSum: 8,
    },
    {
      id: '10',
      username: 'Other',
      content: 'Another',
      hasMoreReplies: false,
      liked: false,
      disliked: false,
      replyCount: 0,
      likesCount: 6,
      likesSum: 1,
    },
  ];
  for (const [sort, first] of [
    ['latest', '20'],
    ['earliest', '10'],
    ['mostReplies', '20'],
    ['mostLikes', '20'],
    ['mostDislikes', '10'],
  ] as const)
    assert.equal(visibleComments(comments, settings, sort)[0].id, first);
  assert.equal(
    visibleComments(comments, { ...settings, blockedCommentKeywords: ['GOOD'] }, 'latest')[0].id,
    '10',
  );
  assert.equal(
    visibleComments(comments, { ...settings, blockedCommentUsers: ['reader'] }, 'latest').length,
    1,
  );
  assert.deepEqual(
    comments.map((comment) => comment.id),
    ['20', '10'],
  );
});

const { previewMonth, offsetMonth } = await import('../../src/features/previews/month_navigation');
test('Preview months preserve original validation and year rollover', () => {
  assert.equal(previewMonth('202601'), '2026-01');
  assert.equal(previewMonth('2026-12'), '2026-12');
  assert.equal(previewMonth('202613'), previewMonth(null));
  assert.equal(offsetMonth('2026-01', -1), '2025-12');
  assert.equal(offsetMonth('2026-12', 1), '2027-01');
});
