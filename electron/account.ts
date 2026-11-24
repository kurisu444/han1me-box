import { TITLE_BAR_HEIGHT, WEBSITE_TOOLBAR_HEIGHT } from '../src/core/window_layout';
import { app, type BrowserWindow, WebContentsView, session } from 'electron';
import { GOOGLE_AUTH_USER_AGENT, isGoogleAuthUrl } from './http';

const accountSelector =
  '#user-modal-trigger[href*="/user/"], ' +
  '#user-modal-trigger a[href*="/user/"], .profile-sub-stats-id, ' +
  'a[href*="/logout"], form[action*="/logout"]';

const challengeSelector = '#challenge-form, #challenge-success-text, #challenge-error-text';

const hanimeHosts = [
  'hanime1.me',
  'www.hanime1.me',
  'hanime1.com',
  'www.hanime1.com',
  'hanimeone.me',
  'www.hanimeone.me',
];

function originOf(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.origin}/`;
    }
  } catch {}
  return undefined;
}

function candidateUrls(primaryUrl: string, currentUrl?: string): string[] {
  const urls = new Set<string>();
  const addWithWwwToggle = (raw?: string) => {
    const origin = originOf(raw);
    if (!origin) {
      return;
    }
    urls.add(origin);
    const parsed = new URL(origin);
    if (parsed.hostname.startsWith('www.')) {
      urls.add(
        `${parsed.protocol}//${parsed.hostname.slice(4)}${parsed.port ? `:${parsed.port}` : ''}/`,
      );
    } else if (parsed.hostname.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      urls.add(
        `${parsed.protocol}//www.${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}/`,
      );
    }
  };
  addWithWwwToggle(primaryUrl);
  addWithWwwToggle(currentUrl);
  const primaryHost = originOf(primaryUrl) ? new URL(primaryUrl).hostname.toLowerCase() : '';
  if (hanimeHosts.includes(primaryHost)) {
    for (const host of hanimeHosts) {
      urls.add(`https://${host}/`);
    }
  }
  return [...urls];
}

async function collectCookies(urls: string[]): Promise<string> {
  const byName = new Map<string, string>();
  for (const target of urls) {
    for (const cookie of await session.defaultSession.cookies.get({ url: target })) {
      if (!byName.has(cookie.name)) {
        byName.set(cookie.name, cookie.value);
      }
    }
  }
  return [...byName.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

const loginHtmlMarker = new RegExp(
  [
    'id=["\']user-modal-trigger["\'][^>]*href=["\'][^"\']*/user/\\d+',
    'href=["\'][^"\']*/user/\\d+[^>]*id=["\']user-modal-trigger["\']',
    'class=["\'][^"\']*profile-sub-stats-id',
    'action=["\'][^"\']*/logout["\']',
    'href=["\'][^"\']*/logout["\']',
  ].join('|'),
);

async function probeLoggedIn(targetUrl: string): Promise<boolean> {
  const { request } = require('./http') as typeof import('./http');
  const response = await request(new URL('/', targetUrl).href);
  return response.statusCode === 200 && loginHtmlMarker.test(response.body);
}

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
  contents.on('did-start-navigation', (_event, navUrl, _isInPlace, isMainFrame) => {
    if (isMainFrame) {
      contents.setUserAgent(
        isGoogleAuthUrl(navUrl) ? GOOGLE_AUTH_USER_AGENT : app.userAgentFallback,
      );
    }
  });
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
  return collectCookies(candidateUrls(url));
}

export async function importCookies(url: string, value: string): Promise<void> {
  const targets = candidateUrls(url);
  for (const part of value.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) {
      continue;
    }
    const name = part.slice(0, index).trim();
    const cookieValue = part.slice(index + 1).trim();
    for (const target of targets) {
      await session.defaultSession.cookies.remove(target, name).catch(() => {});
    }
    await session.defaultSession.cookies.set({
      url,
      name,
      value: cookieValue,
      path: '/',
    });
  }
}

export async function clearCookies(url: string): Promise<void> {
  for (const target of candidateUrls(url)) {
    for (const cookie of await session.defaultSession.cookies.get({ url: target })) {
      if (cookie.name !== 'cf_clearance') {
        await session.defaultSession.cookies.remove(target, cookie.name);
      }
    }
  }
}

export async function login(url: string, parent: BrowserWindow): Promise<boolean> {
  const previous = (await session.defaultSession.cookies.get({ url }))
    .filter((cookie) => cookie.name !== 'cf_clearance')
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  await clearCookies(url);
  let lastUrl = url;
  const loggedIn = await new Promise<boolean>((resolve) => {
    const window = openWebsite(url, parent, '网页登录');
    let checking = false;
    let lastProbe = 0;
    let loggedIn = false;

    const rememberUrl = () => {
      if (!window.isDestroyed()) {
        const current = window.webContents.getURL();
        if (originOf(current) && !isGoogleAuthUrl(current)) {
          lastUrl = current;
        }
      }
    };

    async function capture() {
      if (checking || window.isDestroyed()) {
        return;
      }
      checking = true;
      try {
        const current = window.webContents.getURL();
        if (isGoogleAuthUrl(current)) {
          return;
        }
        rememberUrl();
        const isChallenge = Boolean(
          await window.webContents.executeJavaScript(
            `Boolean(document.querySelector(${JSON.stringify(challengeSelector)}))`,
          ),
        );
        if (isChallenge) {
          return;
        }
        loggedIn = Boolean(
          await window.webContents.executeJavaScript(
            `Boolean(document.querySelector(${JSON.stringify(accountSelector)}))`,
          ),
        );
        const candidates = candidateUrls(url, current || lastUrl);
        const saved = await collectCookies(candidates);
        const hasAuth = /(?:^|;\s*)(remember_web|hanime1_session|laravel_session)=/i.test(saved);
        if (
          !loggedIn &&
          Date.now() - lastProbe >= 2000 &&
          (hasAuth || (originOf(current) && new URL(current).pathname !== '/login'))
        ) {
          lastProbe = Date.now();
          loggedIn = await probeLoggedIn(current || lastUrl);
          if (!loggedIn && originOf(current) !== originOf(url)) {
            loggedIn = await probeLoggedIn(url);
          }
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
    window.webContents.on('did-navigate', capture);
    window.webContents.on('did-navigate-in-page', capture);
    void window.closed.then(async () => {
      clearInterval(timer);
      if (!loggedIn) {
        try {
          const merged = await collectCookies(candidateUrls(url, lastUrl));
          const hasAuth = /(?:^|;\s*)(remember_web|hanime1_session|laravel_session)=/i.test(merged);
          if (hasAuth) {
            loggedIn = await probeLoggedIn(lastUrl);
            if (!loggedIn && originOf(lastUrl) !== originOf(url)) {
              loggedIn = await probeLoggedIn(url);
            }
          }
        } catch {}
      }
      resolve(loggedIn);
    });
  });
  if (loggedIn) {
    const merged = await collectCookies(candidateUrls(url, lastUrl));
    if (merged) {
      await importCookies(url, merged);
    }
  } else {
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
