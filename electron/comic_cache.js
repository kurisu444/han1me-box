const { app, net } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { zipSync, unzipSync } = require('fflate');
const defaultCategory = '默认';
const store = () => require('./ipc');
async function entries() {
  return ((await store().readStore('comic_cache.json')).items ?? [])
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
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
async function categories() {
  return [
    ...new Set([
      defaultCategory,
      ...((await store().readStore('comic_cache_categories.json')).items ?? []).filter(
        (item) => typeof item === 'string',
      ),
    ]),
  ];
}
async function cache(detail, category = defaultCategory) {
  const root = path.join(app.getPath('userData'), 'Comic'),
    directory = path.join(root, `.${detail.id}`),
    archivePath = path.join(root, `${detail.id}.zip`),
    temporary = `${archivePath}.part`;
  await fs.mkdir(root, { recursive: true });
  await fs.rm(temporary, { force: true });
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  const files = {};
  try {
    for (let index = 0; index < detail.imageUrls.length; index++) {
      const output = path.join(directory, `${index + 1}.image`);
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await net.fetch(detail.imageUrls[index]);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
      if (!files[`${index + 1}.image`])
        throw new Error(`Unable to download comic image: ${lastError}`);
    }
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
  await fs.writeFile(temporary, zipSync(files, { level: 0 }));
  await fs.rm(archivePath, { force: true });
  await fs.rename(temporary, archivePath);
  await fs.rm(directory, { recursive: true, force: true });
  const entry = {
    id: detail.id,
    title: detail.title,
    coverUrl: detail.coverUrl,
    archivePath,
    pageCount: detail.pageCount,
    category,
  };
  await store().writeStore('comic_cache.json', {
    items: [entry, ...(await entries()).filter((item) => item.id !== entry.id)],
  });
}
async function addCategory(category) {
  const value = category.trim(),
    current = await categories();
  if (!value || current.includes(value)) return;
  await store().writeStore('comic_cache_categories.json', {
    items: [...current.filter((item) => item !== defaultCategory), value],
  });
}
async function deleteCategory(category) {
  if (category === defaultCategory) return;
  await store().writeStore('comic_cache.json', {
    items: (await entries()).map((entry) =>
      entry.category === category ? { ...entry, category: defaultCategory } : entry,
    ),
  });
  await store().writeStore('comic_cache_categories.json', {
    items: (await categories()).filter((item) => item !== defaultCategory && item !== category),
  });
}
async function remove(entry) {
  await fs.rm(entry.archivePath, { force: true });
  await store().writeStore('comic_cache.json', {
    items: (await entries()).filter((item) => item.id !== entry.id),
  });
}
async function extract(entry) {
  const directory = path.join(app.getPath('temp'), 'comic_reader', entry.id);
  const current = await fs.readdir(directory).catch(() => []);
  if (current.length < entry.pageCount) {
    await fs.rm(directory, { recursive: true, force: true });
    await fs.mkdir(directory, { recursive: true });
    const files = unzipSync(await fs.readFile(entry.archivePath));
    for (let index = 1; index <= entry.pageCount; index++)
      await fs.writeFile(path.join(directory, `${index}.image`), files[`${index}.image`]);
  }
  return Array.from({ length: entry.pageCount }, (_, index) =>
    path.join(directory, `${index + 1}.image`),
  );
}
module.exports = { entries, categories, cache, addCategory, deleteCategory, remove, extract };
