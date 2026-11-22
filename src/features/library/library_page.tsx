import { cardGridSx, VideoGrid, VideoCover, VideoCardTile } from '../shared/video_card';
import { useI18n } from '../../app/i18n';
import { useConfirmation } from '../shared/use_confirmation';
import * as library from '../../data/local/library_repository';
import { useLibrary } from '../../data/local/library_repository';
import { useState } from 'react';
import { useAccount } from '../account/account_controller';
import { resolvedBaseUrl, resolvedLibraryTabOrder } from '../../core/settings';
import * as api from '../../data/remote/account_api';
import { playlist as playlistQuery, queryClient } from '../../data/han1me_repository';
import { RequestError, LoadingState } from '../shared/request_error';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useSettings } from '../../app/settings_context';
import * as watch from '../../data/local/watch_repository';
import {
  sortPlaylistVideos,
  type FollowingVideo,
  type PlaylistSortOrder,
} from '../../domain/models/library';
import { useQuery } from '@tanstack/react-query';

const labels: Record<string, string> = {
  'watch-later': '稍后再看',
  favorites: '收藏',
  playlists: '片单',
  subscriptions: '订阅',
  history: '历史',
};
export function LibraryPage({ initialTab = 'watch-later' }: { initialTab?: string }) {
  const tr = useI18n();
  const confirmation = useConfirmation();
  const settings = useSettings();
  const local = useLibrary();
  const { account, ready } = useAccount();
  const remote = useRemoteLibrary();
  const history = useQuery({ queryKey: ['watch-state'], queryFn: watch.readWatchState });
  const [tab, setTab] = useState(
    resolvedLibraryTabOrder(settings).includes(initialTab) ? initialTab : 'watch-later',
  );
  const [playlistId, setPlaylistId] = useState('');
  const [artist, setArtist] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      if (!allSubscriptionVideos.has(video.videoCode))
        allSubscriptionVideos.set(video.videoCode, video);
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
    setSelected([]);
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

  function editPlaylist() {
    setTitle(playlist?.title ?? '');
    setDescription(playlistDescription ?? '');
    setEditing(true);
  }

  function reloadRemote() {
    void invalidateRemoteLibrary();
    if (playlistId) void remotePlaylist.refetch();
  }

  async function savePlaylist() {
    if (!title.trim()) return;
    if (account) {
      const token = playlist ? account.csrfToken : libraryToken;
      if (!token) return;
      if (playlist)
        await api.updatePlaylist(base, token, playlist.id, title.trim(), description.trim());
      else await api.createPlaylist(base, token, '', title.trim(), description.trim());
      reloadRemote();
    } else if (playlist) await library.updatePlaylist(playlist.id, title, description);
    else await library.createPlaylist(title.trim(), description.trim());
    setEditing(false);
  }

  async function deletePlaylist() {
    if (!(await confirmation.confirm(tr('删除此片单？')))) return;
    if (account) {
      if (!account.csrfToken) return;
      await api.deletePlaylist(base, account.csrfToken, playlistId);
      reloadRemote();
    } else await library.deletePlaylist(playlistId);
    setPlaylistId('');
  }

  async function removeSelected() {
    if (!(await confirmation.confirm(tr('删除所选的 {0} 项？', selected.length)))) return;
    const ids = new Set(selected);
    if (account) {
      const token =
        tab === 'playlists'
          ? account.csrfToken
          : tab === 'history'
            ? (account.csrfToken ?? libraryToken)
            : libraryToken;
      if (!token || !account.id) return;
      for (const id of ids) {
        if (tab === 'favorites') await api.setFavorite(base, token, account.id!, id, false);
        if (tab === 'watch-later') await api.saveToPlaylist(base, token, 'save', id, false);
        if (tab === 'history') await api.deleteHistory(base, token, id);
        if (tab === 'playlists') {
          await api.removePlaylistItem(base, token, id);
        }
      }
      reloadRemote();
      setSelected([]);
      return;
    }
    if (tab === 'favorites') await library.removeFavorites(ids);
    if (tab === 'watch-later') await library.removeWatchLater(ids);
    if (tab === 'playlists') await library.removePlaylistVideos(playlistId, ids);
    if (tab === 'history') {
      await watch.deleteHistories(ids);
      history.refetch();
    }
    setSelected([]);
  }

  async function sharePlaylist() {
    const url = `https://hanimeone.me/playlist?list=${playlistId}`;
    if (navigator.share) await navigator.share({ title: playlist?.title, url });
    else await navigator.clipboard.writeText(url);
  }

  function selectionId(video: FollowingVideo) {
    return account && tab === 'playlists' ? video.playlistItemId : video.videoCode;
  }

  function changeSort(value: string) {
    if (account) setRemoteSort(value);
    else void library.setPlaylistSort(playlistId, value as PlaylistSortOrder);
  }

  if (account && remote.isPending) return <LoadingState label={tr('正在加载媒体库…')} />;
  if (account && remote.error)
    return <RequestError error={remote.error} onRetry={remote.refetch} />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="h4">
          {tr(settings.useNavigationDrawer ? labels[tab] : '媒体库')}
        </Typography>
        <Button component={Link} to="/stats">
          {tr('统计')}
        </Button>
      </Stack>
      {!settings.useNavigationDrawer && (
        <Tabs value={tab} onChange={changeTab} variant="scrollable">
          {resolvedLibraryTabOrder(settings).map((key) => (
            <Tab key={key} value={key} label={tr(labels[key])} />
          ))}
        </Tabs>
      )}
      {selected.length > 0 && (
        <Button color="error" onClick={removeSelected}>
          {tr('删除所选（')}
          {selected.length}）
        </Button>
      )}
      {tab === 'playlists' && (
        <Stack direction="row" spacing={1}>
          {playlist && <Button onClick={() => openPlaylist('')}>{tr('返回片单列表')}</Button>}
          <Button onClick={editPlaylist}>{playlist ? tr('编辑片单') : tr('新建片单')}</Button>
          {playlist && (
            <Button color="error" onClick={deletePlaylist}>
              {tr('删除片单')}
            </Button>
          )}
          {playlist && (
            <TextField
              select
              label={tr('排序')}
              size="small"
              value={account ? remoteSort : playlist.sort}
              onChange={(event) => changeSort(event.target.value)}
            >
              {(account
                ? [
                    ['latest', tr('最新')],
                    ['popular', tr('热门')],
                    ['oldest', tr('最早')],
                  ]
                : [
                    ['recentlyAdded', tr('最近添加')],
                    ['oldestAdded', tr('最早添加')],
                    ['title', tr('标题')],
                  ]
              ).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      )}
      {tab === 'playlists' && !playlist && (
        <Box sx={cardGridSx}>
          {state.playlists.map((item) => (
            <Card key={item.id}>
              <CardActionArea
                onClick={() => openPlaylist(item.id)}
                sx={{
                  p: 2,
                }}
              >
                <Box sx={{ aspectRatio: '16/9' }}>
                  <VideoCover url={item.coverUrl ?? ''} title={item.title} />
                </Box>
                <Typography variant="h6">{item.title}</Typography>
                <Typography>
                  {item.count}
                  {tr('个视频')}
                </Typography>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
      {tab === 'subscriptions' && (
        <TextField
          select
          label={tr('作者')}
          value={selectedArtist ? artist : ''}
          onChange={(event) => setArtist(event.target.value)}
        >
          <MenuItem value="">{tr('全部作者')}</MenuItem>
          {state.artists.map((item) => (
            <MenuItem key={item.id} value={account ? item.name : item.id}>
              {item.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {selectedArtist && (
        <Button component={Link} to={`/search?query=${encodeURIComponent(selectedArtist.name)}`}>
          {tr('搜索作者')}
        </Button>
      )}
      {playlist && (
        <Stack spacing={1}>
          {playlist.coverUrl && (
            <Box sx={{ maxWidth: 600, aspectRatio: '16/9' }}>
              <VideoCover url={playlist.coverUrl} title={playlist.title} />
            </Box>
          )}
          <Typography variant="h6">{playlist.title}</Typography>
          <Typography>{playlistDescription}</Typography>
          <Typography>{remotePlaylist.data?.author}</Typography>
          <Typography>
            {tr('{0} 个视频', playlist.count)}{' '}
            {remotePlaylist.data?.viewCount != null &&
              tr('{0} 次观看', remotePlaylist.data.viewCount)}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              to={`/video/${videos[0]?.videoCode ?? ''}`}
              disabled={!videos.length}
            >
              {tr('播放全部')}
            </Button>
            {account && <Button onClick={sharePlaylist}>{tr('分享')}</Button>}
          </Stack>
        </Stack>
      )}
      {playlist && remotePlaylist.isPending && account && (
        <LoadingState label={tr('正在加载片单…')} />
      )}
      {playlist && remotePlaylist.error && (
        <RequestError error={remotePlaylist.error} onRetry={remotePlaylist.refetch} />
      )}
      <VideoGrid>
        {videos.map((video, index) => (
          <Box key={`${video.videoCode}-${index}`}>
            {tab !== 'subscriptions' && (
              <Checkbox
                checked={selected.includes(selectionId(video) ?? '')}
                disabled={!selectionId(video)}
                onChange={() => toggle(selectionId(video)!)}
                slotProps={{
                  input: {
                    'aria-label': tr('选择 {0}', video.title),
                  },
                }}
              />
            )}
            <VideoCardTile
              video={{
                ...video,
                id: video.videoCode,
                coverUrl: video.coverUrl ?? '',
                artist: video.artistName,
              }}
            />
          </Box>
        ))}
      </VideoGrid>
      {tab === 'history' && !account && (
        <>
          <Typography variant="h6">{tr('继续观看')}</Typography>
          <List>
            {history.data?.continueItems.map((item) => (
              <ListItem
                key={item.videoCode}
                component={Link}
                to={`/video/${encodeURIComponent(item.videoCode)}`}
              >
                <Avatar
                  src={item.coverUrl}
                  variant="rounded"
                  sx={{
                    mr: 2,
                  }}
                />
                <ListItemText
                  primary={item.title}
                  secondary={
                    `${Math.floor(item.positionMs / 1000)} / ` +
                    tr('{0} 秒', Math.floor(item.durationMs / 1000))
                  }
                />
              </ListItem>
            ))}
          </List>
          <Typography variant="h6">{tr('观看历史')}</Typography>
          <List>
            {[...(history.data?.histories ?? [])].reverse().map((item) => (
              <ListItem key={item.id}>
                <Checkbox checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                <ListItemText
                  primary={
                    <Link to={`/video/${encodeURIComponent(item.videoCode)}`}>{item.title}</Link>
                  }
                  secondary={tr('{0} · {1} 秒', item.date, Math.round(item.watchedMs / 1000))}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
      <Dialog open={editing} onClose={() => setEditing(false)} fullWidth>
        <DialogTitle>{playlist ? tr('编辑片单') : tr('新建片单')}</DialogTitle>
        <DialogContent>
          <Stack
            spacing={2}
            sx={{
              pt: 1,
            }}
          >
            <TextField
              label={tr('名称')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              label={tr('简介')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              multiline
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(false)}>{tr('取消')}</Button>
          <Button onClick={savePlaylist}>{tr('保存')}</Button>
        </DialogActions>
      </Dialog>
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
