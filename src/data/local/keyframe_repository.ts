import { readJsonStore, updateJsonStore } from './json_store';
export interface KeyframeVideo {
  id: string;
  title: string;
  positions: number[];
}
type SavedKeyframes = Record<string, number[] | { title?: string; keyframes?: number[] }>;
function positions(value?: SavedKeyframes[string]) {
  return (Array.isArray(value) ? value : (value?.keyframes ?? []))
    .filter((item) => typeof item === 'number')
    .map(Math.trunc)
    .sort((a, b) => a - b);
}
export async function loadVideos(): Promise<KeyframeVideo[]> {
  const saved = await readJsonStore<SavedKeyframes>('keyframes.json');
  return Object.entries(saved)
    .map(([id, value]) => ({
      id,
      title: Array.isArray(value) ? id : (value?.title ?? id),
      positions: positions(value),
    }))
    .filter((video) => video.positions.length)
    .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}
export async function load(id: string) {
  return positions((await readJsonStore<SavedKeyframes>('keyframes.json'))[id]);
}
async function edit(
  id: string,
  change: (current: number[]) => number[] | undefined,
  title?: string,
) {
  let changed = false;
  await updateJsonStore<SavedKeyframes>('keyframes.json', (saved) => {
    const next = change(positions(saved[id]));
    if (!next) {
      return saved;
    }
    changed = true;
    const existing = saved[id];
    const result = { ...saved };
    if (!next.length) {
      delete result[id];
    } else {
      result[id] = {
        title: title ?? (Array.isArray(existing) ? id : (existing?.title ?? id)),
        keyframes: next,
      };
    }
    return result;
  });
  return changed;
}
export const setTitle = (id: string, title: string) =>
  edit(id, (items) => (items.length ? items : undefined), title);
export const add = (id: string, value: number, title?: string) =>
  edit(
    id,
    (items) =>
      items.some((item) => Math.abs(item - value) < 10000)
        ? undefined
        : [...items, value].sort((a, b) => a - b),
    title,
  );
export const updatePosition = (id: string, old: number, value: number) =>
  edit(id, (items) => {
    const remaining = items.filter((item) => item !== old);
    if (value < 0 || remaining.some((item) => Math.abs(item - value) < 10000)) {
      return undefined;
    }
    return [...remaining, value].sort((a, b) => a - b);
  });
export const remove = (id: string, value: number) =>
  edit(id, (items) => items.filter((item) => item !== value));
export const deleteVideo = (id: string) => edit(id, () => []);
