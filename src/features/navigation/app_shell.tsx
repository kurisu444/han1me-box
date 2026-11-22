import { useEffect, useState, useRef, Activity } from 'react';
import { Link, matchPath, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExploreIcon from '@mui/icons-material/Explore';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { useAccount } from '../account/account_controller';
import { useConfirmation } from '../shared/use_confirmation';
import { libraryTabLabels } from '../settings/layout_settings';
import { ExplorePage } from '../explore/explore_page';
import { LibraryPage } from '../library/library_page';
import { CachePage } from '../cache/cache_page';
import { SettingsPage } from '../settings/settings_page';
import { ComicsPage } from '../comics/comic_pages';
import { ComicCachePage } from '../comics/comic_cache_page';

export const mainBranches = [
  {
    path: '/',
    pattern: '/',
    label: '首页',
    icon: <ExploreIcon />,
    render: (comicMode: boolean) => (comicMode ? <ComicsPage /> : <ExplorePage />),
  },
  {
    path: '/library',
    pattern: '/library/:tab?',
    label: '媒体库',
    icon: <BookmarkIcon />,
    render: (comicMode: boolean, tab?: string) =>
      comicMode ? (
        <ComicsPage
          key={tab}
          initialTab={tab === 'favorites' ? 'favorites' : 'watchLater'}
          libraryOnly
        />
      ) : (
        <LibraryPage key={tab} initialTab={tab} />
      ),
  },
  {
    path: '/cache',
    pattern: '/cache',
    label: '缓存',
    icon: <DownloadIcon />,
    render: (comicMode: boolean) => (comicMode ? <ComicCachePage /> : <CachePage />),
  },
  {
    path: '/settings',
    pattern: '/settings',
    label: '设置',
    icon: <SettingsIcon />,
    render: () => <SettingsPage />,
  },
];

function rootBranch(path: string) {
  return mainBranches.find((branch) => matchPath(branch.pattern, path))?.path;
}

export function AppShell() {
  const tr = useI18n();
  const settings = useSettings();
  const { account } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const confirmation = useConfirmation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const branchHistory = useRef<string[]>([]);
  const large = useMediaQuery('(min-width:600px) and (min-height:600px)');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const branchPath = rootBranch(location.pathname);
    if (!branchPath) return;
    branchHistory.current = [
      ...branchHistory.current.filter((path) => path !== branchPath),
      branchPath,
    ];
  }, [location.pathname]);
  useEffect(() =>
    window.electron.onExitRequested(async () => {
      if (await confirmation.confirm(tr('确认退出？'))) await window.electron.closeApp();
    }),
  );

  const isHome = location.pathname === '/';
  const drawer = settings.useNavigationDrawer;
  const permanent = drawer && large;
  const rail = !drawer && large;
  const branch = mainBranches.findIndex((item) =>
    item.path === '/' ? isHome : location.pathname.startsWith(item.path),
  );
  const drawerItems = [
    mainBranches[0],
    mainBranches[3],
    ...Object.entries(libraryTabLabels)
      .filter(([key]) => !settings.comicMode || ['watch-later', 'favorites'].includes(key))
      .map(([key, label]) => ({ path: `/library/${key}`, label, icon: <BookmarkIcon /> })),
    mainBranches[2],
  ];
  const navigationWidth = permanent ? 260 : rail ? 88 : 0;

  async function goBack() {
    const root = rootBranch(location.pathname);
    if (!root && location.key !== 'default') navigate(-1);
    else if (!root) navigate('/');
    else if (branchHistory.current.length > 1) {
      branchHistory.current.pop();
      navigate(branchHistory.current.at(-1)!);
    } else if (await confirmation.confirm(tr('确认退出？'))) await window.electron.closeApp();
  }

  function go(path: string) {
    setDrawerOpen(false);
    navigate(path);
  }

  function changeBranch(_event: unknown, index: number) {
    navigate(mainBranches[index].path);
  }

  return (
    <>
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          ml: `${navigationWidth}px`,
          width: `calc(100% - ${navigationWidth}px)`,
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {drawer && !permanent && (
            <IconButton onClick={() => setDrawerOpen(true)} aria-label={tr('主导航')}>
              <MenuIcon />
            </IconButton>
          )}
          <IconButton onClick={goBack} aria-label={tr('返回')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography
            component={Link}
            to="/"
            variant="h6"
            sx={{ color: 'text.primary', textDecoration: 'none', fontWeight: 800, flexGrow: 1 }}
          >
            Han1me{' '}
            <Box component="span" sx={{ color: 'primary.main' }}>
              Box
            </Box>
          </Typography>
          {!settings.comicMode && (
            <Button component={Link} to="/search" startIcon={<SearchIcon />}>
              {tr('搜索')}
            </Button>
          )}
          <Button component={Link} to="/previews">
            {tr('预告')}
          </Button>
          <Button component={Link} to="/account">
            {tr('账号')}
          </Button>
        </Toolbar>
      </AppBar>
      {(drawer || rail) && (
        <Drawer
          variant={large ? 'permanent' : 'temporary'}
          open={large || drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{ paper: { sx: { width: drawer ? 260 : 88 } } }}
        >
          {drawer && (
            <ListItemButton onClick={() => go('/account')} sx={{ py: 3 }}>
              <Avatar src={account?.avatarUrl} sx={{ mr: 1.5 }} />
              <ListItemText
                primary={account?.name || tr(account ? '已登录' : '未登录')}
                secondary={account?.id ? `@${account.id}` : tr('请先登录')}
              />
            </ListItemButton>
          )}
          <List component="nav" aria-label={tr('主导航')}>
            {(drawer ? drawerItems : mainBranches).map((item) => (
              <ListItemButton
                key={item.path}
                selected={location.pathname === item.path}
                onClick={() => go(item.path)}
                sx={rail ? { flexDirection: 'column', py: 2 } : undefined}
              >
                <ListItemIcon sx={rail ? { minWidth: 0 } : undefined}>{item.icon}</ListItemIcon>
                <ListItemText primary={tr(item.label)} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}
      <Box sx={{ ml: `${navigationWidth}px` }}>
        <Container component="main" maxWidth="xl" sx={{ pt: 3, pb: 12 }}>
          <BranchOutlet />
        </Container>
      </Box>
      {!drawer && !rail && (
        <BottomNavigation
          showLabels
          value={branch}
          onChange={changeBranch}
          sx={{
            position: 'fixed',
            bottom: settings.useLiquidGlassBottomBar ? 16 : 0,
            left: settings.useLiquidGlassBottomBar ? 16 : 0,
            right: settings.useLiquidGlassBottomBar ? 16 : 0,
            borderRadius: settings.useLiquidGlassBottomBar ? 6 : 0,
            zIndex: 1100,
            backdropFilter: settings.useLiquidGlassBottomBar ? 'blur(20px)' : undefined,
            bgcolor: settings.useLiquidGlassBottomBar ? 'background.paper' : 'background.default',
            opacity: settings.useLiquidGlassBottomBar ? 0.94 : 1,
          }}
        >
          {mainBranches.map((item) => (
            <BottomNavigationAction key={item.path} label={tr(item.label)} icon={item.icon} />
          ))}
        </BottomNavigation>
      )}
      {confirmation.dialog}
    </>
  );
}

// 四个主分支保留各自页面状态，详情路由正常进出。
function BranchOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const { comicMode } = useSettings();
  const [saved, setSaved] = useState<Record<string, string>>({});
  useEffect(() => {
    const key = rootBranch(location.pathname);
    if (key) setSaved((current) => ({ ...current, [key]: location.pathname }));
  }, [location.pathname]);

  const active = rootBranch(location.pathname);
  const paths = active ? { ...saved, [active]: location.pathname } : saved;

  return (
    <>
      {mainBranches
        .filter(({ path }) => path in paths)
        .map(({ path, pattern, render }) => (
          <Activity key={`${comicMode}:${path}`} mode={path === active ? 'visible' : 'hidden'}>
            {render(comicMode, matchPath(pattern, paths[path])?.params.tab)}
          </Activity>
        ))}
      {!active && outlet}
    </>
  );
}
