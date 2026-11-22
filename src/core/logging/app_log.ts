export interface AppLogEntry {
  timestamp: number;
  message: string;
  method?: string;
  url?: string;
  statusCode?: number;
  durationMs?: number;
}

let entries: AppLogEntry[] = [];
const listeners = new Set<() => void>();
export const getEntries = () => entries;
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function log(message: string, fields: Omit<AppLogEntry, 'timestamp' | 'message'> = {}) {
  entries = [...entries, { timestamp: Date.now(), message, ...fields }].slice(-800);
  listeners.forEach((listener) => {
    listener();
  });
}
export function clear() {
  entries = [];
  listeners.forEach((listener) => {
    listener();
  });
}
export function displayLine(entry: AppLogEntry) {
  const date = new Date(entry.timestamp);
  const two = (value: number) => String(value).padStart(2, '0');
  const stamp =
    `${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
    `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
  const request = entry.method ? `${entry.method} ${entry.url}` : entry.message;
  const status = entry.statusCode == null ? '' : ` -> ${entry.statusCode}`;
  const elapsed = entry.durationMs == null ? '' : ` (${entry.durationMs}ms)`;
  const detail = entry.method ? ` [${entry.message}]` : '';
  return `${stamp} ${request}${status}${elapsed}${detail}`;
}
export function exportLogs() {
  return [
    'Han1meBox diagnostics',
    `exported: ${new Date().toISOString()}`,
    `entries: ${entries.length}`,
    '--- requests ---',
    ...entries.map(displayLine),
    '',
  ].join('\n');
}
