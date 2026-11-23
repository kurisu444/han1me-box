import { GlobalStyles } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../data/han1me_repository';
import { AccountProvider } from '../features/account/account_controller';
import { WebsitePanel } from '../features/account/website_panel';
import { TITLE_BAR_HEIGHT, TitleBar } from '../features/navigation/title_bar';
import { isPlayerWindow, PlayerWindowApp } from '../features/video/player_window';
import { AppRouter } from './app_router';
import { AppThemeProvider } from './app_theme';
import './global.css';
import { SettingsProvider } from './settings_context';

export function App() {
  return (
    <>
      <GlobalStyles styles={{ ':root': { '--titlebar-height': `${TITLE_BAR_HEIGHT}px` } }} />
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
