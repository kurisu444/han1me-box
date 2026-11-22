import { app, net } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { zipSync, unzipSync } from 'fflate';
import type { ComicCacheEntry, ComicDetail } from '../src/domain/models/comic';
import { readStore, writeStore } from './store';

const defaultCategory = '默认';

interface StoredComicItem {
  id?: string;
  title?: string;
  coverUrl?: string;
  archivePath?: string;
  directory?: string;
  pageCount?: number;
  category?: string;
}

export async function entries(): Promise<ComicCacheEntry[]> {
  const items = ((await readStore('comic_cache.json')).items as unknown[] | undefined) ?? [];
  return items
    .filter(
      (item): item is StoredComicItem =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    )
    .map((item) => ({
      ...item,
      id: item.id ?? '',
      title: item.title ?? '',
      coverUrl: item.coverUrl ?? '',
      archivePath: item.archivePath ?? `${item.directory ?? ''}.zip`,
      pageCount: item.pageCount ?? 0,
      category: item.category ?? defaultCategory,
    }));
}

export async function categories(): Promise<string[]> {
  const items =
    ((await readStore('comic_cache_categories.json')).items as unknown[] | undefined) ?? [];
  return [
    ...new Set([
      defaultCategory,
      ...items.filter((item): item is string => typeof item === 'string'),
    ]),
  ];
}

export async function cache(detail: ComicDetail, category = defaultCategory): Promise<void> {
  const root = path.join(app.getPath('userData'), 'Comic');
  const directory = path.join(root, `.${detail.id}`);
  const archivePath = path.join(root, `${detail.id}.zip`);
  const temporary = `${archivePath}.part`;
  await fs.mkdir(root, { recursive: true });
  await fs.rm(temporary, { force: true });
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  const files: Record<string, Uint8Array> = {};
  try {
    for (let index = 0; index < detail.imageUrls.length; index++) {
      const output = path.join(directory, `${index + 1}.image`);
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await net.fetch(detail.imageUrls[index]);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          await fs.writeFile(output, bytes);
          if (bytes.length) {
            files[`${index + 1}.image`] = bytes;
            break;
          }
        } catch (error) {
          lastError = error;
          await fs.rm(output, { force: true });
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!files[`${index + 1}.image`]) {
        throw new Error(`Unable to download comic image: ${lastError}`);
      }
    }
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
  await fs.writeFile(temporary, zipSync(files, { level: 0 }));
  await fs.rm(archivePath, { force: true });
  await fs.rename(temporary, archivePath);
  await fs.rm(directory, { recursive: true, force: true });
  const entry: ComicCacheEntry = {
    id: detail.id,
    title: detail.title,
    coverUrl: detail.coverUrl,
    archivePath,
    pageCount: detail.pageCount,
    category,
  };
  await writeStore('comic_cache.json', {
    items: [entry, ...(await entries()).filter((item) => item.id !== entry.id)],
  });
}

export async function addCategory(category: string): Promise<void> {
  const value = category.trim();
  const current = await categories();
  if (!value || current.includes(value)) {
    return;
  }
  await writeStore('comic_cache_categories.json', {
    items: [...current.filter((item) => item !== defaultCategory), value],
  });
}

export async function deleteCategory(category: string): Promise<void> {
  if (category === defaultCategory) {
    return;
  }
  await writeStore('comic_cache.json', {
    items: (await entries()).map((entry) =>
      entry.category === category ? { ...entry, category: defaultCategory } : entry,
    ),
  });
  await writeStore('comic_cache_categories.json', {
    items: (await categories()).filter((item) => item !== defaultCategory && item !== category),
  });
}

export async function remove(entry: ComicCacheEntry): Promise<void> {
  await fs.rm(entry.archivePath, { force: true });
  await writeStore('comic_cache.json', {
    items: (await entries()).filter((item) => item.id !== entry.id),
  });
}

export async function extract(entry: ComicCacheEntry): Promise<string[]> {
  const directory = path.join(app.getPath('temp'), 'comic_reader', entry.id);
  const current = await fs.readdir(directory).catch(() => [] as string[]);
  if (current.length < entry.pageCount) {
    await fs.rm(directory, { recursive: true, force: true });
    await fs.mkdir(directory, { recursive: true });
    const files = unzipSync(await fs.readFile(entry.archivePath));
    for (let index = 1; index <= entry.pageCount; index++) {
      await fs.writeFile(path.join(directory, `${index}.image`), files[`${index}.image`]);
    }
  }
  return Array.from({ length: entry.pageCount }, (_, index) =>
    path.join(directory, `${index + 1}.image`),
  );
}
