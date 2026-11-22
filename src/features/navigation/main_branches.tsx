import BookmarkIcon from '@mui/icons-material/Bookmark';
import DownloadIcon from '@mui/icons-material/Download';
import ExploreIcon from '@mui/icons-material/Explore';
import SettingsIcon from '@mui/icons-material/Settings';
import { matchPath } from 'react-router-dom';
import { CachePage } from '../cache/cache_page';
import { ComicCachePage } from '../comics/comic_cache_page';
import { ComicsPage } from '../comics/comic_pages';
import { ExplorePage } from '../explore/explore_page';
import { LibraryPage } from '../library/library_page';
import { SettingsPage } from '../settings/settings_page';

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
    label: '我的',
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
    label: '下载',
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

export function rootBranch(path: string) {
  return mainBranches.find((branch) => matchPath(branch.pattern, path))?.path;
}
