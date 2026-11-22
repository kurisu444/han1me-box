import { useState } from 'react';
import ChecklistIcon from '@mui/icons-material/Checklist';
import { Button, MenuItem, Stack, Tab, Tabs, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl, resolvedLibraryTabOrder } from '../../core/settings';
import { playlist as playlistQuery, queryClient } from '../../data/han1me_repository';
import * as library from '../../data/local/library_repository';
import { useLibrary } from '../../data/local/library_repository';
import * as watch from '../../data/local/watch_repository';
import * as api from '../../data/remote/account_api';
import { type FollowingVideo, sortPlaylistVideos } from '../../domain/models/library';
import { useAccount } from '../account/account_controller';
import { libraryTabLabels } from '../settings/layout_settings';
import { LoadingState, RequestError } from '../shared/request_error';
import { useConfirmation } from '../shared/use_confirmation';
import { LibraryVideoGrid, LocalHistoryList } from './library_video_grid';
import { PlaylistSection } from './playlist_section';
import { ProfileCard } from './profile_card';

export function LibraryPage({ initialTab }: { initialTab?: string }) {
  const tr = useI18n();
  const confirmation = useConfirmation();
  const settings = useSettings();
  const local = useLibrary();
  const { account, ready, logout } = useAccount();
  const remote = useRemoteLibrary();
  const history = useQuery({ queryKey: ['watch-state'], queryFn: watch.readWatchState });
  const tabOrder = resolvedLibraryTabOrder(settings);
  const [tab, setTab] = useState(
    initialTab && tabOrder.includes(initialTab) ? initialTab : tabOrder[0],
  );
  const [playlistId, setPlaylistId] = useState('');
  const [artist, setArtist] = useState('');
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [remoteSort, setRemoteSort] = useState('latest');
  const remotePlaylist = useQuery({
    ...playlistQuery(resolvedBaseUrl(settings), playlistId, remoteSort),
    enabled: ready !== false && !!account && !!playlistId,
  });

  const base = resolvedBaseUrl(settings);
  const state = remote.data
    ? {
        ...local,
        watchLater: remote.data.watchLater,
        favorites: remote.data.favorites,
        playlists: remote.data.playlists,
        artists: remote.data.subscriptionArtists,
      }
    : local;
  const summary = state.playlists.find((item) => item.id === playlistId);
  const playlist = account && playlistId ? (remotePlaylist.data?.playlist ?? summary) : summary;
  const playlistDescription = account ? remotePlaylist.data?.description : playlist?.description;
  const libraryToken = remote.data?.csrfToken ?? account?.csrfToken;
  const allSubscriptionVideos = new Map<string, FollowingVideo>();
  for (const items of Object.values(state.subscriptionVideos)) {
    for (const video of items) {
      if (!allSubscriptionVideos.has(video.videoCode)) {
        allSubscriptionVideos.set(video.videoCode, video);
      }
    }
  }
  const selectedArtist = state.artists.find((item) => (account ? item.name : item.id) === artist);
  const videos: FollowingVideo[] =
    tab === 'watch-later'
      ? state.watchLater
      : tab === 'favorites'
        ? state.favorites
        : tab === 'playlists' && playlist
          ? account
            ? (remotePlaylist.data?.videos ?? [])
            : sortPlaylistVideos(playlist.sort, playlist.videos)
          : tab === 'subscriptions'
            ? selectedArtist
              ? remote.data
                ? remote.data.subscriptions.filter(
                    (video) => video.artistName === selectedArtist.name,
                  )
                : (state.subscriptionVideos[selectedArtist.id] ?? [])
              : (remote.data?.subscriptions ??
                [...allSubscriptionVideos.values()].sort((a, b) => b.addedAt - a.addedAt))
            : tab === 'history' && account
              ? (remote.data?.history ?? [])
              : [];

  function changeTab(_event: unknown, value: string) {
    setTab(value);
    setPlaylistId('');
    setManaging(false);
    setSelected([]);
  }

  async function handleLogout() {
    if (await confirmation.confirm(tr('确认退出登录？'))) {
      await logout();
    }
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function openPlaylist(id: string) {
    setPlaylistId(id);
    setRemoteSort('latest');
    setSelected([]);
  }

  function reloadRemote() {
    void invalidateRemoteLibrary();
    if (playlistId) {
      void remotePlaylist.refetch();
    }
  }

  async function removeSelected() {
    if (!(await confirmation.confirm(tr('删除所选的 {0} 项？', selected.length)))) {
      return;
    }
    const ids = new Set(selected);
    if (account) {
      const token =
        tab === 'playlists'
          ? account.csrfToken
          : tab === 'history'
            ? (account.csrfToken ?? libraryToken)
            : libraryToken;
      if (!token || !account.id) {
        return;
      }
      for (const id of ids) {
        if (tab === 'favorites') {
          await api.setFavorite(base, token, account.id, id, false);
        }
        if (tab === 'watch-later') {
          await api.saveToPlaylist(base, token, 'save', id, false);
        }
        if (tab === 'history') {
          await api.deleteHistory(base, token, id);
        }
        if (tab === 'playlists') {
          await api.removePlaylistItem(base, token, id);
        }
      }
      reloadRemote();
      setSelected([]);
      return;
    }
    if (tab === 'favorites') {
      await library.removeFavorites(ids);
    }
    if (tab === 'watch-later') {
      await library.removeWatchLater(ids);
    }
    if (tab === 'playlists') {
      await library.removePlaylistVideos(playlistId, ids);
    }
    if (tab === 'history') {
      await watch.deleteHistories(ids);
      history.refetch();
    }
    setSelected([]);
  }

  function selectionId(video: FollowingVideo) {
    return account && tab === 'playlists' ? video.playlistItemId : video.videoCode;
  }

  if (account && remote.isPending) {
    return <LoadingState label={tr('正在加载…')} />;
  }
  if (account && remote.error) {
    return <RequestError error={remote.error} onRetry={remote.refetch} />;
  }

  const canManage =
    tab !== 'subscriptions' &&
    (videos.length > 0 ||
      (tab === 'history' && !account && (history.data?.histories.length ?? 0) > 0));

  return (
    <Stack spacing={2}>
      <ProfileCard account={account} onLogout={handleLogout} />
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Tabs value={tab} onChange={changeTab} variant="scrollable">
          {resolvedLibraryTabOrder(settings).map((key) => (
            <Tab key={key} value={key} label={tr(libraryTabLabels[key])} />
          ))}
        </Tabs>
        {canManage && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center' }}>
            {managing && selected.length > 0 && (
              <Button size="small" color="error" variant="contained" onClick={removeSelected}>
                {tr('删除所选（')}
                {selected.length}）
              </Button>
            )}
            <Button
              size="small"
              color={managing ? 'primary' : 'inherit'}
              startIcon={!managing ? <ChecklistIcon fontSize="small" /> : undefined}
              onClick={() => {
                setManaging((open) => !open);
                setSelected([]);
              }}
              sx={{ color: managing ? 'primary.main' : 'text.secondary' }}
            >
              {tr(managing ? '完成' : '批量管理')}
            </Button>
          </Stack>
        )}
      </Stack>

      {tab === 'playlists' && (
        <PlaylistSection
          base={base}
          account={account}
          libraryToken={libraryToken}
          playlists={state.playlists}
          playlist={playlist}
          playlistId={playlistId}
          playlistDescription={playlistDescription}
          remoteAuthor={remotePlaylist.data?.author}
          remoteViewCount={remotePlaylist.data?.viewCount}
          remotePending={remotePlaylist.isPending}
          remoteError={remotePlaylist.error}
          onRetryRemote={remotePlaylist.refetch}
          remoteSort={remoteSort}
          onChangeSort={setRemoteSort}
          videos={videos}
          onOpenPlaylist={openPlaylist}
          onReloadRemote={reloadRemote}
          confirm={confirmation.confirm}
        />
      )}

      {tab === 'subscriptions' && (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <TextField
            select
            size="small"
            label={tr('作者')}
            value={selectedArtist ? artist : ''}
            onChange={(event) => setArtist(event.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">{tr('全部作者')}</MenuItem>
            {state.artists.map((item) => (
              <MenuItem key={item.id} value={account ? item.name : item.id}>
                {item.name}
              </MenuItem>
            ))}
          </TextField>
          {selectedArtist && (
            <Button
              size="small"
              variant="outlined"
              component={Link}
              to={`/search?query=${encodeURIComponent(selectedArtist.name)}`}
            >
              {tr('搜索作者')}
            </Button>
          )}
        </Stack>
      )}

      <LibraryVideoGrid
        videos={videos}
        resetKey={`${tab}:${playlistId}:${artist}`}
        selectable={tab !== 'subscriptions'}
        managing={managing}
        selected={selected}
        getSelectionId={selectionId}
        onToggle={toggle}
      />

      {tab === 'history' && !account && (
        <LocalHistoryList
          history={history.data}
          managing={managing}
          selected={selected}
          onToggle={toggle}
        />
      )}

      {confirmation.dialog}
    </Stack>
  );
}

export function invalidateRemoteLibrary() {
  return queryClient.invalidateQueries({ queryKey: ['han1me', 'library'] });
}

export function useRemoteLibrary() {
  const { account, ready } = useAccount();
  const base = resolvedBaseUrl(useSettings());

  return useQuery({
    ...library.remoteLibrary(base, account?.id ?? ''),
    enabled: ready !== false && !!account?.id,
  });
}
