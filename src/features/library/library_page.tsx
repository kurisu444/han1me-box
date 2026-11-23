import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Button, Stack, Tab, Tabs } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl, resolvedLibraryTabOrder } from '../../core/settings';
import { queryClient } from '../../data/han1me_repository';
import * as library from '../../data/local/library_repository';
import { useLibrary } from '../../data/local/library_repository';
import * as watch from '../../data/local/watch_repository';
import * as api from '../../data/remote/account_api';
import type { FollowingVideo } from '../../domain/models/library';
import { useAccount } from '../account/account_controller';
import { libraryTabLabels } from '../settings/layout_settings';
import { LoadingState, RequestError } from '../shared/request_error';
import { useConfirmation } from '../shared/use_confirmation';
import { BatchManageBar, LibraryVideoGrid } from './library_video_grid';
import { PlaylistSection } from './playlist_section';
import { ProfileCard } from './profile_card';
import { SubscriptionBar } from './subscription_bar';

export function LibraryPage({ initialTab }: { initialTab?: string }) {
  const tr = useI18n();
  const confirmation = useConfirmation();
  const settings = useSettings();
  const local = useLibrary();
  const { account, logout } = useAccount();
  const remote = useRemoteLibrary();
  const history = useQuery({ queryKey: ['watch-state'], queryFn: watch.readWatchState });
  const tabOrder = resolvedLibraryTabOrder(settings);
  const [tab, setTab] = useState(
    initialTab && tabOrder.includes(initialTab) ? initialTab : tabOrder[0],
  );
  const [artist, setArtist] = useState('');
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);

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
  const libraryToken = remote.data?.csrfToken ?? account?.csrfToken;
  const allSubscriptionVideos = new Map<string, FollowingVideo>();
  for (const items of Object.values(state.subscriptionVideos)) {
    for (const video of items) {
      if (!allSubscriptionVideos.has(video.videoCode)) {
        allSubscriptionVideos.set(video.videoCode, video);
      }
    }
  }
  const continueCovers = new Map(
    (history.data?.continueItems ?? []).map((item) => [item.videoCode, item.coverUrl]),
  );
  const localHistoryVideos: FollowingVideo[] = [...(history.data?.histories ?? [])]
    .reverse()
    .map((item) => ({
      videoCode: item.videoCode,
      title: item.title,
      coverUrl: item.coverUrl ?? continueCovers.get(item.videoCode),
      uploadTime: item.date,
      addedAt: item.createdAt,
      playlistItemId: item.id,
    }));
  const selectedArtist = state.artists.find((item) => (account ? item.name : item.id) === artist);
  const videos: FollowingVideo[] =
    tab === 'watch-later'
      ? state.watchLater
      : tab === 'favorites'
        ? state.favorites
        : tab === 'subscriptions'
          ? selectedArtist
            ? remote.data
              ? remote.data.subscriptions.filter(
                  (video) => video.artistName === selectedArtist.name,
                )
              : (state.subscriptionVideos[selectedArtist.id] ?? [])
            : (remote.data?.subscriptions ??
              [...allSubscriptionVideos.values()].sort((a, b) => b.addedAt - a.addedAt))
          : tab === 'history'
            ? account
              ? (remote.data?.history ?? [])
              : localHistoryVideos
            : [];

  function changeTab(_event: unknown, value: string) {
    setTab(value);
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

  async function removeSelected() {
    if (!(await confirmation.confirm(tr('删除所选的 {0} 项？', selected.length)))) {
      return;
    }
    const ids = new Set(selected);
    if (account) {
      const token = tab === 'history' ? (account.csrfToken ?? libraryToken) : libraryToken;
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
      }
      void invalidateRemoteLibrary();
      setSelected([]);
      return;
    }
    if (tab === 'favorites') {
      await library.removeFavorites(ids);
    }
    if (tab === 'watch-later') {
      await library.removeWatchLater(ids);
    }
    if (tab === 'history') {
      await watch.deleteHistories(ids);
      void history.refetch();
    }
    setSelected([]);
  }

  function selectionId(video: FollowingVideo) {
    return tab === 'history' && !account
      ? (video.playlistItemId ?? video.videoCode)
      : video.videoCode;
  }

  if (account && remote.isPending) {
    return <LoadingState label={tr('正在加载…')} />;
  }
  if (account && remote.error) {
    return <RequestError error={remote.error} onRetry={remote.refetch} />;
  }

  const selectableIds = videos.map(selectionId).filter((id): id is string => Boolean(id));
  const allSelected = selectableIds.length > 0 && selected.length === selectableIds.length;
  const canManage = tab !== 'subscriptions' && tab !== 'playlists' && selectableIds.length > 0;

  return (
    <Stack spacing={2}>
      <ProfileCard account={account} onLogout={handleLogout} />
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Tabs value={tab} onChange={changeTab} variant="scrollable">
          {resolvedLibraryTabOrder(settings).map((key) => (
            <Tab key={key} value={key} label={tr(libraryTabLabels[key])} />
          ))}
        </Tabs>
        {tab === 'playlists' && (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<AddRoundedIcon sx={{ fontSize: 17 }} />}
            onClick={() => setCreatePlaylistOpen(true)}
            sx={{
              height: 32,
              px: 1.5,
              borderRadius: '8px',
              borderColor: 'divider',
              color: 'text.secondary',
              fontSize: 13,
              flexShrink: 0,
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            {tr('新建片单')}
          </Button>
        )}
        {canManage && (
          <BatchManageBar
            managing={managing}
            selectedCount={selected.length}
            allSelected={allSelected}
            onToggleManaging={() => {
              setManaging((open) => !open);
              setSelected([]);
            }}
            onToggleAll={() => setSelected(allSelected ? [] : selectableIds)}
            onRemove={removeSelected}
          />
        )}
      </Stack>

      {tab === 'playlists' && (
        <PlaylistSection
          base={base}
          account={account}
          libraryToken={libraryToken}
          playlists={state.playlists}
          onReloadRemote={() => void invalidateRemoteLibrary()}
          confirm={confirmation.confirm}
          createOpen={createPlaylistOpen}
          onCloseCreate={() => setCreatePlaylistOpen(false)}
        />
      )}

      {tab === 'subscriptions' && (
        <SubscriptionBar
          artists={state.artists}
          value={selectedArtist ? artist : ''}
          useNameKey={Boolean(account)}
          onChange={setArtist}
        />
      )}

      {tab !== 'playlists' && (
        <LibraryVideoGrid
          videos={videos}
          resetKey={`${tab}:${artist}`}
          selectable={tab !== 'subscriptions'}
          managing={managing}
          selected={selected}
          getSelectionId={selectionId}
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
