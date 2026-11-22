import { useI18n } from '../../app/i18n';
import { downloadSource } from './video_helpers';
import * as library from '../../data/local/library_repository';
import { useLibrary } from '../../data/local/library_repository';
import { useAccount } from '../account/account_controller';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import * as api from '../../data/remote/account_api';
import { useRemoteLibrary, invalidateRemoteLibrary } from '../library/library_page';
import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { type VideoDetail } from '../../domain/models/video';

export function VideoActions({ video }: { video: VideoDetail }) {
  const tr = useI18n();
  const state = useLibrary();
  const { account } = useAccount();
  const settings = useSettings();
  const remote = useRemoteLibrary();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [favoriteOverride, setFavoriteOverride] = useState<boolean>();
  const [subscriptionOverride, setSubscriptionOverride] = useState<boolean>();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const base = resolvedBaseUrl(settings);
  const token = video.csrfToken ?? remote.data?.csrfToken ?? account?.csrfToken;
  const actionToken = video.csrfToken ?? account?.csrfToken;
  const subscriptionUser = video.subscriptionUserId ?? video.currentUserId ?? account?.id;
  const favorite =
    favoriteOverride ??
    (remote.data?.favorites ?? state.favorites).some((item) => item.videoCode === video.id);
  const subscribed =
    subscriptionOverride ??
    (remote.data?.subscriptionArtists ?? state.artists).some(
      (artist) => artist.name === video.artist,
    );

  async function download(source = downloadSource(video.sources, settings.downloadQuality)) {
    if (!source) return;
    try {
      const result = await window.electron.downloads.create(video, source, 'default');
      setNotice(
        {
          queued: tr('已加入下载队列'),
          alreadyDownloaded: tr('已下载'),
          alreadyQueued: tr('已下载'),
        }[result],
      );
      setDownloadOpen(false);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function toggleFavorite() {
    setFavoriteOverride(!favorite);
    try {
      if (account && actionToken && (video.currentUserId ?? account.id))
        await api.setFavorite(
          base,
          actionToken,
          (video.currentUserId ?? account.id)!,
          video.id,
          !favorite,
        );
      else await library.setFavorite(video, !favorite);
      void invalidateRemoteLibrary();
    } catch (cause) {
      setFavoriteOverride(favorite);
      setError(String(cause));
    }
  }

  async function selectPlaylist(id: string) {
    try {
      if (account && token)
        await api.saveToPlaylist(
          base,
          token,
          id === '__watch_later__' ? 'save' : id,
          video.id,
          true,
        );
      else if (id === '__watch_later__') await library.setWatchLater(video, true);
      else await library.saveToPlaylist(video, id);
      void invalidateRemoteLibrary();
      setOpen(false);
    } catch (cause) {
      setError(String(cause));
    }
  }

  function newPlaylist() {
    setCreating(true);
    setTitle('');
    setDescription('');
  }

  function openPlaylists() {
    if (account && !token) {
      setNotice(tr('请先登录'));
      return;
    }
    setOpen(true);
  }

  async function share() {
    const text = `${video.title} (${video.id})`;
    if (navigator.share) await navigator.share({ title: video.title, text });
    else {
      await navigator.clipboard.writeText(text);
      setNotice(tr('已复制'));
    }
  }

  async function createPlaylist() {
    if (!title.trim()) return;
    try {
      if (account && token)
        await api.createPlaylist(base, token, video.id, title.trim(), description.trim());
      else await library.createPlaylistWithVideo(video, title.trim(), description.trim());
      void invalidateRemoteLibrary();
      setCreating(false);
      setOpen(false);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function subscribe() {
    setSubscriptionOverride(!subscribed);
    try {
      if (account && actionToken && subscriptionUser && video.artistId)
        await api.setSubscription(base, actionToken, subscriptionUser, video.artistId, !subscribed);
      else await library.setSubscription(video, !subscribed);
      void invalidateRemoteLibrary();
    } catch (cause) {
      setSubscriptionOverride(subscribed);
      setError(String(cause));
    }
  }

  return (
    <Stack
      spacing={1}
      sx={{
        my: 2,
      }}
    >
      <Stack direction="row" spacing={1}>
        <Button
          startIcon={<FavoriteIcon />}
          variant={favorite ? 'contained' : 'outlined'}
          onClick={toggleFavorite}
        >
          {favorite ? tr('已收藏') : tr('收藏')}
        </Button>
        <Button startIcon={<PlaylistAddIcon />} onClick={openPlaylists}>
          {tr('加入片单')}
        </Button>
        <Button disabled={!video.sources.length} onClick={() => download()}>
          {tr('下载')}
        </Button>
        <Button disabled={!video.sources.length} onClick={() => setDownloadOpen(true)}>
          {tr('选择下载清晰度')}
        </Button>
        <Button onClick={share}>{tr('分享')}</Button>
        {video.artist && (
          <Button
            onClick={subscribe}
            disabled={!!account && (!actionToken || !subscriptionUser || !video.artistId)}
          >
            {subscribed ? tr('取消订阅作者') : tr('订阅作者')}
          </Button>
        )}
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="info">{notice}</Alert>}
      <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)}>
        <DialogTitle>{tr('下载清晰度')}</DialogTitle>
        <DialogContent>
          <List>
            {video.sources.map((source) => (
              <ListItemButton key={source.url} onClick={() => download(source)}>
                <ListItemText primary={source.quality} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{tr('加入片单')}</DialogTitle>
        <DialogContent>
          <List>
            <ListItemButton onClick={() => selectPlaylist('__watch_later__')}>
              <ListItemText primary={tr('稍后再看')} />
            </ListItemButton>
            {(remote.data?.playlists ?? state.playlists).map((playlist) => (
              <ListItemButton key={playlist.id} onClick={() => selectPlaylist(playlist.id)}>
                <ListItemText
                  primary={playlist.title}
                  secondary={tr('{0} 个视频', playlist.count)}
                />
              </ListItemButton>
            ))}
          </List>
          {creating && (
            <Stack
              spacing={2}
              sx={{
                mt: 2,
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
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{tr('取消')}</Button>
          {creating ? (
            <Button onClick={createPlaylist}>{tr('创建')}</Button>
          ) : (
            <Button onClick={newPlaylist}>{tr('新建片单')}</Button>
          )}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
