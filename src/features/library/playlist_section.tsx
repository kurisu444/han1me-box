import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import * as library from '../../data/local/library_repository';
import * as api from '../../data/remote/account_api';
import type { Account } from '../../domain/models/account';
import type { FollowingVideo, Playlist, PlaylistSortOrder } from '../../domain/models/library';
import { LoadingState, RequestError } from '../shared/request_error';
import { cardGridSx, VideoCover } from '../shared/video_card';

interface PlaylistSectionProps {
  base: string;
  account?: Account;
  libraryToken?: string;
  playlists: Playlist[];
  playlist?: Playlist;
  playlistId: string;
  playlistDescription?: string;
  remoteAuthor?: string;
  remoteViewCount?: number;
  remotePending: boolean;
  remoteError: Error | null;
  onRetryRemote: () => void;
  remoteSort: string;
  onChangeSort: (value: string) => void;
  videos: FollowingVideo[];
  onOpenPlaylist: (id: string) => void;
  onReloadRemote: () => void;
  confirm: (message: string) => Promise<boolean>;
}

export function PlaylistSection({
  base,
  account,
  libraryToken,
  playlists,
  playlist,
  playlistId,
  playlistDescription,
  remoteAuthor,
  remoteViewCount,
  remotePending,
  remoteError,
  onRetryRemote,
  remoteSort,
  onChangeSort,
  videos,
  onOpenPlaylist,
  onReloadRemote,
  confirm,
}: PlaylistSectionProps) {
  const tr = useI18n();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function openEditor() {
    setTitle(playlist?.title ?? '');
    setDescription(playlistDescription ?? '');
    setEditing(true);
  }

  async function savePlaylist() {
    if (!title.trim()) {
      return;
    }
    if (account) {
      const token = playlist ? account.csrfToken : libraryToken;
      if (!token) {
        return;
      }
      if (playlist) {
        await api.updatePlaylist(base, token, playlist.id, title.trim(), description.trim());
      } else {
        await api.createPlaylist(base, token, '', title.trim(), description.trim());
      }
      onReloadRemote();
    } else if (playlist) {
      await library.updatePlaylist(playlist.id, title, description);
    } else {
      await library.createPlaylist(title.trim(), description.trim());
    }
    setEditing(false);
  }

  async function deletePlaylist() {
    if (!(await confirm(tr('删除此片单？')))) {
      return;
    }
    if (account) {
      if (!account.csrfToken) {
        return;
      }
      await api.deletePlaylist(base, account.csrfToken, playlistId);
      onReloadRemote();
    } else {
      await library.deletePlaylist(playlistId);
    }
    onOpenPlaylist('');
  }

  async function sharePlaylist() {
    const url = `${base}/playlist?list=${playlistId}`;
    if (navigator.share) {
      await navigator.share({ title: playlist?.title, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  function changeSort(value: string) {
    if (account) {
      onChangeSort(value);
    } else {
      void library.setPlaylistSort(playlistId, value as PlaylistSortOrder);
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {playlist && (
          <Button size="small" onClick={() => onOpenPlaylist('')}>
            {tr('返回片单列表')}
          </Button>
        )}
        <Button size="small" variant="outlined" onClick={openEditor}>
          {playlist ? tr('编辑片单') : tr('新建片单')}
        </Button>
        {playlist && (
          <Button size="small" color="error" onClick={deletePlaylist}>
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
            sx={{ minWidth: 120 }}
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

      {!playlist && (
        <Box sx={cardGridSx}>
          {playlists.map((item) => (
            <Card key={item.id}>
              <CardActionArea onClick={() => onOpenPlaylist(item.id)} sx={{ p: 2 }}>
                <Box sx={{ aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', mb: 1 }}>
                  <VideoCover url={item.coverUrl ?? ''} title={item.title} />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                  {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.count}
                  {tr('个视频')}
                </Typography>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      {playlist && (
        <Stack spacing={1}>
          {playlist.coverUrl && (
            <Box
              sx={{ maxWidth: 600, aspectRatio: '16/9', borderRadius: '10px', overflow: 'hidden' }}
            >
              <VideoCover url={playlist.coverUrl} title={playlist.title} />
            </Box>
          )}
          <Typography variant="h6">{playlist.title}</Typography>
          {playlistDescription && <Typography>{playlistDescription}</Typography>}
          {remoteAuthor && <Typography color="text.secondary">{remoteAuthor}</Typography>}
          <Typography variant="body2" color="text.secondary">
            {tr('{0} 个视频', playlist.count)}{' '}
            {remoteViewCount != null && tr('{0} 次观看', remoteViewCount)}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              component={Link}
              to={`/video/${videos[0]?.videoCode ?? ''}`}
              disabled={!videos.length}
            >
              {tr('播放全部')}
            </Button>
            {account && (
              <Button size="small" variant="outlined" onClick={sharePlaylist}>
                {tr('分享')}
              </Button>
            )}
          </Stack>
        </Stack>
      )}

      {playlist && remotePending && account && <LoadingState label={tr('正在加载片单…')} />}
      {playlist && remoteError && <RequestError error={remoteError} onRetry={onRetryRemote} />}

      <Dialog open={editing} onClose={() => setEditing(false)} fullWidth maxWidth="xs">
        <DialogTitle>{playlist ? tr('编辑片单') : tr('新建片单')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={tr('名称')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              label={tr('简介')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(false)}>{tr('取消')}</Button>
          <Button variant="contained" onClick={savePlaylist}>
            {tr('保存')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
