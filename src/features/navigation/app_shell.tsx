import { Activity, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Container } from '@mui/material';
import { matchPath, useLocation, useOutlet } from 'react-router-dom';
import { AppSidebar } from './app_sidebar';
import { mainBranches, rootBranch } from './main_branches';

export { mainBranches } from './main_branches';

const pageEnterSx = {
  animation: 'pageEnter 160ms cubic-bezier(0.2, 0, 0, 1)',
};

export function AppShell() {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const branchScroll = useRef<Record<string, number>>({});
  const activeBranch = rootBranch(location.pathname);

  // 切回主分支时恢复原滚动位置；进入子页面或同页切换筛选参数时滚回顶部。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖路由路径和查询参数变化触发滚动恢复
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    if (activeBranch && !location.search) {
      scroller.scrollTop = branchScroll.current[activeBranch] ?? 0;
    } else {
      scroller.scrollTop = 0;
    }
  }, [activeBranch, location.pathname, location.search]);

  function handleScroll() {
    if (activeBranch && scrollRef.current) {
      branchScroll.current[activeBranch] = scrollRef.current.scrollTop;
    }
  }

  const immersive = location.pathname === '/search';

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
        <Box
          id="app-scroll-container"
          ref={scrollRef}
          onScroll={handleScroll}
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
        .map(({ path, pattern, render }) => {
          const visible = path === active;
          return (
            <Activity key={path} mode={visible ? 'visible' : 'hidden'}>
              <Box sx={visible ? pageEnterSx : undefined}>
                {render(matchPath(pattern, paths[path])?.params.tab)}
              </Box>
            </Activity>
          );
        })}
      {!active && (
        <Box key={location.pathname} sx={pageEnterSx}>
          {outlet}
        </Box>
      )}
    </>
  );
}
