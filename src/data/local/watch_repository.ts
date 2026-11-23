import { watchProgressFromJson, watchHistoryFromJson } from '../../domain/models/library';
import type { WatchHistory, WatchProgress } from '../../domain/models/library';
import { readJsonStore, updateJsonStore, jsonRecords } from './json_store';

export interface WatchState {
  continueItems: WatchProgress[];
  histories: WatchHistory[];
}

export function watchState(value: Partial<WatchState>): WatchState {
  return {
    continueItems: jsonRecords<WatchProgress>(value.continueItems).map(watchProgressFromJson),
    histories: jsonRecords<WatchHistory>(value.histories).map(watchHistoryFromJson),
  };
}

export async function readWatchState(): Promise<WatchState> {
  return watchState(await readJsonStore<Partial<WatchState>>('watch_store.json'));
}

export function progress({
  id,
  title,
  coverUrl,
  positionMs,
  durationMs,
}: {
  id: string;
  title: string;
  coverUrl?: string;
  positionMs: number;
  durationMs: number;
}): Promise<void> {
  return updateJsonStore<Partial<WatchState>>('watch_store.json', (value) => {
    const current = watchState(value);
    const item: WatchProgress = {
      videoCode: id,
      title,
      coverUrl,
      positionMs: Math.max(positionMs, 0),
      durationMs: Math.max(durationMs, 0),
      updatedAt: Date.now(),
    };
    return {
      ...current,
      continueItems: [
        item,
        ...current.continueItems.filter((existing) => existing.videoCode !== id),
      ].slice(0, 6),
    };
  });
}

export function addTime(
  id: string,
  title: string,
  watchedMs: number,
  coverUrl?: string,
): Promise<void> {
  if (watchedMs <= 0) {
    return Promise.resolve();
  }
  return updateJsonStore<Partial<WatchState>>('watch_store.json', (value) => {
    const current = watchState(value);
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const history: WatchHistory = {
      id: crypto.randomUUID(),
      videoCode: id,
      title,
      coverUrl,
      watchedMs,
      date,
      createdAt: now.getTime(),
    };
    return { ...current, histories: [...current.histories, history] };
  });
}

export function deleteHistories(ids: Set<string>): Promise<void> {
  return updateJsonStore<Partial<WatchState>>('watch_store.json', (value) => {
    const current = watchState(value);
    return { ...current, histories: current.histories.filter((item) => !ids.has(item.id)) };
  });
}

export function replaceWatchState(value: WatchState): Promise<void> {
  return updateJsonStore<WatchState>('watch_store.json', () => value);
}
