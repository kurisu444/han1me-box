import { dialog } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { DownloadState } from '../src/domain/models/download';
import type { BackupBundle } from '../src/features/settings/data_settings';

const stripTaskKeys = [
  'sourceUrl',
  'localVideoPath',
  'localCoverPath',
  'localMetaPath',
  'localCommentPath',
] as const;

export async function exportBackup(bundle: Record<string, unknown>): Promise<boolean> {
  const name = `han1me-box-${new Date().toISOString().slice(0, 10)}.zip`;
  const result = await dialog.showSaveDialog({
    defaultPath: name,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePath) {
    return false;
  }
  const rawDownloads = bundle.downloads as DownloadState;
  const downloads = {
    ...rawDownloads,
    tasks: rawDownloads.tasks.map((task) => {
      const portable: Record<string, unknown> = {
        ...task,
        status: 'failed',
        errorMessage: 'Media files are not included in data backups',
      };
      for (const key of stripTaskKeys) {
        delete portable[key];
      }
      return portable;
    }),
  };
  const files: Record<string, string> = {
    'manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString() }),
  };
  for (const [key, value] of Object.entries({ ...bundle, downloads })) {
    files[`${key}.json`] = JSON.stringify(value);
  }
  await writeFile(
    result.filePath,
    zipSync(Object.fromEntries(Object.entries(files).map(([k, value]) => [k, strToU8(value)]))),
  );
  return true;
}

export async function importBackup(): Promise<BackupBundle | undefined> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePaths[0]) {
    return undefined;
  }
  const files = unzipSync(await readFile(result.filePaths[0]));
  const json = (name: string) =>
    files[`${name}.json`] ? JSON.parse(strFromU8(files[`${name}.json`])) : {};
  if (json('manifest').version !== 1) {
    throw new Error('Unsupported backup format');
  }
  return Object.fromEntries(
    ['settings', 'watch', 'library', 'downloads', 'keyframes', 'check_ins'].map((name) => [
      name,
      json(name),
    ]),
  ) as unknown as BackupBundle;
}
