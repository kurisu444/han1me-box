import BookmarkIcon from '@mui/icons-material/Bookmark';
import DownloadIcon from '@mui/icons-material/Download';
import ExploreIcon from '@mui/icons-material/Explore';
import SettingsIcon from '@mui/icons-material/Settings';
import { matchPath } from 'react-router-dom';
import { CachePage } from '../cache/cache_page';
import { ExplorePage } from '../explore/explore_page';
import { LibraryPage } from '../library/library_page';
import { SettingsPage } from '../settings/settings_page';

export const mainBranches = [
  {
    path: '/',
    pattern: '/',
    label: '首页',
    icon: <ExploreIcon />,
    render: () => <ExplorePage />,
  },
  {
    path: '/library',
    pattern: '/library/:tab?',
    label: '我的',
    icon: <BookmarkIcon />,
    render: (tab?: string) => <LibraryPage key={tab} initialTab={tab} />,
  },
  {
    path: '/cache',
    pattern: '/cache',
    label: '下载',
    icon: <DownloadIcon />,
    render: () => <CachePage />,
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
