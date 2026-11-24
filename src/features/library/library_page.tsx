import { useEffect, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl, resolvedLibraryTabOrder } from '../../core/settings';
import { queryClient } from '../../data/han1me_repository';
import * as library from '../../data/local/library_repository';
import { useLibrary } from '../../data/local/library_repository';
import * as watch from '../../data/local/watch_repository';
import * as api from '../../data/remote/account_api';
import * as han1meApi from '../../data/remote/han1me_api';
import type { FollowingVideo, Playlist, SubscribedArtist } from '../../domain/models/library';
import { createSearchQuery } from '../../domain/models/search_query';
import { useAccount } from '../account/account_controller';
import { libraryTabLabels } from '../settings/layout_settings';
import { LoadingIndicator } from '../shared/loading_indicator';
import { RequestError } from '../shared/request_error';
import { useConfirmation } from '../shared/use_confirmation';
import { VideoGridSkeleton } from '../shared/video_card';
import { BatchManageBar, LibraryVideoGrid } from './library_video_grid';
import { PlaylistSection } from './playlist_section';
import { ProfileCard } from './profile_card';
import { SubscriptionBar } from './subscription_bar';

export type RemoteLibraryTab =
  'watch-later' | 'favorites' | 'playlists' | 'subscriptions' | 'history';

function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!key || !seen.has(key)) {
      if (key) {
        seen.add(key);
      }
      result.push(item);
    }
  }
  return result;
}

export function LibraryPage({ initialTab }: { initialTab?: string }) {
  const tr = useI18n();
  const confirmation = useConfirmation();
  const settings = useSettings();
  const local = useLibrary();
  const { account, ready, logout } = useAccount();
  const history = useQuery({ queryKey: ['watch-state'], queryFn: watch.readWatchState });
  const tabOrder = resolvedLibraryTabOrder(settings);
  const [tab, setTab] = useState(
    initialTab && tabOrder.includes(initialTab) ? initialTab : tabOrder[0],
  );
  const [artist, setArtist] = useState('');
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const base = resolvedBaseUrl(settings);
  const userId = account?.id ?? '';
  const remoteEnabled = ready !== false && Boolean(userId);

  const watchLaterQuery = useInfiniteQuery({
    ...library.remoteWatchLater(base, userId),
    enabled: remoteEnabled && tab === 'watch-later',
  });
  const favoritesQuery = useInfiniteQuery({
    ...library.remoteFavorites(base, userId),
    enabled: remoteEnabled && tab === 'favorites',
  });
  const historyQuery = useInfiniteQuery({
    ...library.remoteHistory(base, userId),
    enabled: remoteEnabled && tab === 'history',
  });
  const playlistsQuery = useInfiniteQuery({
    ...library.remotePlaylists(base, userId),
    enabled: remoteEnabled && tab === 'playlists',
  });
  const subscriptionsQuery = useInfiniteQuery({
    ...library.remoteSubscriptions(base, userId),
    enabled: remoteEnabled && tab === 'subscriptions',
  });

  const remoteSubscriptionArtists: SubscribedArtist[] = useMemo(
    () => subscriptionsQuery.data?.pages[0]?.artists ?? [],
    [subscriptionsQuery.data],
  );
  const artists = account ? remoteSubscriptionArtists : local.artists;
  const selectedArtist = artists.find((item) => (account ? item.name : item.id) === artist);

  const artistVideosQuery = useInfiniteQuery({
    queryKey: ['han1me', 'artist-videos', base, selectedArtist?.name ?? ''],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      han1meApi.search(
        base,
        createSearchQuery({ text: selectedArtist?.name ?? '', page: pageParam }),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: remoteEnabled && tab === 'subscriptions' && Boolean(selectedArtist?.name),
  });

  const activeQuery =
    tab === 'watch-later'
      ? watchLaterQuery
      : tab === 'favorites'
        ? favoritesQuery
        : tab === 'history'
          ? historyQuery
          : tab === 'playlists'
            ? playlistsQuery
            : selectedArtist
              ? artistVideosQuery
              : subscriptionsQuery;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = activeQuery;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!account || !sentinel || !hasNextPage || isFetchingNextPage) {
      return;
    }
    const root = document.getElementById('app-scroll-container');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [account, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const remoteWatchLaterItems = useMemo(
    () =>
      dedupeBy(
        (watchLaterQuery.data?.pages ?? []).flatMap((p) => p.items),
        (v) => v.videoCode,
      ),
    [watchLaterQuery.data],
  );
  const remoteFavoriteItems = useMemo(
    () =>
      dedupeBy(
        (favoritesQuery.data?.pages ?? []).flatMap((p) => p.items),
        (v) => v.videoCode,
      ),
    [favoritesQuery.data],
  );
  const remoteHistoryItems = useMemo(
    () =>
      dedupeBy(
        (historyQuery.data?.pages ?? []).flatMap((p) => p.items),
        (v) => v.videoCode,
      ),
    [historyQuery.data],
  );
  const remotePlaylistItems: Playlist[] = useMemo(
    () =>
      dedupeBy(
        (playlistsQuery.data?.pages ?? []).flatMap((p) => p.items),
        (p) => p.id,
      ),
    [playlistsQuery.data],
  );
  const remoteSubscriptionItems = useMemo(
    () =>
      dedupeBy(
        (subscriptionsQuery.data?.pages ?? []).flatMap((p) => p.items),
        (v) => v.videoCode,
      ),
    [subscriptionsQuery.data],
  );
  const remoteArtistVideos: FollowingVideo[] = useMemo(
    () =>
      dedupeBy(
        (artistVideosQuery.data?.pages ?? []).flatMap((page) =>
          page.items
            .filter((item) => Boolean(item.id))
            .map((item) => ({
              videoCode: item.id,
              title: item.title,
              coverUrl: item.coverUrl,
              artistName: item.artist,
              duration: item.duration,
              views: item.views,
              rating: item.rating,
              uploadTime: item.uploadTime,
              addedAt: 0,
            })),
        ),
        (v) => v.videoCode,
      ),
    [artistVideosQuery.data],
  );

  const libraryToken =
    subscriptionsQuery.data?.pages[0]?.csrfToken ??
    watchLaterQuery.data?.pages[0]?.csrfToken ??
    favoritesQuery.data?.pages[0]?.csrfToken ??
    historyQuery.data?.pages[0]?.csrfToken ??
    playlistsQuery.data?.pages[0]?.csrfToken ??
    account?.csrfToken;

  const allLocalSubscriptionVideos = useMemo(() => {
    const map = new Map<string, FollowingVideo>();
    for (const items of Object.values(local.subscriptionVideos)) {
      for (const video of items) {
        if (!map.has(video.videoCode)) {
          map.set(video.videoCode, video);
        }
      }
    }
    return [...map.values()].sort((a, b) => b.addedAt - a.addedAt);
  }, [local.subscriptionVideos]);

  const localHistoryVideos: FollowingVideo[] = useMemo(() => {
    const continueCovers = new Map(
      (history.data?.continueItems ?? []).map((item) => [item.videoCode, item.coverUrl]),
    );
    return [...(history.data?.histories ?? [])].reverse().map((item) => ({
      videoCode: item.videoCode,
      title: item.title,
      coverUrl: item.coverUrl ?? continueCovers.get(item.videoCode),
      uploadTime: item.date,
      addedAt: item.createdAt,
      playlistItemId: item.id,
    }));
  }, [history.data]);

  const playlists = account ? remotePlaylistItems : local.playlists;

  const videos: FollowingVideo[] =
    tab === 'watch-later'
      ? account
        ? remoteWatchLaterItems
        : local.watchLater
      : tab === 'favorites'
        ? account
          ? remoteFavoriteItems
          : local.favorites
        : tab === 'subscriptions'
          ? selectedArtist
            ? account
              ? remoteArtistVideos
              : (local.subscriptionVideos[selectedArtist.id] ?? [])
            : account
              ? remoteSubscriptionItems
              : allLocalSubscriptionVideos
          : tab === 'history'
            ? account
              ? remoteHistoryItems
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
      if (tab === 'favorites' || tab === 'watch-later' || tab === 'history') {
        void invalidateRemoteLibrary(tab);
      }
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

  const selectableIds = videos.map(selectionId).filter((id): id is string => Boolean(id));
  const allSelected = selectableIds.length > 0 && selected.length === selectableIds.length;
  const canManage = tab !== 'subscriptions' && tab !== 'playlists' && selectableIds.length > 0;
  const artistGridPending = Boolean(
    account && tab === 'subscriptions' && selectedArtist && artistVideosQuery.isPending,
  );
  const tabPending = Boolean(
    account && (tab === 'subscriptions' ? subscriptionsQuery.isPending : activeQuery.isPending),
  );
  const tabError = account && !activeQuery.data ? activeQuery.error : null;

  return (
    <Stack spacing={2}>
      <ProfileCard account={account} onLogout={handleLogout} />
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Tabs value={tab} onChange={changeTab} variant="scrollable">
          {resolvedLibraryTabOrder(settings).map((key) => (
            <Tab key={key} value={key} label={tr(libraryTabLabels[key])} />
          ))}
        </Tabs>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexShrink: 0 }}>
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
                color: 'text.primary',
                fontSize: 13,
                fontWeight: 500,
                flexShrink: 0,
                '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
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
          {account && (
            <Tooltip title={tr('刷新')}>
              <IconButton
                size="small"
                aria-label={tr('刷新')}
                disabled={activeQuery.isFetching}
                onClick={() => void activeQuery.refetch()}
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {tabPending ? (
        <VideoGridSkeleton count={10} />
      ) : tabError ? (
        <RequestError error={tabError} onRetry={() => void activeQuery.refetch()} />
      ) : (
        <>
          {tab === 'playlists' && (
            <PlaylistSection
              base={base}
              account={account}
              libraryToken={libraryToken}
              playlists={playlists}
              onReloadRemote={() => void invalidateRemoteLibrary('playlists')}
              confirm={confirmation.confirm}
              createOpen={createPlaylistOpen}
              onCloseCreate={() => setCreatePlaylistOpen(false)}
            />
          )}

          {tab === 'subscriptions' && (
            <SubscriptionBar
              artists={artists}
              value={selectedArtist ? artist : ''}
              useNameKey={Boolean(account)}
              onChange={setArtist}
            />
          )}

          {tab !== 'playlists' &&
            (artistGridPending ? (
              <VideoGridSkeleton count={10} />
            ) : (
              <LibraryVideoGrid
                videos={videos}
                resetKey={`${tab}:${artist}`}
                selectable={tab !== 'subscriptions'}
                managing={managing}
                selected={selected}
                getSelectionId={selectionId}
                onToggle={toggle}
              />
            ))}

          {account && (
            <Box ref={loadMoreRef} sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
              {activeQuery.isFetchingNextPage && (
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ alignItems: 'center', color: 'text.secondary' }}
                >
                  <LoadingIndicator size="sm" />
                  <Typography variant="body2">{tr('正在加载更多…')}</Typography>
                </Stack>
              )}
              {activeQuery.isFetchNextPageError && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => void activeQuery.fetchNextPage()}
                >
                  {tr('重试')}
                </Button>
              )}
              {!activeQuery.hasNextPage &&
                !activeQuery.isFetchingNextPage &&
                (tab === 'playlists' ? playlists.length > 0 : videos.length > 0) && (
                  <Typography variant="caption" color="text.secondary">
                    {tr('已经到底了')}
                  </Typography>
                )}
            </Box>
          )}
        </>
      )}

      {confirmation.dialog}
    </Stack>
  );
}

export function invalidateRemoteLibrary(tab?: RemoteLibraryTab) {
  return queryClient.invalidateQueries({
    queryKey: tab ? ['han1me', 'library', tab] : ['han1me', 'library'],
  });
}

export function useRemotePlaylists(enabled = true) {
  const { account, ready } = useAccount();
  const base = resolvedBaseUrl(useSettings());
  const query = useInfiniteQuery({
    ...library.remotePlaylists(base, account?.id ?? ''),
    enabled: enabled && ready !== false && !!account?.id,
  });
  const playlists = useMemo(
    () =>
      dedupeBy(
        (query.data?.pages ?? []).flatMap((p) => p.items),
        (p) => p.id,
      ),
    [query.data],
  );
  return {
    ...query,
    playlists: query.data ? playlists : undefined,
    csrfToken: query.data?.pages[0]?.csrfToken,
  };
}

export function useRemoteFavorites(enabled = true) {
  const { account, ready } = useAccount();
  const base = resolvedBaseUrl(useSettings());
  const query = useInfiniteQuery({
    ...library.remoteFavorites(base, account?.id ?? ''),
    enabled: enabled && ready !== false && !!account?.id,
  });
  const favorites = useMemo(
    () =>
      dedupeBy(
        (query.data?.pages ?? []).flatMap((p) => p.items),
        (v) => v.videoCode,
      ),
    [query.data],
  );
  return {
    ...query,
    favorites: query.data ? favorites : undefined,
    csrfToken: query.data?.pages[0]?.csrfToken,
  };
}

export function useRemoteSubscriptions(enabled = true) {
  const { account, ready } = useAccount();
  const base = resolvedBaseUrl(useSettings());
  const query = useInfiniteQuery({
    ...library.remoteSubscriptions(base, account?.id ?? ''),
    enabled: enabled && ready !== false && !!account?.id,
  });
  return {
    ...query,
    artists: query.data?.pages[0]?.artists,
    csrfToken: query.data?.pages[0]?.csrfToken,
  };
}
