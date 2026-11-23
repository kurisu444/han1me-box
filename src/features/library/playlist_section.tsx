import { useEffect, useState } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlaylistPlayRoundedIcon from '@mui/icons-material/PlaylistPlayRounded';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import * as library from '../../data/local/library_repository';
import * as api from '../../data/remote/account_api';
import type { Account } from '../../domain/models/account';
import type { Playlist } from '../../domain/models/library';
import { NoticeToast, type NoticeMessage } from '../shared/notice_toast';
import { VideoCover, VideoGrid } from '../shared/video_card';

export async function savePlaylistEntry({
  base,
  account,
  libraryToken,
  targetId,
  title,
  description,
  onReloadRemote,
}: {
  base: string;
  account?: Account;
  libraryToken?: string;
  targetId?: string;
  title: string;
  description: string;
  onReloadRemote: () => void;
}) {
  if (account) {
    const token = targetId ? (account.csrfToken ?? libraryToken) : libraryToken;
    if (!token) {
      return;
    }
    if (targetId) {
      await api.updatePlaylist(base, token, targetId, title, description);
    } else {
      await api.createPlaylist(base, token, '', title, description);
    }
    onReloadRemote();
  } else if (targetId) {
    await library.updatePlaylist(targetId, title, description);
  } else {
    await library.createPlaylist(title, description);
  }
}

export async function deletePlaylistEntry({
  base,
  account,
  libraryToken,
  targetId,
  onReloadRemote,
}: {
  base: string;
  account?: Account;
  libraryToken?: string;
  targetId: string;
  onReloadRemote: () => void;
}) {
  if (account) {
    const token = account.csrfToken ?? libraryToken;
    if (!token) {
      return;
    }
    await api.deletePlaylist(base, token, targetId);
    onReloadRemote();
  } else {
    await library.deletePlaylist(targetId);
  }
}

export function PlaylistCover({
  coverUrl,
  count,
  title,
}: {
  coverUrl?: string;
  count: number;
  title: string;
}) {
  if (count === 0 || !coverUrl) {
    return (
      <Stack
        sx={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          color: 'text.disabled',
        }}
      >
        <PlaylistPlayRoundedIcon sx={{ fontSize: 40 }} />
      </Stack>
    );
  }
  return <VideoCover key={coverUrl} url={coverUrl} title={title} />;
}

export function PlaylistEditorDialog({
  open,
  isEdit,
  initialTitle,
  initialDescription,
  onClose,
  onSave,
}: {
  open: boolean;
  isEdit: boolean;
  initialTitle: string;
  initialDescription: string;
  onClose: () => void;
  onSave: (title: string, description: string) => Promise<void>;
}) {
  const tr = useI18n();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription);
    }
  }, [open, initialTitle, initialDescription]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isEdit ? tr('编辑片单') : tr('新建片单')}</DialogTitle>
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
        <Button onClick={onClose}>{tr('取消')}</Button>
        <Button
          variant="contained"
          disabled={!title.trim()}
          onClick={() => void onSave(title.trim(), description.trim())}
        >
          {tr('保存')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PlaylistSection({
  base,
  account,
  libraryToken,
  playlists,
  onReloadRemote,
  confirm,
  createOpen = false,
  onCloseCreate,
}: {
  base: string;
  account?: Account;
  libraryToken?: string;
  playlists: Playlist[];
  onReloadRemote: () => void;
  confirm: (message: string) => Promise<boolean>;
  createOpen?: boolean;
  onCloseCreate?: () => void;
}) {
  const tr = useI18n();
  const navigate = useNavigate();
  const [editingTarget, setEditingTarget] = useState<Playlist | 'new' | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; item: Playlist } | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  useEffect(() => {
    if (createOpen) {
      setEditingTarget('new');
      onCloseCreate?.();
    }
  }, [createOpen, onCloseCreate]);

  async function handleSave(title: string, description: string) {
    if (!editingTarget) {
      return;
    }
    await savePlaylistEntry({
      base,
      account,
      libraryToken,
      targetId: editingTarget === 'new' ? undefined : editingTarget.id,
      title,
      description,
      onReloadRemote,
    });
    setEditingTarget(null);
  }

  async function handleDelete(targetId: string) {
    setMenu(null);
    if (!(await confirm(tr('删除此片单？')))) {
      return;
    }
    await deletePlaylistEntry({ base, account, libraryToken, targetId, onReloadRemote });
  }

  async function handleShare(target: Playlist) {
    setMenu(null);
    await navigator.clipboard.writeText(`${base}/playlist?list=${encodeURIComponent(target.id)}`);
    setNotice({ id: Date.now(), text: tr('已复制') });
  }

  const openPlaylist = (id: string) => navigate(`/library/playlist/${encodeURIComponent(id)}`);
  const editingItem = editingTarget && editingTarget !== 'new' ? editingTarget : undefined;

  return (
    <>
      <VideoGrid>
        {playlists.map((item) => (
          <Box
            key={item.id}
            component="article"
            sx={{
              minWidth: 0,
              '&:hover .playlist-cover img': { transform: 'scale(1.03)' },
              '&:hover .playlist-title': { color: 'primary.main' },
            }}
          >
            <Box
              onClick={() => openPlaylist(item.id)}
              sx={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <Box
                className="playlist-cover"
                sx={{
                  position: 'relative',
                  aspectRatio: '16 / 9',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  '& img': { transition: 'transform 0.2s ease' },
                }}
              >
                <PlaylistCover coverUrl={item.coverUrl} count={item.count} title={item.title} />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 'auto 0 0',
                    px: 1,
                    pt: 2.25,
                    pb: 0.6,
                    background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.78))',
                    color: '#fff',
                    fontSize: 11.5,
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}
                >
                  {tr('{0} 个视频', item.count)}
                </Box>
              </Box>
            </Box>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ pt: 0.85, pl: 0.25, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography
                className="playlist-title"
                variant="subtitle2"
                noWrap
                title={item.title}
                onClick={() => openPlaylist(item.id)}
                sx={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0,
                  transition: 'color 0.15s ease',
                }}
              >
                {item.title}
              </Typography>
              <IconButton
                size="small"
                aria-label={item.title}
                onClick={(event) => setMenu({ anchor: event.currentTarget, item })}
                sx={{ p: 0.35, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          </Box>
        ))}
      </VideoGrid>

      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        slotProps={{
          paper: { sx: { borderRadius: '10px', border: '1px solid', borderColor: 'divider' } },
        }}
      >
        <MenuItem
          dense
          onClick={() => {
            if (menu) {
              setEditingTarget(menu.item);
              setMenu(null);
            }
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('编辑片单')}</ListItemText>
        </MenuItem>
        {account && (
          <MenuItem dense onClick={() => menu && void handleShare(menu.item)}>
            <ListItemIcon>
              <ShareOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{tr('分享')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          dense
          onClick={() => menu && void handleDelete(menu.item.id)}
          sx={{ color: 'error.light' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('删除片单')}</ListItemText>
        </MenuItem>
      </Menu>

      <PlaylistEditorDialog
        open={editingTarget !== null}
        isEdit={Boolean(editingItem)}
        initialTitle={editingItem?.title ?? ''}
        initialDescription={editingItem?.description ?? ''}
        onClose={() => setEditingTarget(null)}
        onSave={handleSave}
      />

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}
