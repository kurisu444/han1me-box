import type { MouseEvent, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import {
  Avatar,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useTheme,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSaveSettings } from '../../app/settings_context';
import { useAccount } from '../account/account_controller';
import { mainBranches } from './main_branches';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const previewsItem: NavItem = {
  path: '/previews',
  label: '新番',
  icon: <CalendarMonthOutlinedIcon />,
};

const topItems: NavItem[] = [mainBranches[0], previewsItem];
const bottomItems: NavItem[] = [mainBranches[1], mainBranches[2], mainBranches[3]];

let themeTransitionSeq = 0;

export function AppSidebar() {
  const tr = useI18n();
  const theme = useTheme();
  const saveSettings = useSaveSettings();
  const { account } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  function isSelected(path: string) {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/previews') {
      return location.pathname.startsWith('/previews') || location.pathname.startsWith('/getchu');
    }
    return location.pathname.startsWith(path);
  }

  function renderNavItem(item: NavItem, iconOnly: boolean) {
    const selected = isSelected(item.path);
    const isProfile = item.path === '/library';
    const label = isProfile ? account?.name || tr(item.label) : tr(item.label);
    const icon = isProfile ? (
      <Avatar
        src={account?.avatarUrl}
        sx={{
          width: 28,
          height: 28,
          outline: selected ? '2px solid' : 'none',
          outlineColor: 'primary.main',
          outlineOffset: 1,
        }}
      />
    ) : (
      item.icon
    );

    const button = (
      <ListItemButton
        key={item.path}
        selected={selected}
        onClick={() => navigate(item.path)}
        aria-label={label}
        sx={{
          mx: 1,
          my: 0.25,
          borderRadius: '12px',
          flexDirection: 'column',
          justifyContent: 'center',
          py: iconOnly ? 1.1 : 1,
          px: 0.5,
          color: selected ? 'primary.main' : 'text.secondary',
          '&.Mui-selected': {
            bgcolor: isDark ? 'rgba(213, 182, 239, 0.14)' : 'rgba(109, 63, 144, 0.1)',
            color: 'primary.main',
          },
          '&.Mui-selected:hover': {
            bgcolor: isDark ? 'rgba(213, 182, 239, 0.2)' : 'rgba(109, 63, 144, 0.14)',
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            color: 'inherit',
            justifyContent: 'center',
            '& svg': { fontSize: 22 },
          }}
        >
          {icon}
        </ListItemIcon>
        {!iconOnly && (
          <ListItemText
            primary={label}
            slotProps={{
              primary: {
                sx: {
                  fontSize: 11,
                  fontWeight: selected ? 700 : 500,
                  mt: 0.35,
                  lineHeight: 1.2,
                },
              },
            }}
          />
        )}
      </ListItemButton>
    );

    return iconOnly ? (
      <Tooltip key={item.path} title={label} placement="right">
        {button}
      </Tooltip>
    ) : (
      button
    );
  }

  const themeToggleLabel = tr(isDark ? '浅色模式' : '深色模式');

  function toggleTheme(event: MouseEvent<HTMLElement>) {
    const nextMode = isDark ? 'light' : 'dark';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof document.startViewTransition !== 'function') {
      void saveSettings({ themeMode: nextMode });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const toLight = isDark;
    const root = document.documentElement;
    const seq = ++themeTransitionSeq;
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${endRadius}px`);
    root.classList.toggle('theme-shrink', toLight);
    root.classList.toggle('theme-expand', !toLight);
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        void saveSettings({ themeMode: nextMode });
      });
    });
    void transition.finished.finally(() => {
      if (themeTransitionSeq === seq) {
        root.classList.remove('theme-shrink', 'theme-expand');
      }
    });
  }

  return (
    <Box
      component="aside"
      aria-label={tr('主导航')}
      sx={{
        width: 72,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        borderRight: 1,
        borderColor: 'divider',
        py: 1,
        overflowY: 'auto',
      }}
    >
      <List component="nav" disablePadding>
        {topItems.map((item) => renderNavItem(item, false))}
      </List>
      <List component="nav" disablePadding sx={{ mt: 'auto' }}>
        {bottomItems.slice(0, -1).map((item) => renderNavItem(item, true))}
        <Tooltip title={themeToggleLabel} placement="right">
          <ListItemButton
            onClick={toggleTheme}
            aria-label={themeToggleLabel}
            sx={{
              mx: 1,
              my: 0.25,
              borderRadius: '12px',
              flexDirection: 'column',
              justifyContent: 'center',
              py: 1.1,
              px: 0.5,
              color: 'text.secondary',
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                color: 'inherit',
                justifyContent: 'center',
                '& svg': { fontSize: 22 },
              }}
            >
              {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </ListItemIcon>
          </ListItemButton>
        </Tooltip>
        {renderNavItem(bottomItems[bottomItems.length - 1], true)}
      </List>
    </Box>
  );
}
