import { defaultHomeSectionOrder, type AppSettings } from '../../core/settings';
import { localize, searchOptionCatalog, type SearchOption } from '../../data/search_option_catalog';

export interface ExploreChannel {
  id: string;
  sort: string;
  genre: string;
  labelKey: string;
  kind: 'sort' | 'genre';
}

const genreChannels: ExploreChannel[] = searchOptionCatalog.genres.options
  .filter((option): option is SearchOption & { searchKey: string } => Boolean(option.searchKey))
  .map((option) => ({
    id: `genre:${option.searchKey}`,
    sort: '',
    genre: option.searchKey,
    labelKey: option.searchKey,
    kind: 'genre',
  }));

export const exploreChannels: ExploreChannel[] = [
  { id: 'sort:他們在看', sort: '他們在看', genre: '', labelKey: '他們在看', kind: 'sort' },
  { id: 'sort:最新上市', sort: '最新上市', genre: '', labelKey: '最新上市', kind: 'sort' },
  { id: 'sort:最新上傳', sort: '最新上傳', genre: '', labelKey: '最新上傳', kind: 'sort' },
  ...genreChannels,
];

export function exploreChannelLabel(channel: ExploreChannel, localeKey: string): string {
  const group = channel.kind === 'sort' ? searchOptionCatalog.sorts : searchOptionCatalog.genres;
  return localize(group, channel.labelKey, localeKey) ?? channel.labelKey;
}

export function orderedExploreChannels(order: readonly string[]): ExploreChannel[] {
  const activeOrder = order.length ? order : defaultHomeSectionOrder;
  const rank = new Map(activeOrder.map((key, index) => [key, index]));
  return [...exploreChannels].sort(
    (left, right) =>
      (rank.get(left.labelKey) ?? activeOrder.length) -
      (rank.get(right.labelKey) ?? activeOrder.length),
  );
}

export function resolvedExploreChannels(
  settings: Pick<AppSettings, 'homeSectionOrder' | 'hiddenHomeSections'>,
): ExploreChannel[] {
  const ordered = orderedExploreChannels(settings.homeSectionOrder);
  const visible = ordered.filter(
    (channel) => !settings.hiddenHomeSections.includes(channel.labelKey),
  );
  return visible.length ? visible : ordered.slice(0, 1);
}
