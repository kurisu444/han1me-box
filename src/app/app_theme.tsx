import { useMemo, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { createTheme, lighten } from '@mui/material/styles';
import type { AppSettings } from '../core/settings';
import { useSettings } from './settings_context';

export const themeColors = {
  rose: '#b3265a',
  blue: '#00639b',
  teal: '#006b5f',
  amber: '#875400',
  green: '#386a20',
  orange: '#9b4400',
  indigo: '#4a5f9e',
  pink: '#9c3c66',
  purple: '#6d3f90',
};

export function appTheme(
  themeMode: AppSettings['themeMode'],
  textScale: number,
  prefersDark: boolean,
  settings?: Pick<AppSettings, 'themeColor' | 'customThemeColor' | 'amoledMode'>,
) {
  const mode = themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;
  const color = settings?.themeColor ?? 'purple';
  const seed = color === 'custom' ? `#${settings!.customThemeColor}` : themeColors[color];
  const amoled = mode === 'dark' && settings?.amoledMode;

  return createTheme({
    palette: {
      mode,
      // 主色 #6d3f90；深色模式使用较亮的同色系前景。
      primary: {
        main: mode === 'dark' ? (color === 'purple' ? '#d5b6ef' : lighten(seed, 0.6)) : seed,
      },
      background: {
        default: amoled ? '#000000' : mode === 'dark' ? '#15121a' : '#faf7fc',
        paper: amoled ? '#000000' : mode === 'dark' ? '#211b28' : '#ffffff',
      },
    },
    typography: {
      fontFamily:
        '"HarmonyOS Sans SC", Inter, "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif',
      fontSize: 14 * textScale,
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            transition:
              'background-color 150ms cubic-bezier(0.2, 0, 0, 1), border-color 150ms cubic-bezier(0.2, 0, 0, 1), color 150ms cubic-bezier(0.2, 0, 0, 1), scale 100ms cubic-bezier(0.2, 0, 0, 1)',
            '&:active:not(:disabled)': { scale: '0.98' },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition:
              'background-color 150ms cubic-bezier(0.2, 0, 0, 1), color 150ms cubic-bezier(0.2, 0, 0, 1), scale 100ms cubic-bezier(0.2, 0, 0, 1)',
            '&:active:not(:disabled)': { scale: '0.94' },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            transition: 'color 150ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease',
          },
        },
      },
      MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
      MuiCard: { defaultProps: { variant: 'outlined' } },
      MuiLink: { defaultProps: { underline: 'hover' } },
      MuiDialog: {
        styleOverrides: {
          root: { top: 'var(--titlebar-height)' },
          paper: { maxHeight: 'calc(100% - 48px)' },
        },
      },
    },
  });
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(
    () => appTheme(settings.themeMode, settings.textScale, prefersDark, settings),
    [settings, prefersDark],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
