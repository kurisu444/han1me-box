const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const launcher = require('chrome-launcher');
const puppeteer = require('puppeteer-core');
const accountFile = path.resolve(__dirname, '../../electron/account.js');
const accountRequire = createRequire(accountFile);
app.on('window-all-closed', () => {});

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'han1me-login-test-'));
  app.setPath('userData', root);
  let chrome, control, server;
  const windows = [];
  try {
    await app.whenReady();
    server = http.createServer((req, res) => {
      if (!['/login', '/finish'].includes(req.url)) {
        res.writeHead(204);
        return res.end();
      }
      res.setHeader('Content-Type', 'text/html');
      res.setHeader(
        'Set-Cookie',
        `hanime1_session=${req.url === '/finish' ? 'signed-in' : 'anonymous'}; Path=/; HttpOnly`,
      );
      res.end(
        req.url === '/finish'
          ? '<a id="user-modal-trigger" href="/user/7">Account</a>'
          : '<h1>Login fixture</h1>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const waitFor = async (check) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw Error('Login fixture timed out');
    };
    const source = await fs.readFile(accountFile, 'utf8');
    function loadAccount(missingChrome = false) {
      const module = { exports: {} };
      vm.runInNewContext(source, {
        module,
        URL,
        setInterval,
        clearInterval,
        require(name) {
          if (name === 'electron')
            return {
              app,
              session,
              BrowserWindow: class extends BrowserWindow {
                constructor(options) {
                  super({ ...options, show: false });
                  windows.push(this);
                }
              },
            };
          if (name === 'chrome-launcher')
            return {
              Launcher: {
                getFirstInstallation() {
                  if (missingChrome)
                    throw Object.assign(new Error('Not installed'), {
                      code: 'ERR_LAUNCHER_PATH_NOT_SET',
                    });
                  return launcher.Launcher.getFirstInstallation();
                },
              },
            };
          if (name === 'puppeteer-core')
            return {
              TargetCloseError: puppeteer.TargetCloseError,
              async launch(options) {
                chrome = await puppeteer.launch({
                  ...options,
                  headless: true,
                  args: [...options.args, '--headless=new'],
                });
                control = await puppeteer.connect({
                  browserWSEndpoint: chrome.wsEndpoint(),
                });
                return chrome;
              },
            };
          return accountRequire(name);
        },
      });
      return module.exports;
    }
    let focused = 0;
    const parent = { isDestroyed: () => false, focus: () => focused++ };
    const account = loadAccount();
    await account.importCookies(base, 'existing=keep');
    let completed = false;
    const login = account.login(base + '/login', parent).then((result) => {
      completed = true;
      return result;
    });
    await waitFor(() => control?.connected);
    const [page] = await control.pages();
    await waitFor(() => page.url() === base + '/login');
    await page.setCookie({
      url: 'https://unrelated.example.test',
      name: 'unrelated',
      value: 'keep',
      expires: Math.floor(Date.now() / 1000) + 3600,
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
    assert.equal(completed, false, 'Anonymous session cookie is not a successful login');
    await page.goto(base + '/finish');
    assert.equal(await login, true);
    assert.equal(await account.cookies(base), 'hanime1_session=signed-in');
    assert.equal(focused, 1);
    console.log('PASS real Chrome login transfers only site cookies and closes its own instance');

    control = undefined;
    const cancelled = account.login(base + '/login', parent);
    await waitFor(() => control?.connected);
    const [second] = await control.pages();
    await waitFor(() => second.url() === base + '/login');
    assert.equal((await second.cookies('https://unrelated.example.test'))[0].value, 'keep');
    assert.equal(
      (await second.cookies(base)).some((cookie) => cookie.value === 'signed-in'),
      false,
    );
    await second.close();
    assert.equal(await cancelled, false);
    assert.equal(await account.cookies(base), 'hanime1_session=signed-in');
    console.log(
      'PASS repeat login clears old site login, retains other sessions, and cancellation preserves app account',
    );

    const fallback = loadAccount(true);
    const embedded = fallback.login(base + '/login');
    await waitFor(() => windows.length === 1);
    await windows[0].loadURL(base + '/finish');
    assert.equal(await embedded, true);
    const closed = fallback.login(base + '/login');
    await waitFor(() => windows.length === 2);
    windows[1].close();
    assert.equal(await closed, false);
    console.log('PASS missing Chrome falls back to the original BrowserWindow login');
  } finally {
    control?.disconnect();
    await chrome?.close();
    for (const window of windows) if (!window.isDestroyed()) window.destroy();
    server?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})()
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
