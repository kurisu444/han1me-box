import { useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { playlist as playlistQuery } from '../../data/han1me_repository';
import * as library from '../../data/local/library_repository';
import { useLibrary } from '../../data/local/library_repository';
import * as api from '../../data/remote/account_api';
import {
  type FollowingVideo,
  type PlaylistSortOrder,
  sortPlaylistVideos,
} from '../../domain/models/library';
import type { VideoCard } from '../../domain/models/video';
import { useAccount } from '../account/account_controller';
import { NoticeToast, type NoticeMessage } from '../shared/notice_toast';
import { RequestError } from '../shared/request_error';
import { VideoGridSkeleton } from '../shared/video_card';
import { useConfirmation } from '../shared/use_confirmation';
import { invalidateRemoteLibrary, useRemotePlaylists } from './library_page';
import { BatchManageBar, LibraryVideoGrid } from './library_video_grid';
import {
  deletePlaylistEntry,
  PlaylistCover,
  PlaylistEditorDialog,
  savePlaylistEntry,
} from './playlist_section';

const iconBtnSx = {
  width: 32,
  height: 32,
  borderRadius: '8px',
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  '&:hover': { color: 'text.primary', borderColor: 'text.secondary', bgcolor: 'action.hover' },
};

export function PlaylistDetailPage() {
  const tr = useI18n();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirmation = useConfirmation();
  const settings = useSettings();
  const local = useLibrary();
  const { account, ready } = useAccount();
  const remotePlaylists = useRemotePlaylists();
  const base = resolvedBaseUrl(settings);

  const [remoteSort, setRemoteSort] = useState('latest');
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const remotePlaylist = useQuery({
    ...playlistQuery(base, id, remoteSort),
    enabled: ready !== false && Boolean(account && id),
  });

  const playlists = remotePlaylists.playlists ?? local.playlists;
  const summary = playlists.find((item) => item.id === id);
  const playlist = account ? (remotePlaylist.data?.playlist ?? summary) : summary;
  const playlistDescription = account ? remotePlaylist.data?.description : playlist?.description;
  const libraryToken = remotePlaylists.csrfToken ?? account?.csrfToken;
  const videos: FollowingVideo[] = playlist
    ? account
      ? (remotePlaylist.data?.videos ?? [])
      : sortPlaylistVideos(playlist.sort, playlist.videos)
    : [];

  const selectionId = (video: FollowingVideo) => (account ? video.playlistItemId : video.videoCode);
  const selectableIds = videos.map(selectionId).filter((val): val is string => Boolean(val));
  const allSelected = selectableIds.length > 0 && selected.length === selectableIds.length;

  function toggle(itemId: string) {
    setSelected((current) =>
      current.includes(itemId) ? current.filter((value) => value !== itemId) : [...current, itemId],
    );
  }

  function reloadRemote() {
    void invalidateRemoteLibrary('playlists');
    void remotePlaylist.refetch();
  }

  async function handleSave(title: string, description: string) {
    if (!playlist) {
      return;
    }
    await savePlaylistEntry({
      base,
      account,
      libraryToken,
      targetId: playlist.id,
      title,
      description,
      onReloadRemote: reloadRemote,
    });
    setEditing(false);
  }

  async function handleDelete() {
    if (!playlist || !(await confirmation.confirm(tr('删除此片单？')))) {
      return;
    }
    await deletePlaylistEntry({
      base,
      account,
      libraryToken,
      targetId: playlist.id,
      onReloadRemote: () => void invalidateRemoteLibrary('playlists'),
    });
    navigate('/library/playlists', { replace: true });
  }

  async function handleShare() {
    if (!playlist) {
      return;
    }
    await navigator.clipboard.writeText(`${base}/playlist?list=${encodeURIComponent(playlist.id)}`);
    setNotice({ id: Date.now(), text: tr('已复制') });
  }

  async function removeSelected() {
    if (!(await confirmation.confirm(tr('删除所选的 {0} 项？', selected.length)))) {
      return;
    }
    const ids = new Set(selected);
    if (account) {
      const token = account.csrfToken ?? libraryToken;
      if (!token) {
        return;
      }
      for (const itemId of ids) {
        await api.removePlaylistItem(base, token, itemId);
      }
      reloadRemote();
    } else {
      await library.removePlaylistVideos(id, ids);
    }
    setSelected([]);
  }

  function playAll() {
    if (!playlist || !videos.length) {
      return;
    }
    const items: VideoCard[] = videos.map((video) => ({
      id: video.videoCode,
      title: video.title,
      coverUrl: video.coverUrl ?? '',
      duration: video.duration,
      views: video.views,
      rating: video.rating,
      artist: video.artistName,
      uploadTime: video.uploadTime,
    }));
    void window.electron.player.open({
      id: videos[0].videoCode,
      queue: { title: playlist.title, items },
    });
  }

  function changeSort(value: string) {
    if (account) {
      setRemoteSort(value);
    } else {
      void library.setPlaylistSort(id, value as PlaylistSortOrder);
    }
  }

  if (account && remotePlaylist.isPending && !playlist) {
    return <VideoGridSkeleton count={10} />;
  }
  if (account && remotePlaylist.error && !playlist) {
    return <RequestError error={remotePlaylist.error} onRetry={remotePlaylist.refetch} />;
  }

  const count = playlist?.count ?? videos.length;
  const coverUrl = playlist?.coverUrl ?? videos[0]?.coverUrl;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Button
          size="small"
          color="inherit"
          component={Link}
          to="/library/playlists"
          startIcon={<ArrowBackRoundedIcon fontSize="small" />}
          sx={{ borderRadius: '8px', color: 'text.secondary', ml: -0.75 }}
        >
          {tr('返回片单列表')}
        </Button>
      </Box>

      {playlist && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2.5}
          sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
        >
          <Box
            sx={(theme) => ({
              width: { xs: '100%', sm: 200 },
              flexShrink: 0,
              aspectRatio: '16 / 9',
              borderRadius: '10px',
              overflow: 'hidden',
              bgcolor: 'action.hover',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 4px 14px rgba(0, 0, 0, 0.35)'
                  : '0 4px 14px rgba(0, 0, 0, 0.1)',
            })}
          >
            <PlaylistCover coverUrl={coverUrl} count={count} title={playlist.title} />
          </Box>

          <Stack
            spacing={1}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: { sm: 112 },
              justifyContent: 'space-between',
            }}
          >
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
                {playlist.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
                {[
                  tr('{0} 个视频', count),
                  remotePlaylist.data?.author,
                  remotePlaylist.data?.viewCount != null
                    ? tr('{0} 次观看', remotePlaylist.data.viewCount)
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
              {playlistDescription && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: 12.5, lineHeight: 1.5 }}
                >
                  {playlistDescription}
                </Typography>
              )}
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                pt: 0.5,
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={playAll}
                  disabled={!videos.length}
                  sx={{ height: 32, px: 1.75, borderRadius: '8px', fontWeight: 600 }}
                >
                  {tr('播放全部')}
                </Button>
                <Tooltip title={tr('编辑片单')}>
                  <IconButton
                    size="small"
                    aria-label={tr('编辑片单')}
                    onClick={() => setEditing(true)}
                    sx={iconBtnSx}
                  >
                    <EditOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
                {account && (
                  <Tooltip title={tr('分享')}>
                    <IconButton
                      size="small"
                      aria-label={tr('分享')}
                      onClick={() => void handleShare()}
                      sx={iconBtnSx}
                    >
                      <ShareOutlinedIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={tr('删除片单')}>
                  <IconButton
                    size="small"
                    aria-label={tr('删除片单')}
                    onClick={() => void handleDelete()}
                    sx={{
                      ...iconBtnSx,
                      color: 'error.light',
                      borderColor: 'rgba(239, 83, 80, 0.35)',
                      '&:hover': {
                        color: 'error.light',
                        bgcolor: 'rgba(239, 83, 80, 0.14)',
                        borderColor: 'rgba(239, 83, 80, 0.55)',
                      },
                    }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {selectableIds.length > 0 && (
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

                <TextField
                  select
                  size="small"
                  aria-label={tr('排序')}
                  value={account ? remoteSort : playlist.sort}
                  onChange={(event) => changeSort(event.target.value)}
                  sx={{
                    minWidth: 108,
                    '& .MuiInputBase-root': { height: 32, fontSize: 13, borderRadius: '8px' },
                  }}
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
                    <MenuItem key={value} value={value} sx={{ fontSize: 13 }}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>
          </Stack>
        </Stack>
      )}

      {account && remotePlaylist.isPending ? (
        <VideoGridSkeleton count={10} />
      ) : account && remotePlaylist.error ? (
        <RequestError error={remotePlaylist.error} onRetry={remotePlaylist.refetch} />
      ) : (
        <LibraryVideoGrid
          videos={videos}
          resetKey={`${id}:${remoteSort}:${playlist?.sort ?? ''}`}
          selectable
          managing={managing}
          selected={selected}
          getSelectionId={selectionId}
          onToggle={toggle}
        />
      )}

      <PlaylistEditorDialog
        open={editing}
        isEdit
        initialTitle={playlist?.title ?? ''}
        initialDescription={playlistDescription ?? ''}
        onClose={() => setEditing(false)}
        onSave={handleSave}
      />

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      {confirmation.dialog}
    </Stack>
  );
}
