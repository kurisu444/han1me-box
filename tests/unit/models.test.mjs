import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVideoDuration } from '../../src/domain/models/video.ts';
import {
  createSearchQuery,
  createSearchRouteRequest,
  hasSearchCriteria,
  searchQueriesEqual,
  searchQueryFromJson,
  searchQueryFromUri,
  searchQueryToJson,
  searchQueryToUri,
} from '../../src/domain/models/search_query.ts';
import {
  createPlaylist,
  playlistToJson,
  sortPlaylistVideos,
} from '../../src/domain/models/library.ts';

test('时长按非负十进制整数分段解析并转换为秒', () => {
  for (const [input, seconds] of [
    ['01:30', 90],
    ['1:02:03', 3723],
    ['1:90', 150],
    [' 1 : 02 ', 62],
    ['0:00', null],
    ['-0:01', null],
    ['+1:02', null],
    ['0x1:0xA', null],
    ['0x10:00', null],
    ['1:2.5', null],
    ['1:1e2', null],
    ['1:-2', null],
    ['1:', null],
    ['90', null],
    ['1:2:3:4', null],
    [undefined, null],
    [null, null],
  ]) {
    assert.equal(parseVideoDuration(input), seconds, String(input));
  }
});

test('搜索 URL 中重复标签及特殊字符可往返转换', () => {
  assert.equal(searchQueryToUri(createSearchQuery()), '/search?');
  const query = createSearchQuery({ text: "a ~!*'() 中 文", tags: ['a b', 'c+d'] });
  const uri =
    '/search?query=a+~%21%2A%27%28%29+%E4%B8%AD+%E6%96%87&tags%5B%5D=a+b&tags%5B%5D=c%2Bd';
  assert.equal(searchQueryToUri(query), uri);
  assert.deepEqual(searchQueryFromUri(uri), query);
  assert.deepEqual(searchQueryFromUri(`https://example.com${uri}`), query);
  for (const broad of ['on', 'true', '1']) {
    assert.equal(searchQueryFromUri(`/search?broad=${broad}`).broad, true);
  }
  assert.equal(searchQueryFromUri('/search?broad=false').broad, false);
  assert.deepEqual(searchQueryFromUri(null), createSearchQuery());
  assert.deepEqual(searchQueryFromUri('http://['), createSearchQuery());
});

test('搜索页码不参与 URL、持久化和相等比较，标签顺序参与比较', () => {
  const query = createSearchQuery({ text: 'sample', tags: ['a', 'b'], page: 4 });
  assert.equal(searchQueryToUri(query).includes('page'), false);
  assert.equal('page' in searchQueryToJson(query), false);
  assert.equal(searchQueryFromJson(searchQueryToJson(query)).page, 1);
  assert.equal(searchQueryFromUri('/search?query=sample&page=4').page, 1);
  assert.equal(searchQueriesEqual(query, { ...query, page: 1 }), true);
  assert.equal(searchQueriesEqual(query, { ...query, tags: ['b', 'a'] }), false);
  assert.equal(hasSearchCriteria(createSearchQuery({ broad: true })), false);
  assert.equal(hasSearchCriteria(query), true);
  assert.notEqual(createSearchRouteRequest().sessionId, createSearchRouteRequest().sessionId);
  const first = createSearchQuery();
  first.tags.push('a');
  assert.deepEqual(createSearchQuery().tags, []);
});

test('列表按时间或忽略大小写的标题排序，不修改输入数组', () => {
  const videos = [
    { videoCode: 'b', title: 'beta', addedAt: 2 },
    { videoCode: 'a', title: 'Alpha', addedAt: 1 },
    { videoCode: 'c', title: 'charlie', addedAt: 3 },
  ];
  const codes = (items) => items.map((item) => item.videoCode);
  assert.deepEqual(codes(sortPlaylistVideos('recentlyAdded', videos)), ['c', 'b', 'a']);
  assert.deepEqual(codes(sortPlaylistVideos('oldestAdded', videos)), ['a', 'b', 'c']);
  assert.deepEqual(codes(sortPlaylistVideos('title', videos)), ['a', 'b', 'c']);
  assert.deepEqual(codes(videos), ['b', 'a', 'c']);
});

test('列表默认值正确，序列化排除临时远端条目 ID', () => {
  const playlist = createPlaylist({ id: 'list', title: 'List', count: 1 });
  assert.equal(playlist.sort, 'recentlyAdded');
  assert.deepEqual(playlist.videos, []);
  playlist.videos = [{ videoCode: 'a', title: 'Alpha', addedAt: 1, playlistItemId: 'remote' }];
  const stored = playlistToJson(playlist);
  assert.equal('playlistItemId' in stored.videos[0], false);
  assert.equal(playlist.videos[0].playlistItemId, 'remote');
});
