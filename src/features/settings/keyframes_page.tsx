import { useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import * as repository from '../../data/local/keyframe_repository';
import { LoadingState, RequestError } from '../shared/request_error';
import { useConfirmation } from '../shared/use_confirmation';

function formatKeyframeTime(positionMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(positionMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function KeyframesPage() {
  const tr = useI18n();
  const resource = useQuery({ queryKey: ['keyframe-videos'], queryFn: repository.loadVideos });
  const confirmation = useConfirmation();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<{
    video: repository.KeyframeVideo;
    position?: number;
  }>();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function edit(video: repository.KeyframeVideo, position?: number) {
    setEditing({
      video,
      position,
    });
    setEditOpen(true);
    setValue(position === undefined ? video.title : String(position / 1000));
    setError('');
  }

  async function save() {
    if (!editing) {
      return;
    }
    const { video, position } = editing;
    if (!value.trim()) {
      return;
    }
    if (position !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      return;
    }
    const changed =
      position === undefined
        ? await repository.setTitle(video.id, value.trim())
        : await repository.updatePosition(video.id, position, Math.round(Number(value) * 1000));
    if (!changed) {
      setError(tr('时间无效，或与其他关键帧相隔不足 10 秒'));
      return;
    }
    setEditOpen(false);
    void resource.refetch();
  }

  async function remove(id: string, position?: number) {
    if (position === undefined) {
      if (!(await confirmation.confirm(tr('删除此视频的全部关键帧？')))) {
        return;
      }
      await repository.deleteVideo(id);
    } else {
      if (
        !(await confirmation.confirm(tr('删除 {0} 处的关键帧？', formatKeyframeTime(position))))
      ) {
        return;
      }
      if (
        !(await confirmation.confirm(tr('删除 {0} 处的关键帧？', formatKeyframeTime(position))))
      ) {
        return;
      }
      await repository.remove(id, position);
    }
    void resource.refetch();
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 760, width: '100%', mx: 'auto' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Tooltip title={tr('返回')}>
          <IconButton component={Link} to="/settings" size="small" aria-label={tr('返回')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {tr('关键帧')}
        </Typography>
      </Stack>
      {resource.isPending && <LoadingState label={tr('正在加载…')} />}
      {resource.error && <RequestError error={resource.error} onRetry={resource.refetch} />}
      {resource.data?.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
          {tr('暂无关键帧')}
        </Typography>
      )}
      {resource.data?.map((video) => (
        <Paper
          key={video.id}
          variant="outlined"
          sx={{
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.25,
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Typography
                component={Link}
                to={`/video/${video.id}`}
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  textDecoration: 'none',
                  minWidth: 0,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {video.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
              >
                {video.positions.length}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
              <Tooltip title={tr('修改标题')}>
                <IconButton
                  size="small"
                  aria-label={tr('修改标题')}
                  onClick={() => edit(video)}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={tr('删除视频关键帧')}>
                <IconButton
                  size="small"
                  aria-label={tr('删除视频关键帧')}
                  onClick={() => remove(video.id)}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          <Divider />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, py: 1.5 }}>
            {video.positions.map((position) => (
              <Box
                key={position}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '8px',
                  bgcolor: 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                  overflow: 'hidden',
                  transition: 'border-color 140ms ease',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Tooltip title={tr('编辑时间')}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => edit(video, position)}
                    sx={{
                      border: 0,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      cursor: 'pointer',
                      px: 1.25,
                      py: 0.5,
                      font: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.4,
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {formatKeyframeTime(position)}
                  </Box>
                </Tooltip>
                <Tooltip title={tr('删除')}>
                  <IconButton
                    size="small"
                    aria-label={tr('删除')}
                    onClick={() => remove(video.id, position)}
                    sx={{
                      width: 24,
                      height: 24,
                      mr: 0.35,
                      color: 'text.secondary',
                      '&:hover': { color: 'error.main', bgcolor: 'transparent' },
                    }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </Paper>
      ))}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{tr('编辑关键帧')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <TextField
              fullWidth
              value={value}
              type={editing?.position === undefined ? 'text' : 'number'}
              label={editing?.position === undefined ? tr('标题') : tr('时间（秒）')}
              onChange={(event) => setValue(event.target.value)}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="small" color="inherit" onClick={() => setEditOpen(false)}>
            {tr('取消')}
          </Button>
          <Button size="small" variant="contained" onClick={save}>
            {tr('保存')}
          </Button>
        </DialogActions>
      </Dialog>
      {confirmation.dialog}
    </Stack>
  );
}
