import {
  clearRequests,
  video as videoQuery,
  queryClient,
} from '../../../src/data/han1me_repository';
import {
  useRemotePlaylists,
  invalidateRemoteLibrary,
} from '../../../src/features/library/library_page';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { HashRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { SettingsContext } from '../../../src/app/settings_context';
import { createAppSettings } from '../../../src/core/settings';
import { VideoPlayerPanel } from '../../../src/features/video/player/video_player_panel';
import { VideoPage } from '../../../src/features/video/video_page';
import { ExplorePage } from '../../../src/features/explore/explore_page';
import { ImageGallery } from '../../../src/features/shared/image_gallery';
import { ComicReader } from '../../../src/features/comics/comic_pages';
import { CommentsList } from '../../../src/features/video/comments/video_comments';
import { AccountContext } from '../../../src/features/account/account_controller';
import * as library from '../../../src/data/local/library_repository';
import { useLibrary } from '../../../src/data/local/library_repository';
import { type VideoDetail } from '../../../src/domain/models/video';

const root = createRoot(document.getElementById('root')!);
const settings = createAppSettings({ language: 'english', autoPlayOnOpen: false });
const video: VideoDetail = {
  id: 'test-player',
  title: 'Player fixture',
  coverUrl: '',
  tags: [],
  playlist: [],
  related: [],
  sources: [],
};
function render(name: string, content: ReactNode) {
  flushSync(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <SettingsContext
          value={{
            settings: { ...settings, baseUrl: location.origin },
            save: async () => {},
          }}
        >
          <HashRouter key={name}>{content}</HashRouter>
        </SettingsContext>
      </QueryClientProvider>,
    ),
  );
}
export function videoDetail() {
  render('video', <VideoPage id="123" />);
}
export function home() {
  render('home', <ExplorePage />);
}
export function fetchVideo() {
  return queryClient.fetchQuery(videoQuery(location.origin, '123'));
}
export function renameVideo() {
  queryClient.setQueryData(videoQuery(location.origin, '123').queryKey, (video) => ({
    ...video!,
    title: 'Shared query updated',
  }));
}
export function isFetching() {
  return queryClient.isFetching();
}
export function player(mediaBase: string, broken = false) {
  render(
    'player',
    <VideoPlayerPanel
      video={{
        ...video,
        sources: [
          {
            quality: '720',
            url: `${mediaBase}/hls/${broken ? 'broken' : 'playlist'}.m3u8`,
            type: 'application/vnd.apple.mpegurl',
          },
          { quality: '480', url: `${location.origin}/sample.webm`, type: 'video/webm' },
        ],
      }}
    />,
  );
}
export function gallery() {
  render('gallery', <ImageGallery title="Gallery" images={['/picture.svg?1', '/picture.svg?2']} />);
}
export function reader() {
  render(
    'reader',
    <ComicReader
      comic={{
        id: 'reader',
        title: 'Reader',
        coverUrl: '',
        pageCount: 2,
        tags: [],
        imageUrls: ['/picture.svg?1', '/picture.svg?2'],
      }}
      onClose={() => {}}
    />,
  );
}
function Favorites({ name }: { name: string }) {
  const state = useLibrary();
  return <output data-favorites={name}>{state.favorites.length}</output>;
}
export function favorites() {
  render(
    'favorites',
    <>
      <Favorites name="one" />
      <Favorites name="two" />
    </>,
  );
}
export function addFavorite() {
  return library.setFavorite(video, true);
}
function RemoteLibrary() {
  const resource = useRemotePlaylists();
  return <div>{resource.isPending ? 'Remote loading' : 'Remote ready'}</div>;
}
export function comments(id: string, accountId = '7', remote = false) {
  const noop = async () => {};
  render(
    `${remote ? 'remote' : 'comments'}-${id}-${accountId}`,
    <AccountContext
      value={{
        account: { id: accountId, name: 'Fixture', cookie: '' },
        accounts: [],
        ready: true,
        saveCookie: noop,
        activate: noop,
        remove: noop,
        refresh: noop,
        logout: noop,
      }}
    >
      {remote ? <RemoteLibrary /> : <CommentsList id={id} />}
    </AccountContext>,
  );
}
export { clearRequests, invalidateRemoteLibrary };
export function expireComments() {
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ['han1me', 'comments-infinite'] })) {
    queryClient.setQueryData(query.queryKey, query.state.data, { updatedAt: Date.now() - 600001 });
  }
}
export function empty() {
  render('empty', createElement('div', null, 'Empty'));
}
