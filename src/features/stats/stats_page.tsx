import { useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
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

function shortDate(iso: string) {
  const parts = iso.split('-');
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : iso;
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

interface DaySummary {
  date: string;
  watchedMs: number;
  count: number;
}

export function StatsPage() {
  const tr = useI18n();
  const watch = useQuery({ queryKey: ['watch-state'], queryFn: readWatchState });
  const today = useMemo(() => dateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);

  const histories = watch.data?.histories ?? [];

  const { days, total30dMs, episodes30d, activeDays30d, avgEpisodeMs } = useMemo(() => {
    const byDate = new Map<string, { watchedMs: number; videos: Set<string> }>();
    for (const item of histories) {
      const bucket = byDate.get(item.date) ?? { watchedMs: 0, videos: new Set<string>() };
      bucket.watchedMs += item.watchedMs;
      bucket.videos.add(item.videoCode || item.title);
      byDate.set(item.date, bucket);
    }

    const now = new Date();
    const list: DaySummary[] = [];
    let totalMs = 0;
    let totalEpisodes = 0;
    let active = 0;
    for (let offset = 29; offset >= 0; offset -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = dateString(d);
      const bucket = byDate.get(key);
      const watchedMs = bucket?.watchedMs ?? 0;
      const count = bucket?.videos.size ?? 0;
      list.push({ date: key, watchedMs, count });
      if (watchedMs > 0) {
        totalMs += watchedMs;
        totalEpisodes += count;
        active += 1;
      }
    }

    return {
      days: list,
      total30dMs: totalMs,
      episodes30d: totalEpisodes,
      activeDays30d: active,
      avgEpisodeMs: totalEpisodes > 0 ? Math.round(totalMs / totalEpisodes) : 0,
    };
  }, [histories]);

  const maxDayMs = Math.max(...days.map((day) => day.watchedMs), 1);

  const dayEntries = useMemo(() => {
    const grouped = new Map<string, { title: string; videoCode: string; watchedMs: number }>();
    for (const item of histories) {
      if (item.date !== selectedDate) {
        continue;
      }
      const key = item.videoCode || item.title;
      const existing = grouped.get(key);
      if (existing) {
        existing.watchedMs += item.watchedMs;
      } else {
        grouped.set(key, {
          title: item.title,
          videoCode: item.videoCode,
          watchedMs: item.watchedMs,
        });
      }
    }
    return [...grouped.values()].sort((a, b) => b.watchedMs - a.watchedMs);
  }, [histories, selectedDate]);

  const dayTotalMs = dayEntries.reduce((sum, item) => sum + item.watchedMs, 0);

  const overviewCards = [
    { label: tr('近 30 天观看时长'), value: duration(total30dMs, tr) },
    { label: tr('已看集数'), value: tr('{0} 个视频', episodes30d) },
    { label: tr('活跃天数'), value: `${activeDays30d} / 30` },
    { label: tr('平均单集'), value: avgEpisodeMs > 0 ? duration(avgEpisodeMs, tr) : '—' },
  ];

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 920, mx: 'auto' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button component={Link} to="/library" startIcon={<ArrowBackIcon />} size="small">
            {tr('返回')}
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {tr('观看统计')}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {tr('最近 30 天')}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 1.5,
          '@media (max-width:760px)': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
        }}
      >
        {overviewCards.map((card) => (
          <Paper key={card.label} variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {card.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mt: 0.75,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
              noWrap
            >
              {card.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {tr('每日观看趋势')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {tr('点击柱条查看当日明细')}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(30, minmax(0, 1fr))',
            gap: '4px',
            alignItems: 'end',
            height: 112,
          }}
        >
          {days.map((day) => {
            const selected = day.date === selectedDate;
            const hasData = day.watchedMs > 0;
            const heightPct = hasData
              ? Math.max(12, Math.round((day.watchedMs / maxDayMs) * 100))
              : 4;
            return (
              <Tooltip
                key={day.date}
                title={`${day.date} · ${hasData ? duration(day.watchedMs, tr) : tr('暂无观看记录')}`}
                placement="top"
                arrow
              >
                <Box
                  component="button"
                  type="button"
                  aria-label={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  sx={{
                    height: '100%',
                    p: 0,
                    border: 0,
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'flex-end',
                    cursor: 'pointer',
                    '&:hover > span': {
                      bgcolor: selected ? 'primary.main' : 'primary.light',
                      opacity: 1,
                    },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      width: '100%',
                      height: `${heightPct}%`,
                      borderRadius: '4px 4px 2px 2px',
                      bgcolor: selected
                        ? 'primary.main'
                        : hasData
                          ? 'primary.main'
                          : 'action.disabledBackground',
                      opacity: selected ? 1 : hasData ? 0.42 : 0.55,
                      transition:
                        'height 200ms ease, opacity 150ms ease, background-color 150ms ease',
                    }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            mt: 1,
            color: 'text.secondary',
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>{shortDate(days[0]?.date ?? '')}</span>
          <span>{shortDate(days[14]?.date ?? '')}</span>
          <span>{shortDate(days[29]?.date ?? '')}</span>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              {selectedDate} · {tr('观看时长：')}
            </Typography>
            <Typography
              variant="h6"
              color="primary"
              sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              {duration(dayTotalMs, tr)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {selectedDate !== today && (
              <Button size="small" onClick={() => setSelectedDate(today)}>
                {tr('今天')}
              </Button>
            )}
            <Chip label={tr('{0} 个视频', dayEntries.length)} size="small" variant="outlined" />
          </Stack>
        </Stack>

        {dayEntries.length > 0 ? (
          <Stack spacing={1.75}>
            {dayEntries.map((item) => (
              <Stack key={item.videoCode || item.title} spacing={0.6}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
                >
                  {item.videoCode ? (
                    <Typography
                      component={Link}
                      to={`/video/${encodeURIComponent(item.videoCode)}`}
                      variant="body2"
                      noWrap
                      sx={{
                        fontWeight: 500,
                        minWidth: 0,
                        color: 'text.primary',
                        textDecoration: 'none',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {item.title}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 0 }} noWrap>
                      {item.title}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {duration(item.watchedMs, tr)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={dayTotalMs > 0 ? (item.watchedMs / dayTotalMs) * 100 : 0}
                  sx={{ height: 5, borderRadius: 999 }}
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {tr('暂无观看记录')}
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
