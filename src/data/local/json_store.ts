export async function readJsonStore<T>(fileName: StoreFileName): Promise<T> {
  return (await window.electron.store.read(fileName)) as T;
}

export function writeJsonStore(fileName: StoreFileName, value: unknown): Promise<void> {
  return window.electron.store.write(fileName, value);
}

// 同一文件的读改写串行执行，避免播放进度、历史等并发更新互相覆盖。
const writes = new Map<StoreFileName, Promise<void>>();

export function updateJsonStore<T>(
  fileName: StoreFileName,
  update: (current: T) => T,
): Promise<void> {
  const next = (writes.get(fileName) ?? Promise.resolve()).then(async () => {
    const current = await readJsonStore<T>(fileName);
    const updated = update(current);
    if (updated !== current) await writeJsonStore(fileName, updated);
  });
  writes.set(
    fileName,
    next.catch(() => {}),
  );
  return next;
}

// 从本地 JSON 数组中读取对象记录。
export function jsonRecords<T>(value: unknown): Partial<T>[] {
  return Array.isArray(value)
    ? value.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
    : [];
}
