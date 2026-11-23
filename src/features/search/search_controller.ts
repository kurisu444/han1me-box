import { canonical, canonicalTag, searchOptionCatalog } from '../../data/search_option_catalog';
import {
  searchQueryFromUri,
  searchQueryToUri,
  type SearchQuery,
  hasSearchCriteria,
  searchQueriesEqual,
  searchQueryFromJson,
  searchQueryToJson,
} from '../../domain/models/search_query';
import type { AppSettings } from '../../core/settings';
import type { SearchResult } from '../../data/remote/han1me_api';
import { homeVideoVisible } from '../video/video_helpers';
import { jsonRecords, readJsonStore, updateJsonStore } from '../../data/local/json_store';

export function canonicalQuery(query: SearchQuery): SearchQuery {
  const catalog = searchOptionCatalog;
  return {
    ...query,
    genre: canonical(catalog.genres, query.genre),
    sort: canonical(catalog.sorts, query.sort),
    date: canonical(catalog.releaseDates, query.date),
    duration: canonical(catalog.durations, query.duration),
    tags: query.tags.map(canonicalTag),
  };
}
export function searchRouteQuery(value: string): SearchQuery {
  const query = searchQueryFromUri(value);
  const page = new URL(value, 'https://site.invalid').searchParams.get('page') ?? '';
  return canonicalQuery({
    ...query,
    page: /^\d+$/.test(page) && Number(page) > 0 ? Number(page) : 1,
  });
}
export function searchRouteUrl(query: SearchQuery): string {
  const uri = searchQueryToUri(query);
  return query.page === 1 ? uri : `${uri}${uri.endsWith('?') ? '' : '&'}page=${query.page}`;
}
export const compactSearchGenre = (genre: string) =>
  ['裏番', '泡麵番'].includes(canonical(searchOptionCatalog.genres, genre));
export function filterSearchResult(result: SearchResult, settings: AppSettings): SearchResult {
  return settings.applyRecommendationFiltersToSearch
    ? {
        ...result,
        items: result.items.filter((video) => homeVideoVisible(video, settings)),
      }
    : result;
}

type HistoryFile = { items?: Omit<SearchQuery, 'page'>[] };
const queries = (data: HistoryFile) =>
  jsonRecords<Omit<SearchQuery, 'page'>>(data.items)
    .map(searchQueryFromJson)
    .filter(hasSearchCriteria);

export async function loadSearchHistory(): Promise<SearchQuery[]> {
  return queries(await readJsonStore<HistoryFile>('search_history.json'));
}
export function recordSearch(query: SearchQuery): Promise<void> {
  if (!hasSearchCriteria(query)) {
    return Promise.resolve();
  }
  return updateJsonStore<HistoryFile>('search_history.json', (data) => ({
    items: [query, ...queries(data).filter((item) => !searchQueriesEqual(item, query))]
      .slice(0, 30)
      .map(searchQueryToJson),
  }));
}
export function removeSearchHistory(query: SearchQuery): Promise<void> {
  return updateJsonStore<HistoryFile>('search_history.json', (data) => ({
    items: queries(data)
      .filter((item) => !searchQueriesEqual(item, query))
      .map(searchQueryToJson),
  }));
}
export function clearSearchHistory(): Promise<void> {
  return updateJsonStore<HistoryFile>('search_history.json', () => ({ items: [] }));
}
