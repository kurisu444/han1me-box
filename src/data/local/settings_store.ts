import { appSettingsFromJson, type AppSettings } from '../../core/settings';
import { readJsonStore, writeJsonStore } from './json_store';

export async function loadSettings(): Promise<AppSettings> {
  return appSettingsFromJson(await readJsonStore<Partial<AppSettings>>('setting.json'));
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return writeJsonStore('setting.json', settings);
}
