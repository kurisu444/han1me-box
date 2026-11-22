import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import type { WatchState } from '../../data/local/watch_repository';
import type { FollowingVideo } from '../../domain/models/library';
import { VideoCardTile, VideoGrid } from '../shared/video_card';

const VIDEO_BATCH_SIZE = 30;

interface LibraryVideoGridProps {
  videos: FollowingVideo[];
  resetKey: string;
  selectable: boolean;
  managing: boolean;
  selected: string[];
  getSelectionId: (video: FollowingVideo) => string | undefined;
  onToggle: (id: string) => void;
}

export function LibraryVideoGrid({
  videos,
  resetKey,
  selectable,
  managing,
  selected,
  getSelectionId,
  onToggle,
}: LibraryVideoGridProps) {
  const tr = useI18n();
  const [visibleCount, setVisibleCount] = useState(VIDEO_BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 切换标签、片单或作者时重置分批数量
  useEffect(() => {
    setVisibleCount(VIDEO_BATCH_SIZE);
  }, [resetKey]);

  const visibleVideos = videos.slice(0, visibleCount);
  const hasMore = visibleCount < videos.length;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + VIDEO_BATCH_SIZE);
        }
      },
      {
        root: document.getElementById('app-scroll-container'),
        rootMargin: '400px',
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <>
      <VideoGrid>
        {visibleVideos.map((video, index) => {
          const itemId = getSelectionId(video);
          const isChecked = !!itemId && selected.includes(itemId);
          return (
            <Box key={`${video.videoCode}-${index}`} sx={{ position: 'relative' }}>
              {managing && selectable && (
                <Checkbox
                  size="small"
                  checked={isChecked}
                  disabled={!itemId}
                  onChange={() => itemId && onToggle(itemId)}
                  slotProps={{ input: { 'aria-label': tr('选择 {0}', video.title) } }}
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
              <VideoCardTile
                selected={managing && isChecked}
                onSelect={managing && itemId ? () => onToggle(itemId) : undefined}
                video={{
                  ...video,
                  id: video.videoCode,
                  coverUrl: video.coverUrl ?? '',
                  artist: video.artistName,
                }}
              />
            </Box>
          );
        })}
      </VideoGrid>
      {hasMore && (
        <Box ref={loadMoreRef} sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={() => setVisibleCount((count) => count + VIDEO_BATCH_SIZE)}
            sx={{ color: 'text.secondary' }}
          >
            {tr('加载更多')}（{visibleVideos.length} / {videos.length}）
          </Button>
        </Box>
      )}
    </>
  );
}

interface LocalHistoryListProps {
  history?: WatchState;
  managing: boolean;
  selected: string[];
  onToggle: (id: string) => void;
}

export function LocalHistoryList({ history, managing, selected, onToggle }: LocalHistoryListProps) {
  const tr = useI18n();

  return (
    <>
      <Typography variant="h6">{tr('继续观看')}</Typography>
      <List>
        {history?.continueItems.map((item) => (
          <ListItem
            key={item.videoCode}
            component={Link}
            to={`/video/${encodeURIComponent(item.videoCode)}`}
          >
            <Avatar src={item.coverUrl} variant="rounded" sx={{ mr: 2 }} />
            <ListItemText
              primary={item.title}
              secondary={`${Math.floor(item.positionMs / 1000)} / ${tr('{0} 秒', Math.floor(item.durationMs / 1000))}`}
            />
          </ListItem>
        ))}
      </List>
      <Typography variant="h6">{tr('观看历史')}</Typography>
      <List>
        {[...(history?.histories ?? [])].reverse().map((item) => (
          <ListItem key={item.id}>
            {managing && (
              <Checkbox checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            )}
            <ListItemText
              primary={
                <Link to={`/video/${encodeURIComponent(item.videoCode)}`}>{item.title}</Link>
              }
              secondary={tr('{0} · {1} 秒', item.date, Math.round(item.watchedMs / 1000))}
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}
