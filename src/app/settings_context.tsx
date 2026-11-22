import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createAppSettings, type AppSettings } from '../core/settings';
import { loadSettings, saveSettings } from '../data/local/settings_store';

export const SettingsContext = createContext<{
  settings: AppSettings;
  save: (changes: Partial<AppSettings>) => Promise<void>;
}>({ settings: createAppSettings(), save: async () => {} });

export const useSettings = () => useContext(SettingsContext).settings;
export const useSaveSettings = () => useContext(SettingsContext).save;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(createAppSettings);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);

  useEffect(() => {
    let active = true;
    loadSettings()
      .then((value) => {
        if (active) {
          current.current = value;
          setSettings(value);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveChanges(changes: Partial<AppSettings>) {
    const next = { ...current.current, ...changes };
    current.current = next;
    setSettings(next);
    await saveSettings(next);
  }

  if (!ready) {
    return null;
  }

  return <SettingsContext value={{ settings, save: saveChanges }}>{children}</SettingsContext>;
}
