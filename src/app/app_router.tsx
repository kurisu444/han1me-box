import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import { Alert, Button } from '@mui/material';
import { HashRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AccountPage } from '../features/account/account_page';
import { ComicCachePage } from '../features/comics/comic_cache_page';
import { ComicDetailPage, ComicsPage } from '../features/comics/comic_pages';
import { AppShell, mainBranches } from '../features/navigation/app_shell';
import { GetchuDetailPage, GetchuPage } from '../features/previews/getchu_page';
import { PreviewsPage } from '../features/previews/previews_page';
import { SearchPage } from '../features/search/search_page';
import { AboutPage, DebugLogPage } from '../features/settings/about_page';
import { KeyframesPage } from '../features/settings/keyframes_page';
import { StatsPage } from '../features/stats/stats_page';
import { VideoPage } from '../features/video/video_page';
import { useI18n } from './i18n';

function VideoRoute() {
  const { id } = useParams();
  const { state } = useLocation();

  return <VideoPage key={id} id={id ?? ''} localVideo={state?.localVideo} />;
}

export function AppRouter() {
  const tr = useI18n();

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* 主分支由 AppShell 保留页面状态，其余路由正常进出 Outlet。 */}
          {mainBranches.map(({ pattern }) => (
            <Route key={pattern} path={pattern} element={null} />
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
