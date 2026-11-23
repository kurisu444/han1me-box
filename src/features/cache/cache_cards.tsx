import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import {
  Box,
  Checkbox,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useI18n } from '../../app/i18n';
import { localMediaUrl, type DownloadTask } from '../../domain/models/download';
import { VideoCover } from '../shared/video_card';

export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function ActiveDownloadRow({
  task,
  managing,
  selected,
  onToggle,
  onRetry,
  onDelete,
}: {
  task: DownloadTask;
  managing: boolean;
  selected: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const tr = useI18n();
  const statusLabel = {
    queued: tr('等待下载'),
    downloading: tr('下载中'),
    completed: tr('已完成'),
    failed: tr('失败'),
  }[task.status];

  return (
    <Stack
      direction="row"
      spacing={1.5}
      onClick={managing ? onToggle : undefined}
      sx={{
        alignItems: 'center',
        p: 1.25,
        borderRadius: '10px',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        cursor: managing ? 'pointer' : undefined,
      }}
    >
      {managing && (
        <Checkbox
          size="small"
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onChange={onToggle}
        />
      )}
      <Box
        sx={{
          width: 128,
          flexShrink: 0,
          aspectRatio: '16 / 9',
          borderRadius: '8px',
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        <VideoCover
          url={task.localCoverPath ? localMediaUrl(task.localCoverPath) : (task.coverUrl ?? '')}
          fallbackUrl={task.coverUrl}
          title={task.title}
        />
      </Box>
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap sx={{ fontSize: 13.5, fontWeight: 600 }}>
          {task.title}
        </Typography>
        <Typography
          variant="caption"
          color={task.status === 'failed' ? 'error.light' : 'text.secondary'}
          noWrap
        >
          {[
            task.quality,
            statusLabel,
            task.status === 'downloading'
              ? `${formatBytes(task.speedBytesPerSecond)}/s · ${formatBytes(task.downloadedBytes)}${task.totalBytes > 0 ? ` / ${formatBytes(task.totalBytes)}` : ''}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
        {(task.status === 'queued' || task.status === 'downloading') && (
          <LinearProgress
            variant={task.status === 'queued' ? 'indeterminate' : 'determinate'}
            value={task.progress * 100}
            sx={{ height: 5, borderRadius: 999 }}
          />
        )}
      </Stack>
      {!managing && (
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          {task.status === 'failed' && (
            <Tooltip title={tr('重试')}>
              <IconButton size="small" aria-label={tr('重试')} onClick={onRetry}>
                <ReplayRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={tr('删除')}>
            <IconButton
              size="small"
              aria-label={tr('删除')}
              onClick={onDelete}
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.light' } }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  );
}

export function CachedVideoCard({
  task,
  managing,
  selected,
  onPlay,
  onToggle,
  onOpenMenu,
}: {
  task: DownloadTask;
  managing: boolean;
  selected: boolean;
  onPlay: () => void;
  onToggle: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
}) {
  const tr = useI18n();
  const bytes = task.totalBytes > 0 ? task.totalBytes : task.downloadedBytes;
  const coverBadge = [bytes > 0 ? formatBytes(bytes) : '', task.quality]
    .filter(Boolean)
    .join(' · ');
  const meta = [task.views, task.rating, task.uploadTime].filter(Boolean).join(' · ');

  return (
    <Box
      component="article"
      onClick={managing ? onToggle : undefined}
      sx={{
        minWidth: 0,
        cursor: managing ? 'pointer' : undefined,
        '&:hover .cache-cover img': { transform: 'scale(1.03)' },
        '&:hover .cache-title': { color: 'primary.main' },
      }}
    >
      <Box
        className="cache-cover"
        onClick={!managing ? onPlay : undefined}
        sx={{
          position: 'relative',
          aspectRatio: '16 / 9',
          borderRadius: '10px',
          overflow: 'hidden',
          bgcolor: 'action.hover',
          cursor: 'pointer',
          outline: selected ? '2px solid' : 'none',
          outlineColor: 'primary.main',
          outlineOffset: '-2px',
          '& img': { transition: 'transform 0.2s ease' },
        }}
      >
        <VideoCover
          url={task.localCoverPath ? localMediaUrl(task.localCoverPath) : (task.coverUrl ?? '')}
          fallbackUrl={task.coverUrl}
          title={task.title}
        />
        {managing && (
          <Checkbox
            size="small"
            checked={selected}
            onClick={(event) => event.stopPropagation()}
            onChange={onToggle}
            slotProps={{ input: { 'aria-label': tr('选择 {0}', task.title) } }}
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              zIndex: 2,
              p: 0.25,
              borderRadius: '6px',
              bgcolor: 'rgba(0, 0, 0, 0.55)',
              color: '#fff',
              '&.Mui-checked': { color: 'primary.light' },
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.72)' },
            }}
          />
        )}
        {!managing && task.pinned && (
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '6px',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: 'primary.light',
              pointerEvents: 'none',
            }}
          >
            <PushPinRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
        )}
        {(coverBadge || task.duration) && (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              position: 'absolute',
              inset: 'auto 0 0',
              px: 1,
              pt: 2.25,
              pb: 0.6,
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.78))',
              color: '#fff',
              fontSize: 11,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            <Typography component="span" noWrap sx={{ fontSize: 11, color: 'inherit' }}>
              {coverBadge}
            </Typography>
            {task.duration && (
              <Typography
                component="span"
                sx={{ fontSize: 11, fontWeight: 500, color: 'inherit', flexShrink: 0 }}
              >
                {task.duration}
              </Typography>
            )}
          </Stack>
        )}
      </Box>

      <Stack
        direction="row"
        spacing={0.5}
        sx={{ pt: 0.85, pl: 0.25, alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <Box
          onClick={!managing ? onPlay : undefined}
          sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        >
          <Typography
            className="cache-title"
            component="h3"
            variant="subtitle2"
            title={task.title}
            sx={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.35,
              color: selected ? 'primary.main' : 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              transition: 'color 0.15s ease',
            }}
          >
            {task.title}
          </Typography>
          {meta && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block', mt: 0.3, fontSize: 11.5 }}
            >
              {meta}
            </Typography>
          )}
        </Box>
        {!managing && (
          <IconButton
            size="small"
            aria-label={task.title}
            onClick={(event) => onOpenMenu(event.currentTarget)}
            sx={{
              p: 0.35,
              mt: -0.25,
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <MoreVertIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}
