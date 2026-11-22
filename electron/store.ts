import { app } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppSettings } from '../src/core/settings';

let settings: Partial<AppSettings> = {};

export function getSettings(): Partial<AppSettings> {
  return settings;
}

export function setSettings(value: Partial<AppSettings>): void {
  settings = value;
}

export async function readStore(file: string): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse(await readFile(join(app.getPath('userData'), file), 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function writeStore(file: string, value: unknown): Promise<void> {
  await writeFile(join(app.getPath('userData'), file), JSON.stringify(value), 'utf8');
  if (file === 'setting.json') {
    settings = (value ?? {}) as Partial<AppSettings>;
  }
}
