import { GlobalStyles } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../data/han1me_repository';
import { AccountProvider } from '../features/account/account_controller';
import { WebsitePanel } from '../features/account/website_panel';
import { TITLE_BAR_HEIGHT, TitleBar } from '../features/navigation/title_bar';
import { isPlayerWindow, PlayerWindowApp } from '../features/video/player_window';
import { AppRouter } from './app_router';
import { AppThemeProvider } from './app_theme';
import { SettingsProvider } from './settings_context';

export function App() {
  return (
    <>
      <GlobalStyles
        styles={{
          ':root': { '--titlebar-height': `${TITLE_BAR_HEIGHT}px` },
          'html, body, #root': { height: '100%', overflow: 'hidden' },
          body: { margin: 0, paddingTop: 'var(--titlebar-height)' },
          '*::-webkit-scrollbar': { width: 6, height: 6 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(128, 128, 128, 0.35)',
            borderRadius: 999,
          },
          '*::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(128, 128, 128, 0.55)',
          },
          '@keyframes pageEnter': {
            from: { opacity: 0, transform: 'translateY(6px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              transitionDuration: '0.01ms !important',
            },
          },
        }}
      />
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <AppThemeProvider>
            {isPlayerWindow() ? (
              <PlayerWindowApp />
            ) : (
              <>
                <TitleBar />
                <AccountProvider>
                  <AppRouter />
                  <WebsitePanel />
                </AccountProvider>
              </>
            )}
          </AppThemeProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </>
  );
}
