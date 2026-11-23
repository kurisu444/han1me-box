import { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FilterNoneIcon from '@mui/icons-material/FilterNone';
import MinimizeIcon from '@mui/icons-material/Minimize';
import { Box, IconButton, Typography } from '@mui/material';
import logo from '../../../assets/logo.png';
import { useI18n } from '../../app/i18n';

export { TITLE_BAR_HEIGHT } from '../../core/window_layout';

export function useWindowFocused() {
  const [focused, setFocused] = useState(() => document.hasFocus());

  useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return focused;
}

export function TitleBar() {
  const tr = useI18n();
  const [maximized, setMaximized] = useState(false);
  const focused = useWindowFocused();

  useEffect(() => {
    const unsubscribe = window.electron.window.onMaximized(setMaximized);
    void window.electron.window.isMaximized().then(setMaximized);
    return unsubscribe;
  }, []);

  return (
    <Box
      component="header"
      data-title-bar
      sx={{
        position: 'fixed',
        inset: '0 0 auto',
        height: 'var(--titlebar-height)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        color: 'text.primary',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      }}
    >
      <Box
        component="img"
        src={logo}
        alt=""
        sx={{
          width: 18,
          height: 18,
          mx: 1.5,
          opacity: focused ? 1 : 0.55,
          transition: 'opacity 150ms ease',
        }}
      />
      <Typography
        sx={{
          fontSize: 13,
          flexGrow: 1,
          opacity: focused ? 1 : 0.55,
          transition: 'opacity 150ms ease',
        }}
      >
        Han1meBox
      </Typography>
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          WebkitAppRegion: 'no-drag',
          '& button': { width: 46, borderRadius: 0, color: 'inherit' },
          '& svg': { fontSize: 16 },
        }}
      >
        <IconButton aria-label={tr('最小化窗口')} onClick={() => window.electron.window.minimize()}>
          <MinimizeIcon />
        </IconButton>
        <IconButton
          aria-label={tr(maximized ? '还原窗口' : '最大化窗口')}
          onClick={() => window.electron.window.toggleMaximize()}
        >
          {maximized ? <FilterNoneIcon /> : <CropSquareIcon />}
        </IconButton>
        <IconButton
          aria-label={tr('关闭窗口')}
          onClick={() => window.electron.window.close()}
          sx={{ '&:hover': { bgcolor: '#c42b1c', color: '#fff' } }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
