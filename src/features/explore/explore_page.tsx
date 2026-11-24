import { useEffect, useMemo, useRef, useState } from 'react';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { homeBaseUrl, resolvedBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import { useLibrary } from '../../data/local/library_repository';
import * as api from '../../data/remote/han1me_api';
import { createSearchQuery } from '../../domain/models/search_query';
import type { HomeSection, VideoCard } from '../../domain/models/video';
import { useAccount } from '../account/account_controller';
import { compactSearchGenre } from '../search/search_controller';
import { LoadingIndicator } from '../shared/loading_indicator';
import { RequestError } from '../shared/request_error';
import {
  CompactVideoCard,
  VideoCardTile,
  VideoCover,
  VideoGrid,
  VideoGridSkeleton,
} from '../shared/video_card';
import { homeVideoVisible } from '../video/video_helpers';
import { resolvedExploreChannels, type ExploreChannel } from './explore_channels';
import { ExploreTopBar } from './explore_top_bar';

function HeroCarousel({ videos }: { videos: VideoCard[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = videos.length;
  const activeIndex = count ? index % count : 0;
  const current = videos[activeIndex];

  useEffect(() => {
    if (count <= 1 || paused) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % count);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  function step(delta: number) {
    setIndex((value) => (value + delta + count) % count);
  }

  if (!current) {
    return null;
  }

  return (
    <Box
      component="section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        position: 'relative',
        mb: 3,
        height: { xs: 200, sm: 230, md: 260 },
        borderRadius: '12px',
        overflow: 'hidden',
        bgcolor: 'action.hover',
      }}
    >
      {videos.map((item, slideIndex) => {
        const active = slideIndex === activeIndex;
        const slideMeta = [item.artist, item.views].filter(Boolean).join(' · ');
        return (
          <Box
            key={item.id}
            component={Link}
            to={`/video/${encodeURIComponent(item.id)}`}
            aria-hidden={!active}
            tabIndex={active ? 0 : -1}
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'block',
              width: '100%',
              height: '100%',
              textDecoration: 'none',
              color: '#fff',
              opacity: active ? 1 : 0,
              pointerEvents: active ? 'auto' : 'none',
              transition: 'opacity 320ms ease',
            }}
          >
            <VideoCover url={item.coverUrl} title={item.title} eager />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to top, rgba(0, 0, 0, 0.84) 0%, rgba(0, 0, 0, 0.25) 48%, transparent 100%)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: { xs: 16, sm: 24 },
                right: { xs: 16, sm: 200 },
                bottom: { xs: 14, sm: 20 },
              }}
            >
              <Typography
                variant="h5"
                noWrap
                sx={{
                  fontWeight: 800,
                  fontStyle: 'italic',
                  fontSize: { xs: '1.1rem', sm: '1.35rem' },
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.6)',
                }}
              >
                {item.title}
              </Typography>
              {slideMeta && (
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    mt: 0.4,
                    color: 'rgba(255, 255, 255, 0.82)',
                    fontSize: 13,
                  }}
                >
                  {slideMeta}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
      {count > 1 && (
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            alignItems: 'center',
          }}
        >
          <Stack direction="row" spacing={0.6} sx={{ alignItems: 'center' }}>
            {videos.map((item, dotIndex) => {
              const selected = dotIndex === activeIndex;
              return (
                <Box
                  key={item.id}
                  component="button"
                  type="button"
                  aria-label={item.title}
                  onClick={() => setIndex(dotIndex)}
                  sx={{
                    width: selected ? 18 : 6,
                    height: 6,
                    p: 0,
                    border: 0,
                    borderRadius: 999,
                    cursor: 'pointer',
                    bgcolor: selected ? 'primary.main' : 'rgba(255, 255, 255, 0.45)',
                    transition: 'width 0.2s ease, background-color 0.2s ease',
                  }}
                />
              );
            })}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              aria-label="Previous"
              onClick={() => step(-1)}
              sx={{
                width: 28,
                height: 28,
                bgcolor: 'rgba(0, 0, 0, 0.45)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.72)' },
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Next"
              onClick={() => step(1)}
              sx={{
                width: 28,
                height: 28,
                bgcolor: 'rgba(0, 0, 0, 0.45)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.72)' },
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

export function ExplorePage() {
  const tr = useI18n();
  const settings = useSettings();
  const baseUrl = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const homeUrl = useMemo(() => homeBaseUrl(settings), [settings]);
  const { account, ready } = useAccount();
  const library = useLibrary();
  const visibleChannels = useMemo(() => resolvedExploreChannels(settings), [settings]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const channel =
    visibleChannels.find((item) => item.id === selectedChannelId) ?? visibleChannels[0];
  const [showBackTop, setShowBackTop] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const homeQuery = useQuery({
    ...repository.home(homeUrl, account?.id),
    enabled: ready !== false && settings.showHomeFeatured,
  });

  const feedQuery = useInfiniteQuery({
    queryKey: ['han1me', 'explore-feed', baseUrl, channel.id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.search(
        baseUrl,
        createSearchQuery({
          sort: channel.sort,
          genre: channel.genre,
          page: pageParam,
        }),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: ready !== false,
  });

  useEffect(() => {
    const container = document.getElementById('app-scroll-container');
    if (!container) {
      return;
    }
    const handleScroll = () => setShowBackTop(container.scrollTop > 300);
    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !feedQuery.hasNextPage || feedQuery.isFetchingNextPage) {
      return;
    }
    const root = document.getElementById('app-scroll-container');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void feedQuery.fetchNextPage();
        }
      },
      { root, rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feedQuery.hasNextPage, feedQuery.isFetchingNextPage, feedQuery.fetchNextPage]);

  const subscribed = useMemo(
    () => new Set(library.artists.map((artist) => artist.name.trim().toLowerCase())),
    [library.artists],
  );

  const videos = useMemo(() => {
    const seen = new Set<string>();
    const list: VideoCard[] = [];
    for (const page of feedQuery.data?.pages ?? []) {
      for (const item of page.items) {
        if (item.id && !seen.has(item.id) && homeVideoVisible(item, settings, subscribed)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }
    return list;
  }, [feedQuery.data, settings, subscribed]);

  const heroVideos = useMemo(() => {
    if (!settings.showHomeFeatured) {
      return [];
    }
    const seen = new Set<string>();
    const candidates = [homeQuery.data?.featured, ...videos];
    const result: VideoCard[] = [];
    for (const item of candidates) {
      if (item?.id && item.coverUrl && !seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
        if (result.length >= 5) {
          break;
        }
      }
    }
    return result;
  }, [settings.showHomeFeatured, homeQuery.data?.featured, videos]);

  const compact = settings.useCompactSearchCards && compactSearchGenre(channel.genre);
  const refreshing = feedQuery.isRefetching && !feedQuery.isFetchingNextPage;

  function scrollToTop(behavior: ScrollBehavior = 'smooth') {
    document.getElementById('app-scroll-container')?.scrollTo({ top: 0, behavior });
  }

  function selectChannel(next: ExploreChannel) {
    setSelectedChannelId(next.id);
    scrollToTop('auto');
  }

  function refreshFeed() {
    scrollToTop('smooth');
    void feedQuery.refetch();
    if (settings.showHomeFeatured) {
      void homeQuery.refetch();
    }
  }

  return (
    <>
      <ExploreTopBar
        channels={visibleChannels}
        activeChannelId={channel.id}
        onSelectChannel={selectChannel}
      />
      {heroVideos.length > 0 ? (
        <HeroCarousel key={heroVideos[0]?.id} videos={heroVideos} />
      ) : (
        settings.showHomeFeatured &&
        (homeQuery.isPending || feedQuery.isPending) && (
          <Skeleton
            variant="rounded"
            animation="wave"
            sx={{
              mb: 3,
              height: { xs: 200, sm: 230, md: 260 },
              borderRadius: '12px',
            }}
          />
        )
      )}
      {feedQuery.isPending && !videos.length && (
        <VideoGridSkeleton layout={compact ? 'compact' : 'grid'} />
      )}
      {feedQuery.isError && !videos.length && (
        <RequestError error={feedQuery.error} onRetry={() => void feedQuery.refetch()} />
      )}
      {videos.length > 0 && (
        <VideoGrid layout={compact ? 'compact' : 'grid'}>
          {videos.map((video) =>
            compact ? (
              <CompactVideoCard key={video.id} video={video} vertical />
            ) : (
              <VideoCardTile key={video.id} video={video} />
            ),
          )}
        </VideoGrid>
      )}
      {!feedQuery.isPending && !feedQuery.isError && videos.length === 0 && (
        <Alert severity="info" action={<Button onClick={refreshFeed}>{tr('重新加载')}</Button>}>
          {tr('暂无可显示的视频：页面暂无内容，或当前内容被过滤。')}
        </Alert>
      )}
      <Box ref={loadMoreRef} sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
        {feedQuery.isFetchingNextPage && (
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'center', color: 'text.secondary' }}
          >
            <LoadingIndicator size="sm" />
            <Typography variant="body2">{tr('正在加载更多…')}</Typography>
          </Stack>
        )}
        {feedQuery.isFetchNextPageError && (
          <Button variant="outlined" size="small" onClick={() => void feedQuery.fetchNextPage()}>
            {tr('重试')}
          </Button>
        )}
        {!feedQuery.hasNextPage && videos.length > 0 && !feedQuery.isFetchingNextPage && (
          <Typography variant="caption" color="text.secondary">
            {tr('已经到底了')}
          </Typography>
        )}
      </Box>
      <Stack
        spacing={1}
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1100,
        }}
      >
        <Tooltip title={tr('刷新')} placement="left">
          <Paper
            elevation={4}
            sx={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <ButtonBase
              aria-label={tr('刷新')}
              disabled={ready === false || refreshing}
              onClick={refreshFeed}
              sx={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <RefreshIcon
                fontSize="small"
                sx={{
                  animation: refreshing ? 'spin 0.9s linear infinite' : undefined,
                  '@keyframes spin': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </ButtonBase>
          </Paper>
        </Tooltip>
        <Tooltip title={tr('返回顶部')} placement="left">
          <Paper
            elevation={4}
            aria-hidden={!showBackTop}
            sx={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              opacity: showBackTop ? 1 : 0,
              visibility: showBackTop ? 'visible' : 'hidden',
              pointerEvents: showBackTop ? 'auto' : 'none',
              transition: 'opacity 0.18s ease, visibility 0.18s ease',
            }}
          >
            <ButtonBase
              aria-label={tr('返回顶部')}
              tabIndex={showBackTop ? 0 : -1}
              onClick={() => scrollToTop('smooth')}
              sx={{
                width: 44,
                py: 0.75,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.15,
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ArrowUpwardIcon sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: 10.5, lineHeight: 1.2 }}>
                {tr('顶部')}
              </Typography>
            </ButtonBase>
          </Paper>
        </Tooltip>
      </Stack>
    </>
  );
}

export function homeSectionKey(section: HomeSection): string {
  const parameters = URL.parse(section.moreUrl ?? '', 'https://site.invalid')?.searchParams;
  const value = parameters?.get('genre') ?? parameters?.get('sort') ?? parameters?.get('query');
  return value || section.title;
}

export function applyHomeSectionLayout(
  sections: HomeSection[],
  order: string[],
  hidden: string[],
): HomeSection[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  return sections
    .filter((section) => !hidden.includes(homeSectionKey(section)))
    .sort(
      (left, right) =>
        (rank.get(homeSectionKey(left)) ?? order.length) -
        (rank.get(homeSectionKey(right)) ?? order.length),
    );
}
