import { KeyframesPage } from '../features/settings/keyframes_page';
import { useI18n } from './i18n';
import { ComicCachePage } from '../features/comics/comic_cache_page';
import { GetchuPage, GetchuDetailPage } from '../features/previews/getchu_page';
import { ComicsPage, ComicDetailPage } from '../features/comics/comic_pages';
import { PreviewsPage } from '../features/previews/previews_page';
import { StatsPage } from '../features/stats/stats_page';
import { AboutPage, DebugLogPage } from '../features/settings/about_page';
import { AccountPage } from '../features/account/account_page';
import { HashRouter, Link, Route, Routes, useParams, useLocation } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import { AppShell, mainBranches } from '../features/navigation/app_shell';
import { VideoPage } from '../features/video/video_page';
import { SearchPage } from '../features/search/search_page';

function VideoRoute() {
  const { id } = useParams();
  const { state } = useLocation();

  return <VideoPage key={id} id={id!} localVideo={state?.localVideo} />;
}

export function AppRouter() {
  const tr = useI18n();

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* 主分支由 AppShell 保留页面状态，其余路由正常进出 Outlet。 */}
          {mainBranches.map(({ pattern }) => (
            <Route key={pattern} path={pattern} element={<></>} />
          ))}
          <Route path="comics/cache" element={<ComicCachePage />} />
          <Route path="comics" element={<ComicsPage />} />
          <Route path="comics/:id" element={<ComicDetailPage />} />
          <Route path="getchu" element={<GetchuPage />} />
          <Route path="getchu/:id" element={<GetchuDetailPage />} />
          <Route path="previews" element={<PreviewsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings/keyframes" element={<KeyframesPage />} />
          <Route path="settings/about" element={<AboutPage />} />
          <Route path="settings/logs" element={<DebugLogPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="video/:id" element={<VideoRoute />} />
          <Route
            path="*"
            element={
              <Alert
                severity="info"
                action={
                  <Button component={Link} to="/" startIcon={<HomeOutlinedIcon />}>
                    {tr('返回首页')}
                  </Button>
                }
              >
                {tr('页面不存在')}
              </Alert>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}
