import { useMemo } from 'react';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { defaultHomeSectionOrder, homeBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import { useLibrary } from '../../data/local/library_repository';
import { localize, searchLocale, searchOptionCatalog } from '../../data/search_option_catalog';
import type { HomeSection, VideoCard } from '../../domain/models/video';
import { useAccount } from '../account/account_controller';
import { LoadingState, RequestError } from '../shared/request_error';
import { VideoCardTile, VideoCover, VideoGrid } from '../shared/video_card';
import { homeVideoVisible } from '../video/video_helpers';

const HOME_SECTION_VIDEO_LIMIT = 10;

export function ExplorePage() {
  const tr = useI18n();
  const settings = useSettings();
  const baseUrl = useMemo(() => homeBaseUrl(settings), [settings]);
  const { account, ready } = useAccount();
  const library = useLibrary();
  const {
    data: feed,
    error,
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    ...repository.home(baseUrl, account?.id),
    enabled: ready !== false,
  });

  const subscribed = new Set(library.artists.map((artist) => artist.name.trim().toLowerCase()));
  const locale = searchLocale(settings.language, navigator.language);
  const sections = applyHomeSectionLayout(
    (feed?.sections ?? []).map((section) => ({
      ...section,
      videos: section.videos.filter((video) => homeVideoVisible(video, settings, subscribed)),
    })),
    settings.homeSectionOrder.length ? settings.homeSectionOrder : [...defaultHomeSectionOrder],
    settings.hiddenHomeSections,
  ).filter((section) => section.videos.length);
  const featured = settings.showHomeFeatured ? feed?.featured : undefined;

  function sectionTitle(title: string, moreUrl?: string) {
    const parameters = URL.parse(moreUrl ?? '', 'https://site.invalid')?.searchParams;
    return (
      localize(searchOptionCatalog.genres, parameters?.get('genre') ?? '', locale) ??
      localize(searchOptionCatalog.sorts, parameters?.get('sort') ?? '', locale) ??
      localize(searchOptionCatalog.genres, title, locale) ??
      localize(searchOptionCatalog.sorts, title, locale) ??
      title
    );
  }

  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1.5 }}>
        <Button
          size="small"
          variant="text"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          disabled={ready === false || isFetching}
        >
          {isFetching ? tr('刷新中…') : tr('刷新')}
        </Button>
      </Stack>
      {error && <RequestError error={error} onRetry={refetch} />}
      {error && feed && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
          }}
        >
          {tr('当前显示上次缓存的内容。')}
        </Alert>
      )}
      {isPending && !feed && <LoadingState label={tr('正在加载首页…')} />}
      {featured && <FeaturedBanner video={featured} />}
      {sections.map((section, index) => (
        <Box
          component="section"
          key={`${homeSectionKey(section)}-${index}`}
          sx={{
            my: 4,
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography component="h2" variant="h6">
              {sectionTitle(section.title, section.moreUrl)}
            </Typography>
            {section.moreUrl ? (
              <Button
                component={Link}
                to={`/search${URL.parse(section.moreUrl, baseUrl)?.search ?? ''}`}
                endIcon={<ArrowForwardIcon />}
              >
                {tr('更多')}
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {section.videos.length}
                {tr('部视频')}
              </Typography>
            )}
          </Stack>
          <VideoGrid layout="grid">
            {section.videos.slice(0, HOME_SECTION_VIDEO_LIMIT).map((video, videoIndex) => (
              <VideoCardTile key={`${video.id}-${videoIndex}`} video={video} />
            ))}
          </VideoGrid>
        </Box>
      ))}
      {!isPending && !error && !featured && sections.length === 0 && (
        <Alert severity="info" action={<Button onClick={() => refetch()}>{tr('重新加载')}</Button>}>
          {tr('暂无可显示的视频：页面暂无内容，或当前内容被过滤。')}
        </Alert>
      )}
    </>
  );
}

function FeaturedBanner({ video }: { video: VideoCard }) {
  const tr = useI18n();

  return (
    <Card
      component="section"
      sx={{
        mb: 4,
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        '@media (max-width:620px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
      }}
    >
      <Box sx={{ aspectRatio: '16 / 9', minWidth: 0 }}>
        <VideoCover key={video.coverUrl} url={video.coverUrl} title={video.title} eager />
      </Box>
      <Stack
        spacing={2}
        sx={{
          alignItems: 'flex-start',
          p: { xs: 3, md: 4 },
          alignSelf: 'center',
        }}
      >
        <Typography variant="overline" color="primary">
          {tr('精选推荐')}
        </Typography>
        <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
          {video.title}
        </Typography>
        <Typography color="text.secondary">
          {[video.artist, video.views].filter(Boolean).join(' · ')}
        </Typography>
        {video.id && (
          <Button
            component={Link}
            to={`/video/${encodeURIComponent(video.id)}`}
            variant="contained"
            startIcon={<PlayArrowIcon />}
          >
            {tr('播放视频')}
          </Button>
        )}
      </Stack>
    </Card>
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
