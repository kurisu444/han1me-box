const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

test('Backup ZIP interoperates with external deflated UTF-8 archives and data descriptors', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'han1me-zip-'));
  const archivePath = path.join(root, 'backup.zip');
  const dialog = {
    showSaveDialog: async () => ({ filePath: archivePath }),
    showOpenDialog: async () => ({ filePaths: [archivePath] }),
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../electron/backup.js'), 'utf8'), {
    module,
    require: (name) => (name === 'electron' ? { dialog } : require(name)),
  });
  try {
    await module.exports.exportBackup({ settings: { title: '测试' }, downloads: { tasks: [] } });
    execFileSync(
      'uv',
      [
        'run',
        '--offline',
        '--no-project',
        '--no-sync',
        '--no-managed-python',
        'python',
        '-c',
        `
import io, zipfile, pathlib, sys
file = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(file) as archive:
    assert archive.testzip() is None
    assert '测试' in archive.read('settings.json').decode()
class Unseekable(io.BytesIO):
    def seek(self, *args): raise io.UnsupportedOperation('seek')
stream = Unseekable()
with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('manifest.json', '{"version":1}')
    archive.writestr('settings.json', '{"title":"外部备份"}')
file.write_bytes(stream.getvalue())
`,
        archivePath,
      ],
      { stdio: 'pipe' },
    );
    const imported = await module.exports.importBackup();
    assert.equal(imported.settings.title, '外部备份');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
