import { useEffect, useRef, useState } from 'react';
import ChecklistIcon from '@mui/icons-material/Checklist';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Box, Button, Checkbox, Stack } from '@mui/material';
import { useI18n } from '../../app/i18n';
import type { FollowingVideo } from '../../domain/models/library';
import { VideoCardTile, VideoGrid } from '../shared/video_card';

const VIDEO_BATCH_SIZE = 30;

export function BatchManageBar({
  managing,
  selectedCount,
  allSelected,
  onToggleManaging,
  onToggleAll,
  onRemove,
}: {
  managing: boolean;
  selectedCount: number;
  allSelected: boolean;
  onToggleManaging: () => void;
  onToggleAll: () => void;
  onRemove: () => void;
}) {
  const tr = useI18n();

  return (
    <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center' }}>
      {managing && (
        <>
          <Button
            size="small"
            disabled={selectedCount === 0}
            startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={onRemove}
            sx={{
              height: 32,
              px: 1.5,
              borderRadius: '8px',
              fontSize: 13,
              fontWeight: 600,
              color: 'error.light',
              bgcolor: 'rgba(239, 83, 80, 0.12)',
              border: '1px solid rgba(239, 83, 80, 0.35)',
              '&:hover': {
                bgcolor: 'rgba(239, 83, 80, 0.22)',
                borderColor: 'rgba(239, 83, 80, 0.55)',
              },
              '&.Mui-disabled': {
                color: 'text.disabled',
                bgcolor: 'transparent',
                borderColor: 'divider',
              },
            }}
          >
            {tr('删除所选（')}
            {selectedCount}）
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={onToggleAll}
            sx={{
              height: 32,
              minWidth: 76,
              px: 1.25,
              borderRadius: '8px',
              fontSize: 13,
              color: 'text.secondary',
            }}
          >
            {tr(allSelected ? '取消全选' : '全选')}
          </Button>
        </>
      )}
      <Button
        size="small"
        color={managing ? 'primary' : 'inherit'}
        startIcon={!managing ? <ChecklistIcon fontSize="small" /> : undefined}
        onClick={onToggleManaging}
        sx={{
          height: 32,
          px: managing ? 1.5 : 1.25,
          borderRadius: '8px',
          fontSize: 13,
          fontWeight: managing ? 600 : 500,
          color: managing ? 'primary.main' : 'text.secondary',
          bgcolor: managing ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: managing ? 'action.focus' : 'action.hover' },
        }}
      >
        {tr(managing ? '完成' : '批量管理')}
      </Button>
    </Stack>
  );
}

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
                onSelect={managing && selectable ? () => itemId && onToggle(itemId) : undefined}
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
