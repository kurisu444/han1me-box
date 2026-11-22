import { log } from './logging/app_log';

export function siteHomeUrl(baseUrl: string): string {
  if (!baseUrl) return baseUrl;
  const trimmed = baseUrl.replace(/\/+$/, '');
  const uri = URL.parse(trimmed, 'https://site.invalid');
  return uri?.pathname === '/' || uri?.pathname === '' ? `${trimmed}/` : trimmed;
}

export function siteEndpointUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return baseUrl;
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  if (!path.trim()) return trimmedBase;
  return `${trimmedBase}/${path.replace(/^\/+/, '')}`;
}

export const hanimeSiteHosts: ReadonlySet<string> = new Set([
  'hanime1.com',
  'hanimeone.me',
  'hanime1.me',
  'javchu.com',
  'hanime169.net',
  'www.hanime169.net',
]);

// 仅保留原站点媒体地址改写，不迁移 ECH、固定 IP 或 socket 补丁。
export function rewriteMediaUrl(value: string): string {
  const url = new URL(value);
  if (url.hostname === 'vdownload.hembed.com') {
    url.hostname = '1497203185.rsc.cdn77.org';
    log('media host vdownload.hembed.com -> 1497203185.rsc.cdn77.org');
  }
  return url.href.replace(/^(https?:\/\/)t\d+\.(cdn2020\.com)(?=\/|:)/i, '$1t33.$2');
}
