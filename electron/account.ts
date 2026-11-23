import { TITLE_BAR_HEIGHT, WEBSITE_TOOLBAR_HEIGHT } from '../src/core/window_layout';
import { type BrowserWindow, WebContentsView, session } from 'electron';

const accountSelector =
  '#user-modal-trigger[href*="/user/"], ' +
  '#user-modal-trigger a[href*="/user/"], .profile-sub-stats-id';

const websites = new WeakMap<BrowserWindow, () => void>();

export function closeWebsite(parent: BrowserWindow): void {
  websites.get(parent)?.();
}

function openWebsite(url: string, parent: BrowserWindow, title: string) {
  closeWebsite(parent);
  const view = new WebContentsView();
  const contents = view.webContents;
  const close = () => {
    if (!contents.isDestroyed()) {
      contents.close();
    }
  };
  function resize() {
    const [width, height] = parent.getContentSize();
    const top = TITLE_BAR_HEIGHT + WEBSITE_TOOLBAR_HEIGHT;
    view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
  }
  const closed = new Promise<void>((resolve) => {
    contents.once('destroyed', () => {
      parent.removeListener('resize', resize);
      parent.removeListener('closed', close);
      if (!parent.isDestroyed()) {
        parent.contentView.removeChildView(view);
      }
      if (websites.get(parent) === close) {
        websites.delete(parent);
        if (!parent.isDestroyed()) {
          parent.webContents.send('session:website-changed', null);
          parent.webContents.focus();
        }
      }
      resolve();
    });
  });
  websites.set(parent, close);
  parent.contentView.addChildView(view);
  resize();
  parent.on('resize', resize);
  parent.once('closed', close);
  parent.webContents.send('session:website-changed', title);
  contents.setWindowOpenHandler(({ url }) => {
    void contents.loadURL(url).catch(() => {});
    return { action: 'deny' };
  });
  // 挑战页可能继续导航；加载中断不代表整个登录或验证流程结束。
  void contents.loadURL(url).catch(() => {});
  contents.focus();
  return { webContents: contents, close, closed, isDestroyed: () => contents.isDestroyed() };
}

export async function cookies(url: string): Promise<string> {
  return (await session.defaultSession.cookies.get({ url }))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export async function importCookies(url: string, value: string): Promise<void> {
  for (const part of value.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) {
      continue;
    }
    await session.defaultSession.cookies.set({
      url,
      name: part.slice(0, index).trim(),
      value: part.slice(index + 1).trim(),
      path: '/',
    });
  }
}

export async function clearCookies(url: string): Promise<void> {
  for (const cookie of await session.defaultSession.cookies.get({ url })) {
    if (cookie.name !== 'cf_clearance') {
      await session.defaultSession.cookies.remove(url, cookie.name);
    }
  }
}

export async function login(url: string, parent: BrowserWindow): Promise<boolean> {
  const previous = (await session.defaultSession.cookies.get({ url }))
    .filter((cookie) => cookie.name !== 'cf_clearance')
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  await clearCookies(url);
  const loggedIn = await new Promise<boolean>((resolve) => {
    const window = openWebsite(url, parent, '网页登录');
    let checking = false;
    let lastAttempt = 0;
    let loggedIn = false;
    async function capture() {
      if (checking || window.isDestroyed() || Date.now() - lastAttempt < 2000) {
        return;
      }
      checking = true;
      try {
        loggedIn = Boolean(
          await window.webContents.executeJavaScript(
            `Boolean(document.querySelector(${JSON.stringify(accountSelector)}))`,
          ),
        );
        const current = window.webContents.getURL();
        const saved = await session.defaultSession.cookies.get({ url: current || url });
        const hasAuth = saved.some((cookie) =>
          /^(remember_web|hanime1_session$|laravel_session$)/i.test(cookie.name),
        );
        if (!loggedIn && (hasAuth || (current && new URL(current).pathname !== '/login'))) {
          lastAttempt = Date.now();
          const { request } = require('./http') as typeof import('./http');
          const response = await request(new URL('/', url).href);
          const marker = new RegExp(
            [
              'id=["\']user-modal-trigger["\'][^>]*href=["\'][^"\']*/user/\\d+',
              'href=["\'][^"\']*/user/\\d+[^>]*id=["\']user-modal-trigger["\']',
              'class=["\'][^"\']*profile-sub-stats-id',
            ].join('|'),
          );
          loggedIn = response.statusCode === 200 && marker.test(response.body);
        }
        if (loggedIn && !window.isDestroyed()) {
          window.close();
        }
      } catch {
      } finally {
        checking = false;
      }
    }
    const timer = setInterval(capture, 700);
    window.webContents.on('did-finish-load', capture);
    void window.closed.then(() => {
      clearInterval(timer);
      resolve(loggedIn);
    });
  });
  if (!loggedIn) {
    await clearCookies(url);
    await importCookies(url, previous);
  }
  return loggedIn;
}

export function openProfile(url: string, parent: BrowserWindow): Promise<void> {
  return openWebsite(url, parent, '账号资料').closed;
}

export async function openVerification(url: string, parent: BrowserWindow): Promise<void> {
  const browserSession = session.defaultSession;
  const readClearance = async (requestUrl: string) =>
    (await browserSession.cookies.get({ url: requestUrl, name: 'cf_clearance' }))[0]?.value;
  const initialClearance = await readClearance(url);

  return new Promise((resolve) => {
    const window = openWebsite(url, parent, '网站验证');
    let checking = false;

    async function completeVerification() {
      if (checking || window.isDestroyed()) {
        return;
      }
      checking = true;
      try {
        const requestUrl = window.webContents.getURL() || url;
        const clearance = (await readClearance(requestUrl)) || (await readClearance(url));
        if (!clearance || window.isDestroyed()) {
          return;
        }
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
          if (challenged) {
            return;
          }
        }
        if (!window.isDestroyed()) {
          window.close();
        }
      } catch {
        // 探测失败时保留验证页面，允许继续验证或返回应用。
      } finally {
        checking = false;
      }
    }

    const timer = setInterval(completeVerification, 700);
    window.webContents.on('did-finish-load', completeVerification);
    void window.closed.then(() => {
      clearInterval(timer);
      resolve();
    });
  });
}
