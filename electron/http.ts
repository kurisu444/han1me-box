import { app, net, protocol, session, type Session, type WebContents } from 'electron';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import type { AppSettings } from '../src/core/settings';
import type { Han1meHttpResponse } from './preload';

// net.fetch 在当前 Electron 返回空 response.url；业务需要重定向后的域名和登录路径。
export function request(
  url: string,
  method = 'GET',
  headers: Record<string, string> = {},
  body?: string,
  charset = 'utf-8',
): Promise<Han1meHttpResponse> {
  return new Promise((resolve, reject) => {
    const req = net.request({
      url,
      method,
      credentials: 'include',
      origin: new URL(url).origin,
    });
    let finalUrl = url;
    for (const [name, value] of Object.entries(headers)) {
      req.setHeader(name, value);
    }
    req.on('redirect', (_status, _method, target) => {
      finalUrl = target;
      req.followRedirect();
    });
    req.on('error', reject);
    req.on('response', async (response) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of response as unknown as AsyncIterable<Buffer>) {
          chunks.push(chunk);
        }
        resolve({
          statusCode: response.statusCode,
          body: new TextDecoder(charset).decode(Buffer.concat(chunks)),
          headers: Object.fromEntries(
            Object.entries(response.headers).map(([name, value]) => [
              name,
              Array.isArray(value) ? value.join(', ') : value,
            ]),
          ),
          url: finalUrl,
        });
      } catch (error) {
        reject(error);
      }
    });
    req.end(body);
  });
}

export const GOOGLE_AUTH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0';

export function isGoogleAuthUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'accounts.google.com' || host === 'accounts.youtube.com';
  } catch {
    return false;
  }
}

export function configureUserAgent() {
  const userAgent = app.userAgentFallback.replace(/\s+(?:han1me-box|Electron)\/\S+/g, '');
  app.userAgentFallback = userAgent;
  session.defaultSession.setUserAgent(userAgent);
  return userAgent;
}

const mimeTypes: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function registerLocalMediaProtocol() {
  protocol.handle('han1me-local', async (req) => {
    const filePath = new URL(req.url).searchParams.get('path');
    if (!filePath) {
      return new Response(null, { status: 400 });
    }

    let size: number;
    try {
      size = (await stat(filePath)).size;
    } catch {
      return new Response(null, { status: 404 });
    }

    const contentType = mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    const range = req.headers.get('range');

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        return new Response(null, { status: 416 });
      }
      const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      }
      return new Response(
        Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream,
        {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1),
          },
        },
      );
    }

    return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(size),
      },
    });
  });
}

export function mediaReferer(settings: Partial<AppSettings>, pageUrl: string): string {
  if (/^#\/(?:getchu(?:\/|$)|video\/getchu-)/.test(new URL(pageUrl).hash)) {
    return 'https://www.getchu.com/';
  }
  const mirror = settings.useCustomMirrorSite && settings.customMirrorSite;
  const home = mirror || settings.baseUrl || 'https://hanime1.me';
  const base = mirror && settings.appendCustomMirrorPath === false ? new URL(home).origin : home;
  const id = /^#\/video\/([^/?]+)/.exec(new URL(pageUrl).hash)?.[1];
  return id ? `${base.replace(/\/+$/, '')}/watch?v=${id}` : home;
}

export function installRequestHeaders(
  browserSession: Session,
  contents?: WebContents | ((webContentsId: number) => WebContents | undefined),
  getSettings: () => Partial<AppSettings> = () => ({}),
) {
  browserSession.webRequest.onBeforeSendHeaders(async (details, callback) => {
    const headers = details.requestHeaders;
    if (isGoogleAuthUrl(details.url)) {
      for (const name of Object.keys(headers)) {
        const lower = name.toLowerCase();
        if (lower === 'user-agent' || lower.startsWith('sec-ch-ua')) {
          delete headers[name];
        }
      }
      headers['User-Agent'] = GOOGLE_AUTH_USER_AGENT;
    }
    // 主进程网络请求不会自动携带分区 Cookie 或跨站上下文下的 SameSite=Lax 会话 Cookie，按 URL 补齐。
    if (!details.webContents && /^https?:/.test(details.url)) {
      const stored = await browserSession.cookies.get({ url: details.url });
      if (stored.length > 0) {
        const headerName =
          Object.keys(headers).find((key) => key.toLowerCase() === 'cookie') || 'Cookie';
        const merged = new Map<string, string>();
        for (const part of (headers[headerName] || '').split(/;\s*/)) {
          const eq = part.indexOf('=');
          if (eq > 0) {
            merged.set(part.slice(0, eq), part.slice(eq + 1));
          }
        }
        for (const cookie of stored) {
          if (cookie.name) {
            merged.delete(cookie.name);
            merged.set(cookie.name, cookie.value);
          }
        }
        headers[headerName] = [...merged.entries()]
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');
      }
    }
    const target =
      typeof contents === 'function'
        ? details.webContentsId !== undefined
          ? contents(details.webContentsId)
          : undefined
        : contents && details.webContentsId === contents.id
          ? contents
          : undefined;
    if (
      target &&
      (['media', 'image'].includes(details.resourceType) ||
        (details.resourceType === 'xhr' && /^#\/video\//.test(new URL(target.getURL()).hash)))
    ) {
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'referer') {
          delete headers[name];
        }
      }
      headers.Referer = mediaReferer(getSettings(), target.getURL());
      if (headers.Referer === 'https://www.getchu.com/') {
        headers.Cookie = 'getchu_adalt_flag=getchu.com; gc=gc';
      }
    }
    callback({ requestHeaders: headers });
  });
}
