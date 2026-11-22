import { useI18n } from '../../app/i18n';
import { VideoActions } from './video_actions';
import { useAccount } from '../account/account_controller';
import { addSubscriptionVideo } from '../../data/local/library_repository';
import { useMemo, useEffect, useState, type SyntheticEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import type { VideoDetail } from '../../domain/models/video';
import { RequestError, LoadingState } from '../shared/request_error';
import { CompactVideoCard } from '../shared/video_card';
import { useQuery } from '@tanstack/react-query';
import { VideoDetailContent } from './video_detail_content';
import { VideoComments } from './video_comments';
import { VideoPlayerPanel } from './video_player_panel';
import { nextEpisode, relatedVideoVisible } from './video_helpers';

export function VideoDetailView({
  video,
  onRefresh,
}: {
  video: VideoDetail;
  onRefresh?: () => void;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [translatedTitle, setTranslatedTitle] = useState<string>();
  const [commentsVisited, setCommentsVisited] = useState(false);
  const [tab, setTab] = useState<'details' | 'comments'>('details');
  useEffect(() => {
    void addSubscriptionVideo(video);
  }, [video]);

  const activeTab = settings.commentsEnabled ? tab : 'details';
  const next = nextEpisode(video);
  const related = settings.applyRecommendationFiltersToRelated
    ? video.related.filter((item) => relatedVideoVisible(item, settings))
    : video.related;
  const metadata = [
    video.views && tr('{0} 次观看', video.views),
    video.uploadDate,
    video.genre,
    video.duration,
  ]
    .filter(Boolean)
    .join(' · ');

  function playNext() {
    switchEpisode(next!.id);
  }

  function switchEpisode(id: string) {
    if (!id || id === video.id) {
      return;
    }
    const home = params.get('home');
    const query = home ? `?${new URLSearchParams({ home })}` : '';
    navigate(`/video/${encodeURIComponent(id)}${query}`, { replace: true });
  }

  function changeTab(_event: SyntheticEvent, value: 'details' | 'comments') {
    setTab(value);
    if (value === 'comments') {
      setCommentsVisited(true);
    }
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 310px',
        gap: '30px',
        alignItems: 'start',
        '@media (max-width:1000px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
      }}
    >
      <Box
        sx={{
          minWidth: 0,
        }}
      >
        <VideoPlayerPanel video={video} onNext={next ? playNext : undefined} />
        <Box
          sx={{
            py: 3,
          }}
        >
          <Typography
            component="h1"
            variant="h5"
            sx={{
              mb: 1,
              overflowWrap: 'anywhere',
            }}
          >
            {translatedTitle ?? video.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {metadata}
          </Typography>
        </Box>
        <VideoActions video={video} />
        <Tabs
          value={activeTab}
          onChange={changeTab}
          aria-label={tr('视频信息')}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            mb: 2,
          }}
        >
          <Tab id="details-tab" value="details" label={tr('简介')} aria-controls="video-info" />
          {settings.commentsEnabled && (
            <Tab
              id="comments-tab"
              value="comments"
              label={tr(
                '评论{0}',
                video.commentCount !== undefined ? `（${video.commentCount}）` : '',
              )}
              aria-controls="video-info"
            />
          )}
        </Tabs>
        <Box id="video-info" role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
          <Box hidden={activeTab !== 'details'}>
            <VideoDetailContent
              video={video}
              onRefresh={onRefresh}
              onTitleChanged={setTranslatedTitle}
            />
          </Box>
          {commentsVisited && (
            <Box hidden={activeTab !== 'comments'}>
              <VideoComments key={video.id} video={video} />
            </Box>
          )}
        </Box>
      </Box>
      <Box
        component="aside"
        sx={{
          display: 'grid',
          gap: '28px',
          minWidth: 0,
          '@media (max-width:1000px)': { gridTemplateColumns: '1fr 1fr' },
          '@media (max-width:620px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
        }}
      >
        {video.playlist.length > 0 && (
          <Box component="section">
            <Stack
              direction="row"
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography component="h2" variant="h6">
                {tr('剧集')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {video.playlist.length}
                {tr('集')}
              </Typography>
            </Stack>
            <Stack
              spacing={1}
              sx={{
                maxHeight: 480,
                overflowY: 'auto',
                p: 0.5,
              }}
            >
              {video.playlist.map((item, index) => (
                <CompactVideoCard
                  key={`${item.id}-${index}`}
                  video={item}
                  selected={item.id === video.id}
                  onSelect={() => switchEpisode(item.id)}
                />
              ))}
            </Stack>
          </Box>
        )}
        <Box component="section">
          <Typography
            component="h2"
            variant="h6"
            sx={{
              mb: 2,
            }}
          >
            {tr('相关推荐')}
          </Typography>
          <Stack spacing={1}>
            {related.length ? (
              related.map((item, index) => (
                <CompactVideoCard key={`${item.id}-${index}`} video={item} />
              ))
            ) : (
              <Typography color="text.secondary">{tr('暂无相关推荐。')}</Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
export function VideoPage({ id, localVideo }: { id: string; localVideo?: VideoDetail }) {
  const tr = useI18n();
  const settings = useSettings();
  const { ready } = useAccount();
  const baseUrl = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const { data, error, isPending, refetch } = useQuery({
    ...repository.video(baseUrl, id),
    enabled: ready !== false,
  });

  const detail = localVideo ? (data ? { ...data, sources: localVideo.sources } : localVideo) : data;

  if (!localVideo && isPending) {
    return <LoadingState label={tr('正在加载视频…')} />;
  }
  if (!localVideo && error) {
    return <RequestError error={error} onRetry={refetch} />;
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mb: 1,
        }}
      >
        <Button onClick={() => refetch()} disabled={ready === false} startIcon={<RefreshIcon />}>
          {tr('刷新详情')}
        </Button>
      </Box>
      {localVideo && error && (
        <Alert severity="info">{tr('无法获取在线资料，正在使用离线视频信息')}</Alert>
      )}
      <VideoDetailView key={detail!.id} video={detail!} onRefresh={refetch} />
    </>
  );
}
