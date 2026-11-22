import { useState, type ReactNode } from 'react';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
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
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { AppearanceSettings, InterfaceLayoutSettings } from './appearance_settings';
import { ContentSettings } from './content_settings';
import { DataSettings } from './data_settings';
import { NetworkSettings } from './network_settings';
import { PlaybackSettings } from './playback_settings';
import { SettingRow, SettingSection } from './setting_controls';

export type { MirrorProbeResult } from './network_settings';

type SettingsTab = 'appearance' | 'layout' | 'playback' | 'network' | 'content' | 'data' | 'about';

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
    title: '存储与关于',
    items: [
      { id: 'data', label: '数据与同步', icon: <CloudSyncOutlinedIcon fontSize="small" /> },
      { id: 'about', label: '诊断与关于', icon: <InfoOutlinedIcon fontSize="small" /> },
    ],
  },
];

export function SettingsPage() {
  const tr = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const panels: Record<SettingsTab, ReactNode> = {
    appearance: <AppearanceSettings />,
    layout: <InterfaceLayoutSettings />,
    playback: <PlaybackSettings />,
    network: <NetworkSettings />,
    content: <ContentSettings />,
    data: <DataSettings />,
    about: (
      <SettingSection title={tr('诊断与关于')}>
        <SettingRow
          icon={<BugReportOutlinedIcon />}
          title={tr('诊断日志')}
          control={<ChevronRightIcon color="action" />}
          onClick={() => navigate('/settings/logs')}
        />
        <SettingRow
          icon={<InfoOutlinedIcon />}
          title={tr('关于')}
          control={<ChevronRightIcon color="action" />}
          onClick={() => navigate('/settings/about')}
        />
      </SettingSection>
    ),
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
