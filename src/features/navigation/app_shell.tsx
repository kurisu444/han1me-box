import { Activity, useEffect, useRef, useState } from 'react';
import { Box, Container } from '@mui/material';
import { matchPath, useLocation, useOutlet } from 'react-router-dom';
import { useSettings } from '../../app/settings_context';
import { AppSidebar } from './app_sidebar';
import { AppTopBar } from './app_top_bar';
import { mainBranches, rootBranch } from './main_branches';

export { mainBranches } from './main_branches';

export function AppShell() {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 切换路由或查询参数（如顶栏分类、搜索翻页）时滚回顶部
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  const immersive = location.pathname === '/search';
  const showTopBar =
    !immersive &&
    (location.pathname === '/' ||
      location.pathname.startsWith('/previews') ||
      location.pathname.startsWith('/getchu') ||
      location.pathname.startsWith('/comics'));

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - var(--titlebar-height))' }}>
      {!immersive && <AppSidebar />}
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {showTopBar && <AppTopBar />}
        <Box
          id="app-scroll-container"
          ref={scrollRef}
          sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}
        >
          <Container component="main" maxWidth="xl" sx={{ pt: 2.5, pb: 8 }}>
            <BranchOutlet />
          </Container>
        </Box>
      </Box>
    </Box>
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
    if (key) {
      setSaved((current) => ({ ...current, [key]: location.pathname }));
    }
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
