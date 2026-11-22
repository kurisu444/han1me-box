import { comicCardFromJson, type ComicCard } from '../../domain/models/comic';
import { jsonRecords, readJsonStore, updateJsonStore } from './json_store';
export interface ComicReaderState {
  mode: number;
  background: string;
  progress: Record<string, number>;
}
export interface ComicLibraryState {
  watchLater: ComicCard[];
  favorites: ComicCard[];
}
export async function loadReader(): Promise<ComicReaderState> {
  const saved = await readJsonStore<Partial<ComicReaderState>>('comic_reader.json');
  return {
    mode: Math.max(0, Math.min(saved.mode ?? 0, 5)),
    background: saved.background ?? 'black',
    progress: Object.fromEntries(
      Object.entries(saved.progress ?? {}).map(([id, position]) => [id, position ?? 0]),
    ),
  };
}
export const saveReader = (state: ComicReaderState) =>
  updateJsonStore('comic_reader.json', () => state);
export async function loadLibrary(): Promise<ComicLibraryState> {
  const saved = await readJsonStore<Partial<ComicLibraryState>>('comic_library.json');
  return libraryState(saved);
}
function libraryState(saved: Partial<ComicLibraryState>): ComicLibraryState {
  const cards = (value: unknown) => jsonRecords<ComicCard>(value).map(comicCardFromJson);
  return { watchLater: cards(saved.watchLater), favorites: cards(saved.favorites) };
}
export function setComic(comic: ComicCard, enabled: boolean, key: keyof ComicLibraryState) {
  return updateJsonStore<Partial<ComicLibraryState>>('comic_library.json', (saved) => {
    const current = libraryState(saved);
    return {
      ...current,
      [key]: [...(enabled ? [comic] : []), ...current[key].filter((item) => item.id !== comic.id)],
    };
  });
}
