import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FilterNoneIcon from '@mui/icons-material/FilterNone';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MinimizeIcon from '@mui/icons-material/Minimize';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import { Box, Button, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import {
  HashRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { queryClient } from '../../data/han1me_repository';
import type { PlaylistQueue, VideoDetail } from '../../domain/models/video';
import { AccountProvider } from '../account/account_controller';
import { WebsitePanel } from '../account/website_panel';
import { useWindowFocused } from '../navigation/title_bar';
import { LoadingState } from '../shared/request_error';
import { VideoPage } from './video_page';

interface PlayerChromeState {
  videoTitle: string;
  setVideoTitle: (title: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const PlayerChromeContext = createContext<PlayerChromeState>({
  videoTitle: '',
  setVideoTitle: () => {},
  sidebarOpen: true,
  setSidebarOpen: () => {},
  toggleSidebar: () => {},
});

export function isPlayerWindow(): boolean {
  return new URLSearchParams(window.location.search).get('window') === 'player';
}

export const usePlayerChrome = () => useContext(PlayerChromeContext);

function useStoreQuerySync() {
  useEffect(() => {
    return window.electron.store.onChange((fileName) => {
      if (fileName === 'following_store.json') {
        void queryClient.invalidateQueries({ queryKey: ['local-library'] });
      } else if (fileName === 'keyframes.json') {
        void queryClient.invalidateQueries({ queryKey: ['keyframes'] });
      }
    });
  }, []);
}

function PlayerTitleBar() {
  const tr = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { videoTitle } = usePlayerChrome();
  const focused = useWindowFocused();
  const [maximized, setMaximized] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [historyState, setHistoryState] = useState({ idx: 0, max: 0 });

  useEffect(() => {
    const unsubscribeMaximized = window.electron.window.onMaximized(setMaximized);
    const unsubscribeOnTop = window.electron.window.onAlwaysOnTop(setAlwaysOnTop);
    void window.electron.window.isMaximized().then(setMaximized);
    void window.electron.window.isAlwaysOnTop().then(setAlwaysOnTop);
    return () => {
      unsubscribeMaximized();
      unsubscribeOnTop();
    };
  }, []);

  useEffect(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    setHistoryState((current) => ({ idx, max: Math.max(current.max, idx) }));
  }, [location.key]);

  const canGoBack = historyState.idx > 0;
  const canGoForward = historyState.idx < historyState.max;

  async function toggleAlwaysOnTop() {
    const next = await window.electron.window.setAlwaysOnTop(!alwaysOnTop);
    setAlwaysOnTop(next);
  }

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
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          pl: 1,
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        }}
      >
        <Button
          size="small"
          color="inherit"
          startIcon={<HomeOutlinedIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => void window.electron.player.focusMain()}
          sx={{
            fontSize: 12,
            fontWeight: 500,
            px: 1,
            py: 0.25,
            minWidth: 'auto',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}
        >
          {tr('回到主界面')}
        </Button>
        <Tooltip title={tr('后退')}>
          <span>
            <IconButton
              size="small"
              aria-label={tr('后退')}
              disabled={!canGoBack}
              onClick={() => navigate(-1)}
              sx={{ width: 28, height: 28, color: 'text.secondary' }}
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={tr('前进')}>
          <span>
            <IconButton
              size="small"
              aria-label={tr('前进')}
              disabled={!canGoForward}
              onClick={() => navigate(1)}
              sx={{ width: 28, height: 28, color: 'text.secondary' }}
            >
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Typography
        noWrap
        sx={{
          fontSize: 13,
          fontWeight: 500,
          flexGrow: 1,
          minWidth: 0,
          textAlign: 'center',
          px: 2,
          color: 'text.primary',
          opacity: focused ? 1 : 0.55,
          transition: 'opacity 150ms ease',
        }}
      >
        {videoTitle || 'Han1meBox'}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        }}
      >
        <Tooltip title={tr(alwaysOnTop ? '取消置顶' : '窗口置顶')}>
          <IconButton
            size="small"
            aria-label={tr(alwaysOnTop ? '取消置顶' : '窗口置顶')}
            aria-pressed={alwaysOnTop}
            onClick={toggleAlwaysOnTop}
            sx={{
              width: 34,
              height: '100%',
              borderRadius: 0,
              color: alwaysOnTop ? 'primary.main' : 'text.secondary',
            }}
          >
            {alwaysOnTop ? (
              <PushPinIcon sx={{ fontSize: 16 }} />
            ) : (
              <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" sx={{ height: 14, mx: 0.5 }} />
        <Box
          sx={{
            display: 'flex',
            height: '100%',
            '& button': { width: 46, borderRadius: 0, color: 'inherit' },
            '& svg': { fontSize: 16 },
          }}
        >
          <IconButton
            aria-label={tr('最小化窗口')}
            onClick={() => window.electron.window.minimize()}
          >
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
    </Box>
  );
}

function PlayerVideoRoute() {
  const tr = useI18n();
  const { id = '' } = useParams();
  const { state } = useLocation();
  const [params] = useSearchParams();
  const routeState = state as { localVideo?: VideoDetail; queue?: PlaylistQueue } | null;
  const stateVideo = routeState?.localVideo;
  const stateQueue = routeState?.queue;
  const needsInitialLocal = !stateVideo && params.get('local') === '1';
  const needsInitialQueue = !stateQueue && params.get('queue') === '1';
  const [fetched, setFetched] = useState<{
    id: string;
    video?: VideoDetail;
    queue?: PlaylistQueue;
  }>();

  useEffect(() => {
    if (!needsInitialLocal && !needsInitialQueue) {
      return;
    }
    let active = true;
    void Promise.all([
      needsInitialLocal ? window.electron.player.takeLocalVideo(id) : Promise.resolve(undefined),
      needsInitialQueue ? window.electron.player.takeQueue(id) : Promise.resolve(undefined),
    ]).then(([video, queue]) => {
      if (active) {
        setFetched({ id, video, queue });
      }
    });
    return () => {
      active = false;
    };
  }, [id, needsInitialLocal, needsInitialQueue]);

  if ((needsInitialLocal || needsInitialQueue) && fetched?.id !== id) {
    return (
      <Box
        sx={{
          height: 'calc(100vh - var(--titlebar-height))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingState label={tr('正在加载视频…')} />
      </Box>
    );
  }

  const localVideo = stateVideo ?? (fetched?.id === id ? fetched.video : undefined);
  const queue = stateQueue ?? (fetched?.id === id ? fetched.queue : undefined);

  return <VideoPage key={id} id={id} localVideo={localVideo} queue={queue} />;
}

function PlayerWindowRoutes() {
  const navigate = useNavigate();
  useStoreQuerySync();

  useEffect(() => {
    return window.electron.player.onOpen(({ id, localVideo, queue }) => {
      navigate(`/video/${encodeURIComponent(id)}`, {
        state: localVideo || queue ? { localVideo, queue } : undefined,
      });
    });
  }, [navigate]);

  useEffect(() => {
    function handleLinkClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      const href = anchor?.getAttribute('href');
      if (!href?.startsWith('#/')) {
        return;
      }
      const route = href.slice(1);
      if (!/^\/video\/[^/?#]+/.test(route)) {
        event.preventDefault();
        void window.electron.player.focusMain(route);
      }
    }

    document.addEventListener('click', handleLinkClick, true);
    return () => document.removeEventListener('click', handleLinkClick, true);
  }, []);

  return (
    <Routes>
      <Route path="video/:id" element={<PlayerVideoRoute />} />
    </Routes>
  );
}

function PlayerChromeProvider({ children }: { children: ReactNode }) {
  const [videoTitle, setVideoTitle] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((value) => !value);
  }, []);

  return (
    <PlayerChromeContext
      value={{ videoTitle, setVideoTitle, sidebarOpen, setSidebarOpen, toggleSidebar }}
    >
      {children}
    </PlayerChromeContext>
  );
}

export function PlayerWindowApp() {
  return (
    <HashRouter>
      <PlayerChromeProvider>
        <PlayerTitleBar />
        <AccountProvider>
          <PlayerWindowRoutes />
          <WebsitePanel />
        </AccountProvider>
      </PlayerChromeProvider>
    </HashRouter>
  );
}

export function MainWindowPlayerBridge() {
  const navigate = useNavigate();
  useStoreQuerySync();

  useEffect(() => {
    return window.electron.window.onNavigate((route) => {
      navigate(route);
    });
  }, [navigate]);

  useEffect(() => {
    function handleVideoLinkClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      const href = anchor?.getAttribute('href');
      const match = href ? /^#\/video\/([^/?#]+)/.exec(href) : null;
      if (!match) {
        return;
      }
      event.preventDefault();
      void window.electron.player.open({ id: decodeURIComponent(match[1]) });
    }

    document.addEventListener('click', handleVideoLinkClick, true);
    return () => document.removeEventListener('click', handleVideoLinkClick, true);
  }, []);

  return null;
}
