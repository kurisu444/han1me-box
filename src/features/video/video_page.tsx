import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, Box, IconButton, Stack, Tab, Tabs, Tooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import { addSubscriptionVideo } from '../../data/local/library_repository';
import { localMediaUrl } from '../../domain/models/download';
import type { PlaylistQueue, VideoDetail } from '../../domain/models/video';
import { useAccount } from '../account/account_controller';
import { LoadingState, RequestError } from '../shared/request_error';
import { usePlayerChrome } from './player_window';
import { VideoComments } from './video_comments';
import { VideoDetailContent } from './video_detail_content';
import { nextEpisode, relatedVideoVisible } from './video_helpers';
import { VideoPlayerPanel } from './video_player_panel';

export function VideoDetailView({
  video,
  queue,
  offlineNotice = false,
  onRefresh,
}: {
  video: VideoDetail;
  queue?: PlaylistQueue;
  offlineNotice?: boolean;
  onRefresh?: () => void;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { sidebarOpen, toggleSidebar, setVideoTitle } = usePlayerChrome();
  const [translatedTitle, setTranslatedTitle] = useState<string>();
  const [commentsVisited, setCommentsVisited] = useState(false);
  const [tab, setTab] = useState<'details' | 'comments'>('details');

  useEffect(() => {
    void addSubscriptionVideo(video);
  }, [video]);

  useEffect(() => {
    setVideoTitle(translatedTitle ?? video.title);
    return () => setVideoTitle('');
  }, [translatedTitle, video.title, setVideoTitle]);

  const activeTab = settings.commentsEnabled ? tab : 'details';
  const next = nextEpisode(video);
  const related = settings.applyRecommendationFiltersToRelated
    ? video.related.filter((item) => relatedVideoVisible(item, settings))
    : video.related;

  function playNext() {
    switchEpisode(next!.id);
  }

  function switchEpisode(id: string) {
    if (!id || id === video.id) {
      return;
    }
    const home = params.get('home');
    const query = home ? `?${new URLSearchParams({ home })}` : '';
    navigate(`/video/${encodeURIComponent(id)}${query}`, {
      state: queue ? { queue } : undefined,
    });
  }

  function changeTab(_event: SyntheticEvent, value: 'details' | 'comments') {
    setTab(value);
    if (value === 'comments') {
      setCommentsVisited(true);
    }
  }

  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        height: 'calc(100vh - var(--titlebar-height))',
        width: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
        '@media (max-width:860px)': {
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          bgcolor: '#000',
          position: 'relative',
          '@media (max-width:860px)': {
            flex: sidebarOpen ? 'none' : 1,
            height: sidebarOpen ? '48vh' : '100%',
          },
        }}
      >
        <VideoPlayerPanel video={video} onNext={next ? playNext : undefined} />
        <Tooltip title={tr(sidebarOpen ? '收起信息栏' : '展开信息栏')} placement="left">
          <IconButton
            aria-label={tr(sidebarOpen ? '收起信息栏' : '展开信息栏')}
            aria-expanded={sidebarOpen}
            aria-controls="video-sidebar"
            onClick={toggleSidebar}
            sx={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 3,
              width: 28,
              height: 64,
              borderRadius: '8px 0 0 8px',
              bgcolor: 'rgba(0, 0, 0, 0.45)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
              '@media (max-width:860px)': sidebarOpen
                ? {
                    top: 'auto',
                    bottom: 0,
                    right: '50%',
                    transform: 'translateX(50%)',
                    width: 64,
                    height: 28,
                    borderRadius: '8px 8px 0 0',
                    '& svg': { transform: 'rotate(90deg)' },
                  }
                : {},
            }}
          >
            {sidebarOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      {sidebarOpen && (
        <Box
          component="aside"
          id="video-sidebar"
          sx={{
            width: 360,
            flexShrink: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderLeft: 1,
            borderColor: 'divider',
            minHeight: 0,
            '@media (max-width:860px)': {
              width: '100%',
              flex: 1,
              height: 'auto',
              borderLeft: 0,
              borderTop: 1,
            },
          }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Tabs
              value={activeTab}
              onChange={changeTab}
              aria-label={tr('视频信息')}
              sx={{
                minHeight: 44,
                '& .MuiTab-root': {
                  minHeight: 44,
                  minWidth: 64,
                  px: 1.5,
                  py: 0.75,
                  fontSize: 13.5,
                },
              }}
            >
              <Tab id="details-tab" value="details" label={tr('简介')} aria-controls="video-info" />
              {settings.commentsEnabled && (
                <Tab
                  id="comments-tab"
                  value="comments"
                  aria-controls="video-info"
                  label={
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <span>{tr('评论')}</span>
                      {video.commentCount !== undefined && (
                        <Box
                          component="span"
                          sx={{
                            px: 0.75,
                            py: 0.1,
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: 1.4,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                          }}
                        >
                          {video.commentCount}
                        </Box>
                      )}
                    </Stack>
                  }
                />
              )}
            </Tabs>
            {onRefresh && (
              <Tooltip title={tr('刷新详情')}>
                <IconButton size="small" aria-label={tr('刷新详情')} onClick={onRefresh}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Box
            id="video-info"
            role="tabpanel"
            aria-labelledby={`${activeTab}-tab`}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              px: 2,
              py: 2,
            }}
          >
            <Box hidden={activeTab !== 'details'}>
              {offlineNotice && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {tr('无法获取在线资料，正在使用离线视频信息')}
                </Alert>
              )}
              <VideoDetailContent
                video={video}
                related={related}
                playlistTitle={queue?.title}
                onSelectEpisode={switchEpisode}
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
      )}
    </Box>
  );
}

export function VideoPage({
  id,
  localVideo,
  queue,
}: {
  id: string;
  localVideo?: VideoDetail;
  queue?: PlaylistQueue;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const { ready } = useAccount();
  const baseUrl = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const { data, error, isPending, refetch } = useQuery({
    ...repository.video(baseUrl, id),
    enabled: ready !== false,
  });
  const cachedSource = useQuery({
    queryKey: ['cached-video-source', id],
    enabled: !localVideo && Boolean(id),
    queryFn: async () => {
      const state = await window.electron.downloads.state();
      const task = state.tasks.find(
        (item) => item.videoCode === id && item.status === 'completed' && item.localVideoPath,
      );
      if (!task?.localVideoPath || !(await window.electron.fileExists(task.localVideoPath))) {
        return null;
      }
      return { quality: task.quality, url: localMediaUrl(task.localVideoPath) };
    },
  });

  const mergedOnline =
    data && cachedSource.data
      ? {
          ...data,
          sources: [
            {
              quality: `${cachedSource.data.quality} · ${tr('已缓存')}`,
              url: cachedSource.data.url,
            },
            ...data.sources,
          ],
        }
      : data;
  const baseDetail = localVideo
    ? data
      ? { ...data, sources: localVideo.sources }
      : localVideo
    : mergedOnline;
  const detail =
    baseDetail && queue?.items.length ? { ...baseDetail, playlist: queue.items } : baseDetail;

  if (!localVideo && (isPending || cachedSource.isPending)) {
    return (
      <Box
        sx={{
          height: 'calc(100vh - var(--titlebar-height))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingState label={tr('正在加载视频…')} />
      </Box>
    );
  }

  if (!localVideo && error) {
    return (
      <Box
        sx={{
          height: 'calc(100vh - var(--titlebar-height))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <RequestError error={error} onRetry={refetch} />
      </Box>
    );
  }

  return (
    <VideoDetailView
      key={detail!.id}
      video={detail!}
      queue={queue}
      offlineNotice={Boolean(localVideo && error)}
      onRefresh={() => void refetch()}
    />
  );
}
