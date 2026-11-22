import { AccountProvider } from '../features/account/account_controller';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../data/han1me_repository';
import { SettingsContext, loadSettings, saveSettings } from './settings_context';
import { appTheme } from './app_theme';
import { createAppSettings, type AppSettings } from '../core/settings';
import { AppRouter } from './app_router';

export function App() {
  const [settings, setSettings] = useState(createAppSettings);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
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
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const theme = useMemo(
    () => appTheme(settings.themeMode, settings.textScale, prefersDark, settings),
    [settings, prefersDark],
  );

  async function saveChanges(changes: Partial<AppSettings>) {
    const next = { ...current.current, ...changes };
    current.current = next;
    setSettings(next);
    await saveSettings(next);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <SettingsContext value={{ settings, ready, save: saveChanges }}>
          <AccountProvider>
            <AppRouter />
          </AccountProvider>
        </SettingsContext>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
