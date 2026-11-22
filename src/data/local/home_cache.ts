import type { HomeFeed, HomeSection, VideoCard } from '../../domain/models/video';
import { comicCardFromJson, type ComicHome, type ComicCard } from '../../domain/models/comic';
import { readJsonStore, updateJsonStore, jsonRecords } from './json_store';

type HomeCache = Record<string, HomeFeed>;
const cacheKey = (baseUrl: string, accountId?: string) =>
  `home_feed_v2:${baseUrl}:${accountId ?? 'anonymous'}`;

export async function readHomeCache(
  baseUrl: string,
  accountId?: string,
): Promise<HomeFeed | undefined> {
  const cache = await readJsonStore<HomeCache>('home_cache.json');
  const value = cache[cacheKey(baseUrl, accountId)];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const card = (item: Partial<VideoCard>): VideoCard => ({
    ...item,
    id: item.id ?? '',
    title: item.title ?? '',
    coverUrl: item.coverUrl ?? '',
  });
  return {
    featured: jsonRecords<VideoCard>([value.featured]).map(card)[0],
    sections: jsonRecords<HomeSection>(value.sections).map((section) => ({
      title: section.title ?? '',
      moreUrl: section.moreUrl,
      isFeatured: section.isFeatured === true,
      videos: jsonRecords<VideoCard>(section.videos).map(card),
    })),
  };
}

export function writeHomeCache(
  baseUrl: string,
  accountId: string | undefined,
  feed: HomeFeed,
): Promise<void> {
  return updateJsonStore<HomeCache>('home_cache.json', (cache) => ({
    ...cache,
    [cacheKey(baseUrl, accountId)]: feed,
  }));
}

export async function readComicHome() {
  const cache = await readJsonStore<Record<string, ComicHome>>('home_cache.json');
  const home = cache['home_feed_v2:comics'];
  if (!home || typeof home !== 'object' || Array.isArray(home)) return undefined;
  return {
    trending: jsonRecords<ComicCard>(home.trending).map(comicCardFromJson),
    latest: jsonRecords<ComicCard>(home.latest).map(comicCardFromJson),
  };
}
export function writeComicHome(feed: ComicHome) {
  return updateJsonStore('home_cache.json', (cache: Record<string, unknown>) => ({
    ...cache,
    'home_feed_v2:comics': feed,
  }));
}
