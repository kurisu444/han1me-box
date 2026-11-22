import { log } from '../../core/logging/app_log';

async function logged(url: string, method: string, send: () => Promise<Han1meHttpResponse>) {
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

export function get(url: string, headers?: Record<string, string>, charset?: string) {
  return logged(url, 'GET', () => window.electron.http.fetch(url, headers, charset));
}

export function request(
  url: string,
  method: 'POST' | 'DELETE',
  data: Record<string, string>,
  headers?: Record<string, string>,
  json = false,
  charset?: string,
): Promise<Han1meHttpResponse> {
  return logged(url, method, () =>
    window.electron.http.request(url, method, data, headers, json, charset),
  );
}
