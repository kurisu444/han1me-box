const { dialog } = require('electron');
const fs = require('node:fs/promises');
const { zipSync, unzipSync, strToU8, strFromU8 } = require('fflate');
async function exportBackup(bundle) {
  const name = `han1me-box-${new Date().toISOString().slice(0, 10)}.zip`;
  const result = await dialog.showSaveDialog({
    defaultPath: name,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  });
  if (result.canceled) return false;
  const downloads = {
    ...bundle.downloads,
    tasks: bundle.downloads.tasks.map((task) => {
      const portable = {
        ...task,
        status: 'failed',
        errorMessage: 'Media files are not included in data backups',
      };
      for (const key of [
        'sourceUrl',
        'localVideoPath',
        'localCoverPath',
        'localMetaPath',
        'localCommentPath',
      ])
        delete portable[key];
      return portable;
    }),
  };
  const files = {
    'manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString() }),
  };
  for (const [name, value] of Object.entries({ ...bundle, downloads }))
    files[`${name}.json`] = JSON.stringify(value);
  await fs.writeFile(
    result.filePath,
    zipSync(
      Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)])),
    ),
  );
  return true;
}
async function importBackup() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  });
  if (result.canceled) return;
  const files = unzipSync(await fs.readFile(result.filePaths[0]));
  const json = (name) =>
    files[`${name}.json`] ? JSON.parse(strFromU8(files[`${name}.json`])) : {};
  if (json('manifest').version !== 1) throw new Error('Unsupported backup format');
  return Object.fromEntries(
    ['settings', 'watch', 'library', 'downloads', 'keyframes', 'check_ins'].map((name) => [
      name,
      json(name),
    ]),
  );
}
module.exports = { exportBackup, importBackup };
