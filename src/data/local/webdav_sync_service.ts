import type { AppSettings } from '../../core/settings';
import type { FollowingVideo } from '../../domain/models/library';
import { followingVideoFromJson, followingVideoToJson } from '../../domain/models/library';
import { watchState, type WatchState } from './watch_repository';
import { jsonRecords } from './json_store';
function headers(settings: AppSettings) {
  const bytes = new TextEncoder().encode(`${settings.webDavUsername}:${settings.webDavPassword}`);
  return {
    Authorization: `Basic ${btoa(String.fromCharCode(...bytes))}`,
    'Content-Type': 'application/json',
  };
}
function fileUrl(base: string, file: string) {
  const url = new URL(base.trim());
  if (!url.hostname) throw new Error('Invalid WebDAV URL');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${file}`;
  return url.href;
}
async function read(url: string, settings: AppSettings) {
  const response = await window.electron.http.fetch(url, headers(settings));
  if (response.statusCode === 404) return;
  if (response.statusCode >= 400) throw new Error(`WebDAV HTTP ${response.statusCode}`);
  try {
    return JSON.parse(response.body);
  } catch {
    return;
  }
}
async function write(url: string, settings: AppSettings, value: unknown) {
  const response = await window.electron.http.request(url, 'PUT', value, headers(settings), true);
  if (response.statusCode >= 400) throw new Error(`WebDAV HTTP ${response.statusCode}`);
}
export function mergeWatch(local: WatchState, remote: WatchState): WatchState {
  const progress = new Map<string, WatchState['continueItems'][number]>(),
    histories = new Map<string, WatchState['histories'][number]>();
  for (const item of [...local.continueItems, ...remote.continueItems]) {
    const previous = progress.get(item.videoCode);
    if (!previous || item.updatedAt > previous.updatedAt) progress.set(item.videoCode, item);
  }
  for (const item of [...local.histories, ...remote.histories]) {
    const previous = histories.get(item.id);
    if (!previous || item.createdAt > previous.createdAt) histories.set(item.id, item);
  }
  return {
    continueItems: [...progress.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    histories: [...histories.values()].sort((a, b) => a.createdAt - b.createdAt),
  };
}
export async function syncWatchState(settings: AppSettings, local: WatchState) {
  const url = fileUrl(settings.webDavUrl, 'han1me-box-watch-history.json'),
    remote = await read(url, settings);
  const merged = mergeWatch(local, watchState(remote ?? {}));
  await write(url, settings, merged);
  return merged;
}
export async function syncFavorites(settings: AppSettings, local: FollowingVideo[]) {
  const url = fileUrl(settings.webDavUrl, 'han1me-box-favorites.json'),
    remote = await read(url, settings);
  const merged = new Map<string, FollowingVideo>(
    jsonRecords<FollowingVideo>(remote)
      .map(followingVideoFromJson)
      .map((item) => [item.videoCode, item]),
  );
  for (const item of local) {
    const previous = merged.get(item.videoCode);
    if (!previous || item.addedAt > previous.addedAt) merged.set(item.videoCode, item);
  }
  const values = [...merged.values()].sort((a, b) => b.addedAt - a.addedAt);
  await write(url, settings, values.map(followingVideoToJson));
  return values;
}
