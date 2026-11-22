import { useI18n } from '../../app/i18n';
import { useState } from 'react';
import {
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { readWatchState } from '../../data/local/watch_repository';
import { useQuery } from '@tanstack/react-query';
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
  return minutes >= 60
    ? tr('{0} 小时 {1} 分钟', Math.floor(minutes / 60), minutes % 60)
    : minutes > 0
      ? tr('{0} 分钟', minutes)
      : tr('{0} 秒', seconds);
}
export function StatsPage() {
  const tr = useI18n();
  const watch = useQuery({ queryKey: ['watch-state'], queryFn: readWatchState });
  const [date, setDate] = useState(dateString(new Date()));

  const now = new Date();
  const grouped = new Map<string, number>();

  for (const item of watch.data?.histories ?? [])
    if (item.date === date)
      grouped.set(item.title, (grouped.get(item.title) ?? 0) + item.watchedMs);

  const entries = [...grouped].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('观看统计')}</Typography>
      <TextField
        type="date"
        label={tr('日期')}
        value={date}
        onChange={(event) => setDate(event.target.value)}
        slotProps={{
          inputLabel: {
            shrink: true,
          },
          htmlInput: {
            min: dateString(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
            max: dateString(now),
          },
        }}
      />
      <Paper
        variant="outlined"
        sx={{
          p: 2,
        }}
      >
        <Typography variant="h6">
          {tr('观看时长：')}
          {duration(total, tr)}
        </Typography>
        <List>
          {entries.map(([title, value]) => (
            <ListItem key={title}>
              <Stack
                sx={{
                  width: '100%',
                }}
              >
                <ListItemText primary={title} secondary={duration(value, tr)} />
                <LinearProgress variant="determinate" value={(value / total) * 100} />
              </Stack>
            </ListItem>
          ))}
        </List>
        {!entries.length && <Typography>{tr('暂无观看记录')}</Typography>}
      </Paper>
    </Stack>
  );
}
