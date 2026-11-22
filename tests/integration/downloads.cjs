const { app, BrowserWindow, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const downloads = require('../../electron/downloads');
const { registerLocalMediaProtocol } = require('../../electron/http');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'han1me-local',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
]);
app.on('window-all-closed', () => {});
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'han1me-download-test-'));
  app.setPath('userData', root);
  let server, playerWindow;
  try {
    await app.whenReady();
    registerLocalMediaProtocol();
    const mediaPath = path.join(root, '本地 视频 #1.webm');
    await fs.copyFile(path.join(__dirname, '../fixtures/playback.webm'), mediaPath);
    const mediaUrl = `han1me-local://media/?${new URLSearchParams({ path: mediaPath })}`;
    playerWindow = new BrowserWindow({ show: false });
    await playerWindow.loadURL('data:text/html,<video muted preload="auto"></video>');
    const playback = await playerWindow.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const video = document.querySelector('video');
        const timer = setTimeout(() => reject(new Error('Local seek timed out')), 10000);
        const positions = [];
        video.onerror = () => reject(new Error(video.error.message));
        video.onloadedmetadata = () => {
          if (!video.seekable.length || video.seekable.end(0) < video.duration - 0.1) {
            reject(new Error('Local file is not fully seekable'));
            return;
          }
          video.currentTime = video.duration * 0.8;
        };
        video.onseeked = () => {
          positions.push(video.currentTime / video.duration);
          if (positions.length === 1) video.currentTime = video.duration * 0.2;
          else video.play().catch(reject);
        };
        video.onplaying = () => {
          clearTimeout(timer);
          video.pause();
          resolve(positions);
        };
        video.src = ${JSON.stringify(mediaUrl)};
      })
    `);
    assert.equal(playback.length, 2);
    assert.ok(Math.abs(playback[0] - 0.8) < 0.01, 'Forward seek reaches requested position');
    assert.ok(Math.abs(playback[1] - 0.2) < 0.01, 'Backward seek reaches requested position');
    playerWindow.destroy();
    console.log('PASS local media plays and seeks forward/backward without network');
    let range;
    const bytes = Buffer.from('download-resume-fixture');
    server = http.createServer((request, response) => {
      range = request.headers.range;
      const offset = Number(/bytes=(\d+)-/.exec(range ?? '')?.[1] ?? 0);
      response.writeHead(offset ? 206 : 200, { 'Content-Length': bytes.length - offset });
      response.end(bytes.subarray(offset));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const directory = path.join(root, 'downloads');
    await downloads.initialize({ downloadPath: directory, concurrentDownloads: 1 });
    await fs.mkdir(path.join(directory, '1'), { recursive: true });
    await fs.writeFile(path.join(directory, '1', 'video_720.mp4.part'), bytes.subarray(0, 5));
    const source = { quality: '720', url: `http://127.0.0.1:${server.address().port}/video` };
    assert.equal(await downloads.create({ id: '1', title: 'Fixture', tags: [] }, source), 'queued');
    for (
      let attempt = 0;
      attempt < 100 && downloads.getState().tasks[0].status !== 'completed';
      attempt++
    )
      await new Promise((resolve) => setTimeout(resolve, 30));
    const task = downloads.getState().tasks[0];
    assert.equal(task.status, 'completed', task.errorMessage);
    assert.equal(range, 'bytes=5-');
    assert.deepEqual(await fs.readFile(task.localVideoPath), bytes);
    assert.equal(
      await downloads.create({ id: '1', title: 'Fixture', tags: [] }, source),
      'alreadyDownloaded',
    );
    const group = await downloads.updateGroup('', 'Test', 'name');
    await downloads.setTaskGroups(['1'], [group]);
    await downloads.togglePinned(['1']);
    assert.equal(downloads.getState().tasks[0].pinned, true);
    await downloads.deleteGroup(group);
    assert.deepEqual(downloads.getState().tasks[0].groupIds, []);
    await downloads.exportCompleted(path.join(root, 'export'));
    assert.deepEqual(await fs.readFile(path.join(root, 'export', '1', 'video_720.mp4')), bytes);
    await downloads.deleteTasks(['1']);
    assert.equal(downloads.getState().tasks.length, 0);
    console.log('PASS range resume, duplicate download, groups, pinning, export and deletion');
    const recovered = path.join(root, 'recovery');
    await fs.mkdir(recovered);
    await fs.writeFile(path.join(recovered, 'download_store.json'), '{broken');
    await fs.writeFile(
      path.join(recovered, 'download_store.json.bak'),
      JSON.stringify({
        groups: [null, { id: 'legacy', name: 'Legacy' }],
        tasks: [null, { id: '2', videoCode: '2', groupId: 'legacy', title: null }],
      }),
    );
    await downloads.initialize({ downloadPath: recovered });
    assert.equal(downloads.getState().groups[0].id, 'default');
    assert.equal(downloads.getState().tasks[0].title, '');
    assert.equal(downloads.getState().tasks[0].status, 'failed');
    assert.deepEqual(downloads.getState().tasks[0].groupIds, ['legacy']);
    console.log(
      'PASS corrupted primary store restores backup, legacy groups and original defaults',
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (playerWindow && !playerWindow.isDestroyed()) playerWindow.destroy();
    server?.close();
    await fs.rm(root, { recursive: true, force: true });
    app.exit(process.exitCode ?? 0);
  }
})();
