import { useState, type ReactNode } from 'react';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useI18n } from '../../app/i18n';
import { AboutPage, DebugLogPage } from './about_page';
import { AppearanceSettings, InterfaceLayoutSettings } from './appearance_settings';
import { ContentSettings } from './content_settings';
import { DataSettings } from './data_settings';
import { NetworkSettings } from './network_settings';
import { PlaybackSettings } from './playback_settings';

export type { MirrorProbeResult } from './network_settings';

type SettingsTab =
  'appearance' | 'layout' | 'playback' | 'network' | 'content' | 'data' | 'logs' | 'about';

interface NavGroup {
  title: string;
  items: { id: SettingsTab; label: string; icon: ReactNode }[];
}

const navGroups: NavGroup[] = [
  {
    title: '外观',
    items: [
      { id: 'appearance', label: '主题与色彩', icon: <PaletteOutlinedIcon fontSize="small" /> },
      { id: 'layout', label: '界面布局', icon: <DashboardOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: '播放',
    items: [
      { id: 'playback', label: '播放设置', icon: <PlayCircleOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: '网络',
    items: [{ id: 'network', label: '站点与镜像', icon: <PublicOutlinedIcon fontSize="small" /> }],
  },
  {
    title: '内容',
    items: [
      { id: 'content', label: '过滤与屏蔽', icon: <FilterAltOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: '存储',
    items: [{ id: 'data', label: '数据与同步', icon: <CloudSyncOutlinedIcon fontSize="small" /> }],
  },
  {
    title: '其他',
    items: [
      { id: 'logs', label: '日志', icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
      { id: 'about', label: '关于', icon: <InfoOutlinedIcon fontSize="small" /> },
    ],
  },
];

export function SettingsPage() {
  const tr = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const panels: Record<SettingsTab, ReactNode> = {
    appearance: <AppearanceSettings />,
    layout: <InterfaceLayoutSettings />,
    playback: <PlaybackSettings />,
    network: <NetworkSettings />,
    content: <ContentSettings />,
    data: <DataSettings />,
    logs: <DebugLogPage embedded />,
    about: <AboutPage embedded onOpenLogs={() => setActiveTab('logs')} />,
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '210px minmax(0, 1fr)',
        gap: 3,
        alignItems: 'start',
        '@media (max-width:720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
      }}
    >
      <Stack spacing={2} sx={{ position: 'sticky', top: 0 }}>
        {navGroups.map((group) => (
          <Stack key={group.title} spacing={0.75}>
            <Typography variant="caption" color="primary" sx={{ fontWeight: 700, px: 1 }}>
              {tr(group.title)}
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
              <List disablePadding sx={{ py: 0.5 }}>
                {group.items.map((item) => {
                  const selected = activeTab === item.id;
                  return (
                    <ListItemButton
                      key={item.id}
                      selected={selected}
                      onClick={() => setActiveTab(item.id)}
                      sx={{
                        position: 'relative',
                        py: 1.1,
                        px: 2,
                        color: selected ? 'primary.main' : 'text.primary',
                        '&.Mui-selected': { bgcolor: 'transparent' },
                        '&.Mui-selected:hover': { bgcolor: 'action.hover' },
                        '&::before': selected
                          ? {
                              content: '""',
                              position: 'absolute',
                              left: 4,
                              top: '28%',
                              bottom: '28%',
                              width: 3,
                              borderRadius: 999,
                              bgcolor: 'primary.main',
                            }
                          : undefined,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={tr(item.label)}
                        slotProps={{
                          primary: {
                            sx: { fontSize: 13.5, fontWeight: selected ? 700 : 500 },
                          },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          </Stack>
        ))}
      </Stack>
      <Box sx={{ minWidth: 0, maxWidth: 760 }}>{panels[activeTab]}</Box>
    </Box>
  );
}
