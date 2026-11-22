import { WEBSITE_TOOLBAR_HEIGHT } from '../../core/window_layout';
import { useEffect, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, Typography } from '@mui/material';
import { useI18n } from '../../app/i18n';

export function WebsitePanel() {
  const tr = useI18n();
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => window.electron.session.onWebsiteChanged(setTitle), []);

  if (!title) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        top: 'var(--titlebar-height)',
        zIndex: 'modal',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          height: WEBSITE_TOOLBAR_HEIGHT,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => window.electron.session.closeWebsite()}
        >
          {tr('返回应用')}
        </Button>
        <Typography>{tr(title)}</Typography>
      </Box>
    </Box>
  );
}
