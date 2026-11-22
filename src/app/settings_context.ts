import { createContext, useContext } from 'react';
import { createAppSettings, type AppSettings, appSettingsFromJson } from '../core/settings';
import { readJsonStore, writeJsonStore } from '../data/local/json_store';

export const SettingsContext = createContext<{
  settings: AppSettings;
  ready: boolean;
  save: (changes: Partial<AppSettings>) => Promise<void>;
}>({ settings: createAppSettings(), ready: true, save: async () => {} });

export const useSettings = () => useContext(SettingsContext).settings;
export const useSettingsReady = () => useContext(SettingsContext).ready;
export const useSaveSettings = () => useContext(SettingsContext).save;

export async function loadSettings(): Promise<AppSettings> {
  return appSettingsFromJson(await readJsonStore<Partial<AppSettings>>('setting.json'));
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return writeJsonStore('setting.json', settings);
}
