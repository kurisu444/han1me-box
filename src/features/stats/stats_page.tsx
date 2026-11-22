import { useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { readWatchState } from '../../data/local/watch_repository';

function dateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function duration(value: number, tr: ReturnType<typeof useI18n>) {
  const seconds = Math.floor(value / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    return tr('{0} 小时 {1} 分钟', Math.floor(minutes / 60), minutes % 60);
  }
  if (minutes > 0) {
    return tr('{0} 分钟', minutes);
  }
  return tr('{0} 秒', seconds);
}

export function StatsPage() {
  const tr = useI18n();
  const watch = useQuery({ queryKey: ['watch-state'], queryFn: readWatchState });
  const [date, setDate] = useState(dateString(new Date()));

  const now = new Date();
  const grouped = new Map<string, number>();

  for (const item of watch.data?.histories ?? []) {
    if (item.date === date) {
      grouped.set(item.title, (grouped.get(item.title) ?? 0) + item.watchedMs);
    }
  }

  const entries = [...grouped].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 820, mx: 'auto' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button component={Link} to="/library" startIcon={<ArrowBackIcon />} size="small">
            {tr('返回')}
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {tr('观看统计')}
          </Typography>
        </Stack>
        <TextField
          type="date"
          size="small"
          label={tr('日期')}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              min: dateString(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
              max: dateString(now),
            },
          }}
          sx={{ width: 170 }}
        />
      </Stack>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              {tr('观看时长：')}
            </Typography>
            <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
              {duration(total, tr)}
            </Typography>
          </Box>
          <Chip label={tr('{0} 个视频', entries.length)} size="small" variant="outlined" />
        </Stack>

        {entries.length > 0 ? (
          <Stack spacing={2}>
            {entries.map(([title, value]) => (
              <Stack key={title} spacing={0.75}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 0 }} noWrap>
                    {title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {duration(value, tr)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={total > 0 ? (value / total) * 100 : 0}
                  sx={{ height: 6, borderRadius: 999 }}
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            {tr('暂无观看记录')}
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
