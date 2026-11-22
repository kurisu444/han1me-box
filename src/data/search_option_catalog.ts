import genres from '../../assets/search_options/genre.json';
import sorts from '../../assets/search_options/sort_option.json';
import durations from '../../assets/search_options/duration.json';
import dates from '../../assets/search_options/release_date.json';
import tags from '../../assets/search_options/tags.json';
import type { AppLanguage } from '../core/settings';

export interface SearchOption {
  labels: Record<string, string>;
  searchKey: string | null;
}
export interface SearchOptionGroup {
  options: SearchOption[];
  aliases: Map<string, SearchOption>;
}
export interface SearchOptionCatalog {
  genres: SearchOptionGroup;
  sorts: SearchOptionGroup;
  durations: SearchOptionGroup;
  releaseDates: SearchOptionGroup;
  tags: Record<string, SearchOptionGroup>;
}

export function searchOptionGroup(
  values: { lang: Record<string, string>; search_key?: string | null }[],
  aliases: Record<string, string> = {},
): SearchOptionGroup {
  const options = values.map((value) => ({
    labels: value.lang,
    searchKey: value.search_key ?? null,
  }));
  const lookup = new Map<string, SearchOption>();
  for (const option of options) {
    for (const alias of [option.searchKey, ...Object.values(option.labels)])
      if (alias) lookup.set(alias, option);
  }
  for (const [alias, key] of Object.entries(aliases)) {
    const option = lookup.get(key);
    if (option) lookup.set(alias, option);
  }
  return { options, aliases: lookup };
}

export function labelFor(option: SearchOption, localeKey: string): string {
  return option.labels[localeKey] ?? option.labels['zh-rCN'] ?? option.searchKey ?? '';
}
export function canonical(group: SearchOptionGroup, value: string): string {
  return group.aliases.get(value)?.searchKey ?? value;
}
export function localize(
  group: SearchOptionGroup,
  value: string,
  localeKey: string,
): string | undefined {
  const option = group.aliases.get(value);
  return option ? labelFor(option, localeKey) : undefined;
}

export const searchOptionCatalog: SearchOptionCatalog = {
  genres: searchOptionGroup(genres, { '2D動画': '2D動畫' }),
  sorts: searchOptionGroup(sorts),
  durations: searchOptionGroup(durations),
  releaseDates: searchOptionGroup(dates),
  tags: Object.fromEntries(
    Object.entries(tags).map(([key, options]) => [key, searchOptionGroup(options)]),
  ),
};

export function lookupTag(value: string): SearchOption | undefined {
  for (const group of Object.values(searchOptionCatalog.tags)) {
    const option = group.aliases.get(value);
    if (option) return option;
  }
}
export const canonicalTag = (value: string) => lookupTag(value)?.searchKey ?? value;
export function localizeTag(value: string, localeKey: string): string {
  const option = lookupTag(value);
  return option ? labelFor(option, localeKey) : value;
}
export function searchOptionLocaleKey(locale: string): string {
  const parts = locale.toLowerCase().split(/[-_]/);
  return parts[0] === 'zh'
    ? parts.some((part) => ['hant', 'hk', 'mo', 'tw'].includes(part))
      ? 'zh-rTW'
      : 'zh-rCN'
    : parts[0];
}
export function searchLocale(language: AppLanguage, systemLocale: string): string {
  return language === 'system'
    ? searchOptionLocaleKey(systemLocale)
    : { simplifiedChinese: 'zh-rCN', traditionalChinese: 'zh-rTW', english: 'en' }[language];
}
