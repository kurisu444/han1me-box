import assert from 'node:assert/strict';
import {
  canonical,
  canonicalTag,
  labelFor,
  localize,
  searchLocale,
  searchOptionCatalog,
  searchOptionLocaleKey,
} from '../../src/data/search_option_catalog';
import { createSearchQuery } from '../../src/domain/models/search_query';
import { createAppSettings } from '../../src/core/settings';
import {
  canonicalQuery,
  compactSearchGenre,
  filterSearchResult,
  searchRouteQuery,
  searchRouteUrl,
  loadSearchHistory,
  recordSearch,
  removeSearchHistory,
} from '../../src/features/search/search_controller';

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  console.log(`PASS ${name}`);
}
await test('Catalog language fallback, aliases and canonical query keys', () => {
  assert.equal(canonical(searchOptionCatalog.genres, '2D動画'), '2D動畫');
  assert.equal(canonical(searchOptionCatalog.genres, '2D动画'), '2D動畫');
  assert.equal(localize(searchOptionCatalog.genres, '裏番', 'zh-rCN'), '里番');
  assert.equal(labelFor({ labels: { 'zh-rCN': '回退' }, searchKey: 'key' }, 'unknown'), '回退');
  assert.equal(searchOptionLocaleKey('zh-Hant-HK'), 'zh-rTW');
  assert.equal(searchOptionLocaleKey('zh-CN'), 'zh-rCN');
  assert.equal(searchLocale('english', 'zh-CN'), 'en');
  assert.equal(canonicalTag('unknown-tag'), 'unknown-tag');
  assert.equal(canonicalQuery(createSearchQuery({ genre: '2D動画' })).genre, '2D動畫');
  assert.equal(compactSearchGenre('泡面番'), true);
});
await test('Search routes preserve repeated tags and pagination independently of history identity', () => {
  const query = createSearchQuery({ text: 'a + b', tags: ['one', 'two'], broad: true, page: 4 });
  assert.deepEqual(searchRouteQuery(searchRouteUrl(query)), query);
  assert.equal(searchRouteQuery('/search?page=-1').page, 1);
  assert.equal(searchRouteQuery('/search?page=abc').page, 1);
  assert.equal(searchRouteQuery('/search?genre=2D動画').genre, '2D動畫');
});
await test('Search filtering is optional and retains server pagination after filtering', () => {
  const result = { items: [{ id: '1', title: 'Blocked', coverUrl: '' }], page: 2, totalPages: 8 };
  const settings = createAppSettings({ blockedVideoTitleKeywords: ['blocked'] });
  assert.deepEqual(filterSearchResult(result, settings), { items: [], page: 2, totalPages: 8 });
  assert.equal(
    filterSearchResult(result, { ...settings, applyRecommendationFiltersToSearch: false }),
    result,
  );
});
await test('History serializes concurrent changes, caps at 30, ignores page and deletes one query', async () => {
  let stored: unknown = {};
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      electron: {
        store: {
          read: async () => structuredClone(stored),
          write: async (_file: string, value: unknown) => {
            stored = structuredClone(value);
          },
        },
      },
    },
  });
  try {
    assert.deepEqual(await loadSearchHistory(), []);
    await recordSearch(createSearchQuery({ broad: true }));
    assert.deepEqual(await loadSearchHistory(), []);
    await Promise.all(
      Array.from({ length: 35 }, (_, index) =>
        recordSearch(createSearchQuery({ text: String(index), page: 3 })),
      ),
    );
    const history = await loadSearchHistory();
    assert.equal(history.length, 30);
    assert.equal(history[0].text, '34');
    assert.equal(history[0].page, 1);
    await recordSearch(createSearchQuery({ text: '10', page: 9 }));
    assert.equal((await loadSearchHistory())[0].text, '10');
    assert.equal((await loadSearchHistory()).length, 30);
    assert.equal(JSON.stringify(stored).includes('"page"'), false);
    await removeSearchHistory(createSearchQuery({ text: '10' }));
    assert.equal((await loadSearchHistory()).length, 29);
    assert.equal(
      (await loadSearchHistory()).some((query) => query.text === '10'),
      false,
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
