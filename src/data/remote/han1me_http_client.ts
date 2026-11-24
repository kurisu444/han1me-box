import { log } from '../../core/logging/app_log';

const MAX_CONCURRENT_PER_HOST = 3;
const MIN_DELAY_429_MS = 1500;
const MAX_DELAY_429_MS = 8000;
const DEFAULT_DELAY_429_MS = 2000;

interface HostBucket {
  active: number;
  cooldownUntil: number;
  queue: (() => void)[];
}

const buckets = new Map<string, HostBucket>();

function bucketFor(host: string): HostBucket {
  let bucket = buckets.get(host);
  if (!bucket) {
    bucket = { active: 0, cooldownUntil: 0, queue: [] };
    buckets.set(host, bucket);
  }
  return bucket;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(headers: Record<string, string>): number {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'retry-after');
  const raw = key ? headers[key]?.trim() : undefined;
  if (!raw) {
    return DEFAULT_DELAY_429_MS;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(MIN_DELAY_429_MS, Math.min(MAX_DELAY_429_MS, Math.round(seconds * 1000)));
  }
  return DEFAULT_DELAY_429_MS;
}

async function schedule<T>(url: string, task: () => Promise<T>): Promise<T> {
  const host = new URL(url).hostname;
  const bucket = bucketFor(host);
  if (bucket.active >= MAX_CONCURRENT_PER_HOST) {
    await new Promise<void>((resolve) => {
      bucket.queue.push(resolve);
    });
  }
  bucket.active += 1;
  try {
    const waitMs = bucket.cooldownUntil - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    return await task();
  } finally {
    bucket.active -= 1;
    const next = bucket.queue.shift();
    if (next) {
      next();
    }
  }
}

async function sendLogged(
  url: string,
  method: string,
  send: () => Promise<Han1meHttpResponse>,
): Promise<Han1meHttpResponse> {
  const started = Date.now();
  let statusCode: number | undefined;
  let message = 'native';
  try {
    const response = await send();
    statusCode = response.statusCode;
    return response;
  } catch (error) {
    message += ` error=${error}`;
    throw error;
  } finally {
    const uri = new URL(url);
    const path = uri.pathname.length > 60 ? `${uri.pathname.slice(0, 60)}…` : uri.pathname;
    log(message, {
      method,
      url: `${uri.protocol}//${uri.hostname}${path}`,
      statusCode,
      durationMs: Date.now() - started,
    });
  }
}

async function logged(
  url: string,
  method: string,
  send: () => Promise<Han1meHttpResponse>,
  retry429: boolean,
): Promise<Han1meHttpResponse> {
  const host = new URL(url).hostname;
  const response = await schedule(url, () => sendLogged(url, method, send));
  if (response.statusCode === 429) {
    const delayMs = parseRetryAfterMs(response.headers);
    const bucket = bucketFor(host);
    bucket.cooldownUntil = Math.max(bucket.cooldownUntil, Date.now() + delayMs);
    if (retry429) {
      await sleep(delayMs);
      return schedule(url, () => sendLogged(url, method, send));
    }
  }
  return response;
}

export function get(url: string, headers?: Record<string, string>, charset?: string) {
  return logged(url, 'GET', () => window.electron.http.fetch(url, headers, charset), true);
}

export function request(
  url: string,
  method: 'POST' | 'DELETE',
  data: Record<string, string>,
  headers?: Record<string, string>,
  json = false,
  charset?: string,
): Promise<Han1meHttpResponse> {
  return logged(
    url,
    method,
    () => window.electron.http.request(url, method, data, headers, json, charset),
    false,
  );
}
