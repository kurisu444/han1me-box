import { useState, type MouseEvent, type ReactNode } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { siteEndpointUrl } from '../../core/site_url';
import * as library from '../../data/local/library_repository';
import { useLibrary } from '../../data/local/library_repository';
import * as api from '../../data/remote/account_api';
import type { VideoDetail } from '../../domain/models/video';
import { useAccount } from '../account/account_controller';
import { invalidateRemoteLibrary, useRemoteLibrary } from '../library/library_page';
import { NoticeToast, type NoticeMessage } from '../shared/notice_toast';
import { downloadSource } from './video_helpers';

function ActionTile({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        py: 1,
        px: 0.5,
        borderRadius: '8px',
        color: active ? 'primary.main' : 'text.secondary',
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 0.15s ease, color 0.15s ease',
        '&:hover': { bgcolor: 'action.hover', color: active ? 'primary.main' : 'text.primary' },
      }}
    >
      {icon}
      <Typography variant="caption" noWrap sx={{ fontSize: 11.5, fontWeight: active ? 600 : 500 }}>
        {label}
      </Typography>
    </ButtonBase>
  );
}

export function AuthorSubscribeButton({ video }: { video: VideoDetail }) {
  const tr = useI18n();
  const state = useLibrary();
  const { account } = useAccount();
  const settings = useSettings();
  const remote = useRemoteLibrary();
  const [subscriptionOverride, setSubscriptionOverride] = useState<boolean>();

  const base = resolvedBaseUrl(settings);
  const actionToken = video.csrfToken ?? account?.csrfToken;
  const subscriptionUser = video.subscriptionUserId ?? video.currentUserId ?? account?.id;
  const subscribed =
    subscriptionOverride ??
    (remote.data?.subscriptionArtists ?? state.artists).some(
      (artist) => artist.name === video.artist,
    );
  const disabled = Boolean(account && (!actionToken || !subscriptionUser || !video.artistId));

  async function toggleSubscription() {
    setSubscriptionOverride(!subscribed);
    try {
      if (account && actionToken && subscriptionUser && video.artistId) {
        await api.setSubscription(base, actionToken, subscriptionUser, video.artistId, !subscribed);
      } else {
        await library.setSubscription(video, !subscribed);
      }
      void invalidateRemoteLibrary();
    } catch {
      setSubscriptionOverride(subscribed);
    }
  }

  return (
    <Button
      size="small"
      variant={subscribed ? 'text' : 'contained'}
      startIcon={!subscribed ? <AddRoundedIcon sx={{ fontSize: '16px !important' }} /> : undefined}
      disabled={disabled}
      onClick={toggleSubscription}
      sx={{
        height: 30,
        borderRadius: '8px',
        px: subscribed ? 1.5 : 1.4,
        minWidth: 66,
        fontSize: 12.5,
        fontWeight: 600,
        flexShrink: 0,
        ...(subscribed && {
          color: 'text.secondary',
          bgcolor: 'action.hover',
          '&:hover': { bgcolor: 'action.selected', color: 'text.primary' },
        }),
      }}
    >
      {subscribed ? tr('已订阅') : tr('订阅')}
    </Button>
  );
}

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
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [shareAnchor, setShareAnchor] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const showNotice = (text: string) => setNotice({ id: Date.now(), text });
  const base = resolvedBaseUrl(settings);
  const watchUrl = siteEndpointUrl(base, `watch?v=${encodeURIComponent(video.id)}`);
  const token = video.csrfToken ?? remote.data?.csrfToken ?? account?.csrfToken;
  const actionToken = video.csrfToken ?? account?.csrfToken;
  const favorite =
    favoriteOverride ??
    (remote.data?.favorites ?? state.favorites).some((item) => item.videoCode === video.id);
  const defaultSource = downloadSource(video.sources, settings.downloadQuality);

  async function download(source = defaultSource) {
    if (!source) {
      return;
    }
    try {
      const result = await window.electron.downloads.create(video, source, 'default');
      showNotice(
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
    const userId = video.currentUserId ?? account?.id;
    try {
      if (account && actionToken && userId) {
        await api.setFavorite(base, actionToken, userId, video.id, !favorite);
      } else {
        await library.setFavorite(video, !favorite);
      }
      void invalidateRemoteLibrary();
    } catch (cause) {
      setFavoriteOverride(favorite);
      setError(String(cause));
    }
  }

  async function selectPlaylist(id: string) {
    try {
      if (account && token) {
        await api.saveToPlaylist(
          base,
          token,
          id === '__watch_later__' ? 'save' : id,
          video.id,
          true,
        );
      } else if (id === '__watch_later__') {
        await library.setWatchLater(video, true);
      } else {
        await library.saveToPlaylist(video, id);
      }
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
      showNotice(tr('请先登录'));
      return;
    }
    setOpen(true);
  }

  function handleDownloadClick() {
    if (video.sources.length <= 1) {
      void download();
    } else {
      setDownloadOpen(true);
    }
  }

  async function copyShare(text: string) {
    setShareAnchor(null);
    try {
      await navigator.clipboard.writeText(text);
      showNotice(tr('已复制'));
    } catch (cause) {
      setError(String(cause));
    }
  }

  function openInBrowser() {
    setShareAnchor(null);
    void window.electron.openExternal(watchUrl);
  }

  async function createPlaylist() {
    if (!title.trim()) {
      return;
    }
    try {
      if (account && token) {
        await api.createPlaylist(base, token, video.id, title.trim(), description.trim());
      } else {
        await library.createPlaylistWithVideo(video, title.trim(), description.trim());
      }
      void invalidateRemoteLibrary();
      setCreating(false);
      setOpen(false);
    } catch (cause) {
      setError(String(cause));
    }
  }

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 0.5,
        }}
      >
        <ActionTile
          icon={<PlaylistAddIcon fontSize="small" />}
          label={tr('加入片单')}
          onClick={openPlaylists}
        />
        <ActionTile
          icon={
            favorite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />
          }
          label={favorite ? tr('已收藏') : tr('收藏')}
          active={favorite}
          onClick={toggleFavorite}
        />
        <ActionTile
          icon={<DownloadOutlinedIcon fontSize="small" />}
          label={tr('下载')}
          disabled={!video.sources.length}
          onClick={handleDownloadClick}
        />
        <ActionTile
          icon={<ShareOutlinedIcon fontSize="small" />}
          label={tr('分享')}
          onClick={(event) => setShareAnchor(event.currentTarget)}
        />
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Menu
        anchorEl={shareAnchor}
        open={Boolean(shareAnchor)}
        onClose={() => setShareAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mb: 0.75,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: 'divider',
            },
          },
        }}
      >
        <MenuItem dense onClick={() => void copyShare(watchUrl)}>
          <ListItemIcon>
            <LinkRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('复制视频链接')}</ListItemText>
        </MenuItem>
        <MenuItem dense onClick={() => void copyShare(`${video.title}\n${watchUrl}`)}>
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('复制标题和链接')}</ListItemText>
        </MenuItem>
        <MenuItem dense onClick={openInBrowser}>
          <ListItemIcon>
            <OpenInNewRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('在浏览器中打开')}</ListItemText>
        </MenuItem>
      </Menu>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{tr('下载清晰度')}</DialogTitle>
        <DialogContent>
          <List dense>
            {video.sources.map((source) => (
              <ListItemButton key={source.url} onClick={() => download(source)}>
                <ListItemText
                  primary={source.quality}
                  secondary={source.url === defaultSource?.url ? tr('默认清晰度') : undefined}
                />
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
            <Stack spacing={2} sx={{ mt: 2 }}>
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
