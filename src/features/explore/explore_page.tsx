import { VideoGrid, VideoCardTile, VideoCover } from '../shared/video_card';
import { useI18n } from '../../app/i18n';
import { useLibrary } from '../../data/local/library_repository';
import { useAccount } from '../account/account_controller';
import { useMemo, useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Card, Stack, Tab, Tabs, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useSettings } from '../../app/settings_context';
import { homeBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import { useQuery } from '@tanstack/react-query';
import { RequestError, LoadingState } from '../shared/request_error';
import { homeVideoVisible } from '../video/video_helpers';
import { localize, searchLocale, searchOptionCatalog } from '../../data/search_option_catalog';
import { type HomeSection } from '../../domain/models/video';

export function ExplorePage() {
  const tr = useI18n();
  const settings = useSettings();
  const baseUrl = useMemo(() => homeBaseUrl(settings), [settings]);
  const [category, setCategory] = useState('');
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
    settings.homeSectionOrder,
    settings.hiddenHomeSections,
  ).filter((section) => section.videos.length);
  const selectedCategory = sections.some((section) => homeSectionKey(section) === category)
    ? category
    : homeSectionKey(
        sections[0] ?? {
          title: '',
          videos: [],
          isFeatured: false,
        },
      );
  const visibleSections = settings.useHomeCategoryTabs
    ? sections.filter((section) => homeSectionKey(section) === selectedCategory)
    : sections;
  const featured =
    settings.showHomeFeatured &&
    (!settings.useHomeCategoryTabs ||
      !sections.length ||
      selectedCategory === homeSectionKey(sections[0]))
      ? feed?.featured
      : undefined;

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

  function changeCategory(_event: SyntheticEvent, value: string) {
    setCategory(value);
  }

  return (
    <>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="overline" color="primary">
            {tr('发现')}
          </Typography>
          <Typography component="h1" variant="h4">
            {tr('首页推荐')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
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
      {featured && (
        <Card
          component="section"
          sx={{
            mb: 4,
            display: 'grid',
            gridTemplateColumns: '1.25fr 1fr',
            '@media (max-width:620px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
          }}
        >
          <Box
            sx={{
              aspectRatio: '16 / 9',
              minWidth: 0,
            }}
          >
            <VideoCover
              key={featured.coverUrl}
              url={featured.coverUrl}
              title={featured.title}
              eager
            />
          </Box>
          <Stack
            spacing={2}
            sx={{
              alignItems: 'flex-start',
              p: {
                xs: 3,
                md: 4,
              },
              alignSelf: 'center',
            }}
          >
            <Typography variant="overline" color="primary">
              {tr('精选推荐')}
            </Typography>
            <Typography
              component="h2"
              variant="h5"
              sx={{
                overflowWrap: 'anywhere',
              }}
            >
              {featured.title}
            </Typography>
            <Typography color="text.secondary">
              {[featured.artist, featured.views].filter(Boolean).join(' · ')}
            </Typography>
            {featured.id && (
              <Button
                component={Link}
                to={`/video/${encodeURIComponent(featured.id)}`}
                variant="contained"
                startIcon={<PlayArrowIcon />}
              >
                {tr('播放视频')}
              </Button>
            )}
          </Stack>
        </Card>
      )}
      {settings.useHomeCategoryTabs && sections.length > 0 && (
        <Tabs
          value={selectedCategory}
          onChange={changeCategory}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={tr('首页分类')}
        >
          {sections.map((section, index) => (
            <Tab
              key={`${homeSectionKey(section)}-${index}`}
              value={homeSectionKey(section)}
              label={sectionTitle(section.title, section.moreUrl)}
            />
          ))}
        </Tabs>
      )}
      {visibleSections.map((section, index) => (
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
          <VideoGrid
            layout={settings.expandHomeVideoCards || settings.useHomeCategoryTabs ? 'grid' : 'row'}
          >
            {section.videos.map((video, videoIndex) => (
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
