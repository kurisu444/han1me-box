const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const account = require('../../dist-electron/account');
app.on('window-all-closed', () => {});

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'han1me-login-test-'));
  app.setPath('userData', root);
  let parent, server;
  try {
    await app.whenReady();
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html');
      if (req.url === '/login') {
        res.setHeader('Set-Cookie', 'hanime1_session=anonymous; Path=/; HttpOnly');
        return res.end('<h1>Login fixture</h1>');
      }
      if (req.url === '/finish') {
        res.setHeader('Set-Cookie', 'hanime1_session=signed-in; Path=/; HttpOnly');
        return res.end('<a id="user-modal-trigger" href="/user/7">Account</a>');
      }
      if (req.url === '/') {
        return res.end(
          req.headers.cookie?.includes('signed-in')
            ? '<a id="user-modal-trigger" href="/user/7">Account</a>'
            : 'Guest',
        );
      }
      if (req.url === '/challenge' && !req.headers.cookie?.includes('cf_clearance=verified')) {
        res.writeHead(403, { 'cf-mitigated': 'challenge' });
        return res.end('challenge-form');
      }
      if (req.url === '/verify') {
        res.setHeader('Set-Cookie', 'cf_clearance=verified; Path=/');
      }
      res.end('<h1>Site fixture</h1>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const waitFor = async (check) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw Error('Embedded login fixture timed out');
    };
    parent = new BrowserWindow({ show: false, width: 1000, height: 760 });
    await parent.loadURL('data:text/html,<input value="App state">');
    const siteView = () =>
      parent.contentView.children.find((v) => v.webContents !== parent.webContents);
    const checkRestored = () => {
      assert.equal(BrowserWindow.getAllWindows().length, 1);
      assert.equal(siteView(), undefined);
      assert.equal(parent.listenerCount('resize'), 0);
    };
    await account.importCookies(base, 'existing=keep; cf_clearance=old');
    let completed = false;
    const login = account.login(base + '/login', parent).then((result) => {
      completed = true;
      return result;
    });
    await waitFor(() => siteView()?.webContents.getURL() === base + '/login');
    const view = siteView();
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    assert.equal(view.webContents.session, session.defaultSession);
    const [width, height] = parent.getContentSize();
    assert.deepEqual(view.getBounds(), { x: 0, y: 92, width, height: height - 92 });
    assert.equal(await view.webContents.executeJavaScript('typeof window.electron'), 'undefined');
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.equal(completed, false, 'Anonymous cookies do not complete login');
    await view.webContents.executeJavaScript(
      `window.open(${JSON.stringify(base + '/finish')}); void 0`,
    );
    assert.equal(await login, true);
    checkRestored();
    assert.match(await account.cookies(base), /hanime1_session=signed-in/);
    assert.equal(
      await parent.webContents.executeJavaScript('document.querySelector("input").value'),
      'App state',
    );
    console.log('PASS embedded login, same-view popup, shared cookies and preserved app state');

    const cancelled = account.login(base + '/login', parent);
    await waitFor(() => siteView()?.webContents.getURL() === base + '/login');
    account.closeWebsite(parent);
    assert.equal(await cancelled, false);
    assert.match(await account.cookies(base), /hanime1_session=signed-in/);
    assert.match(await account.cookies(base), /cf_clearance=old/);
    checkRestored();
    console.log('PASS cancelling embedded login restores the current account');

    const verified = account.openVerification(base + '/challenge', parent);
    await waitFor(() => siteView()?.webContents.getURL() === base + '/challenge');
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.ok(siteView(), 'Old clearance does not dismiss a challenge');
    await siteView().webContents.loadURL(base + '/verify');
    await verified;
    checkRestored();
    assert.match(await account.cookies(base), /cf_clearance=verified/);
    const existing = account.openVerification(base + '/challenge', parent);
    await existing;
    checkRestored();
    console.log('PASS verification returns automatically for new and already valid clearance');

    const profile = account.openProfile(base + '/profile', parent);
    await waitFor(() => siteView()?.webContents.getURL() === base + '/profile');
    parent.setContentSize(800, 600);
    parent.emit('resize');
    const [newWidth, newHeight] = parent.getContentSize();
    assert.deepEqual(siteView().getBounds(), {
      x: 0,
      y: 92,
      width: newWidth,
      height: newHeight - 92,
    });
    account.closeWebsite(parent);
    await profile;
    checkRestored();
    const tags = account.openTagEditor(base + '/tags', 'add', parent);
    const contents = siteView().webContents;
    parent.close();
    await tags;
    assert.equal(contents.isDestroyed(), true);
    console.log('PASS embedded pages resize, cancel and release contents when the app closes');
  } finally {
    if (parent && !parent.isDestroyed()) parent.destroy();
    server?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})()
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
