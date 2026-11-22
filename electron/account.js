const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

const accountSelector =
  '#user-modal-trigger[href*="/user/"], ' +
  '#user-modal-trigger a[href*="/user/"], .profile-sub-stats-id';

async function cookies(url) {
  return (await session.defaultSession.cookies.get({ url }))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}
async function importCookies(url, value) {
  for (const part of value.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    await session.defaultSession.cookies.set({
      url,
      name: part.slice(0, index).trim(),
      value: part.slice(index + 1).trim(),
      path: '/',
    });
  }
}
async function clearCookies(url) {
  for (const cookie of await session.defaultSession.cookies.get({ url })) {
    if (cookie.name !== 'cf_clearance')
      await session.defaultSession.cookies.remove(url, cookie.name);
  }
}
async function login(url, parent) {
  const { Launcher } = require('chrome-launcher');
  let chromePath;
  try {
    chromePath = Launcher.getFirstInstallation();
  } catch (error) {
    if (error.code !== 'ERR_LAUNCHER_PATH_NOT_SET') throw error;
  }
  if (!chromePath) return loginEmbedded(url, parent);

  const { launch, TargetCloseError } = require('puppeteer-core');
  const userDataDir = path.join(app.getPath('userData'), 'chrome-profile');
  const browser = await launch({
    executablePath: chromePath,
    headless: false,
    defaultViewport: null,
    ignoreDefaultArgs: true,
    args: [
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
  });
  try {
    const [page] = await browser.pages();
    // 添加账号时退出该站点的旧账号，保留独立 Chrome 中的 Google 登录状态。
    const previous = await page.cookies(url);
    await page.deleteCookie(...previous.filter((cookie) => cookie.name !== 'cf_clearance'));
    await page.goto(url).catch(() => {});
    await page.waitForFunction(
      (origin, selector) => location.origin === origin && Boolean(document.querySelector(selector)),
      { timeout: 0, polling: 700 },
      new URL(url).origin,
      accountSelector,
    );
    const saved = await page.cookies(url);
    await clearCookies(url);
    await importCookies(url, saved.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '));
    return true;
  } catch (error) {
    if (error instanceof TargetCloseError || error.cause instanceof TargetCloseError) return false;
    throw error;
  } finally {
    await browser.close();
    if (parent && !parent.isDestroyed()) parent.focus();
  }
}

async function loginEmbedded(url, parent) {
  await clearCookies(url);
  return new Promise((resolve) => {
    const window = new BrowserWindow({ width: 1000, height: 760, parent });
    let checking = false;
    let lastAttempt = 0;
    let loggedIn = false;
    async function capture() {
      if (checking || window.isDestroyed() || Date.now() - lastAttempt < 2000) return;
      checking = true;
      try {
        loggedIn = await window.webContents.executeJavaScript(
          `Boolean(document.querySelector(${JSON.stringify(accountSelector)}))`,
        );
        const current = window.webContents.getURL();
        const saved = await session.defaultSession.cookies.get({ url: current || url });
        const hasAuth = saved.some((cookie) =>
          /^(remember_web|hanime1_session$|laravel_session$)/i.test(cookie.name),
        );
        if (!loggedIn && (hasAuth || (current && new URL(current).pathname !== '/login'))) {
          lastAttempt = Date.now();
          const response = await require('./http').request(new URL('/', url).href);
          const marker = new RegExp(
            [
              'id=["\']user-modal-trigger["\'][^>]*href=["\'][^"\']*/user/\\d+',
              'href=["\'][^"\']*/user/\\d+[^>]*id=["\']user-modal-trigger["\']',
              'class=["\'][^"\']*profile-sub-stats-id',
            ].join('|'),
          );
          loggedIn = response.statusCode === 200 && marker.test(response.body);
        }
        if (loggedIn && !window.isDestroyed()) window.close();
      } catch {
      } finally {
        checking = false;
      }
    }
    const timer = setInterval(capture, 700);
    window.webContents.on('did-finish-load', capture);
    window.once('closed', () => {
      clearInterval(timer);
      resolve(loggedIn);
    });
    window.loadURL(url).catch(() => {});
  });
}
function openProfile(url, parent) {
  return new Promise((resolve) => {
    const window = new BrowserWindow({ width: 1000, height: 760, parent });
    window.once('closed', resolve);
    window.loadURL(url).catch(() => {});
  });
}
async function openVerification(url, parent) {
  const browserSession = session.defaultSession;
  const readClearance = async (requestUrl) =>
    (await browserSession.cookies.get({ url: requestUrl, name: 'cf_clearance' }))[0]?.value;
  const initialClearance = await readClearance(url);

  return new Promise((resolve) => {
    const window = new BrowserWindow({ width: 1000, height: 760, parent });
    let checking = false;

    async function completeVerification() {
      if (checking || window.isDestroyed()) return;
      checking = true;
      try {
        const requestUrl = window.webContents.getURL() || url;
        const clearance = (await readClearance(requestUrl)) || (await readClearance(url));
        if (!clearance || window.isDestroyed()) return;
        // 探测旧 Cookie，避免把尚未通过验证的旧凭证当成成功。
        if (clearance === initialClearance) {
          const response = await browserSession.fetch(requestUrl, { credentials: 'include' });
          const body = await response.text();
          const challenged =
            response.status === 403 &&
            (response.headers.get('cf-mitigated')?.toLowerCase() === 'challenge' ||
              ['cf-chl-', 'challenge-form', 'Just a moment', 'Attention Required'].some((marker) =>
                body.includes(marker),
              ));
          if (challenged) return;
        }
        if (!window.isDestroyed()) window.close();
      } catch {
        // 探测失败时留在验证窗口，允许继续验证或手动关闭。
      } finally {
        checking = false;
      }
    }

    const timer = setInterval(completeVerification, 700);
    window.webContents.on('did-finish-load', completeVerification);
    window.once('closed', () => {
      clearInterval(timer);
      resolve();
    });
    // 挑战页可能继续导航；单次加载失败不代表用户的验证流程已经结束。
    window.loadURL(url).catch(() => {});
  });
}

function openTagEditor(url, mode, parent) {
  return new Promise((resolve) => {
    const window = new BrowserWindow({ width: 850, height: 700, parent });
    const selector = mode === 'add' ? '#add-tags-modal' : '#remove-tags-modal';
    window.webContents.on('did-finish-load', () => {
      void window.webContents
        .executeJavaScript(
          `(() => {
        const selector = ${JSON.stringify(selector)};
        const modal = document.querySelector(selector);
        if (!modal) return;
        const trigger = document.querySelector(
          '[data-target="' + selector + '"], [data-bs-target="' + selector +
          '"], [href="' + selector + '"]');
        if (trigger) trigger.click();
        if (!modal.classList.contains('show')) {
          modal.style.display = 'block';
          modal.classList.add('show');
          modal.setAttribute('aria-modal', 'true');
          modal.removeAttribute('aria-hidden');
        }
        document.querySelectorAll('body > *').forEach((element) => {
          if (element !== modal && !element.contains(modal) &&
            !element.classList.contains('modal-backdrop')) element.style.display = 'none';
        });
        document.body.style.background = 'transparent';
        document.body.style.overflow = 'auto';
        modal.style.position = 'relative';
        modal.style.inset = 'auto';
        modal.style.padding = '0';
        modal.querySelector('.modal-dialog')?.style.setProperty('margin', '0 auto');
      })()`,
        )
        .catch(() => {});
    });
    window.once('closed', resolve);
    window.loadURL(url).catch(() => {});
  });
}

module.exports = {
  cookies,
  importCookies,
  clearCookies,
  login,
  openProfile,
  openVerification,
  openTagEditor,
};
