import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type SyntheticEvent,
} from 'react';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Fade,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import Hls from 'hls.js';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import type { AppSettings } from '../../core/settings';
import * as keyframes from '../../data/local/keyframe_repository';
import * as watch from '../../data/local/watch_repository';
import { parseVideoDuration, type VideoDetail } from '../../domain/models/video';
import { useConfirmation } from '../shared/use_confirmation';
import { LoadingIndicator } from '../shared/loading_indicator';
import { PlayerControls } from './player_controls';
import { usePlayerChrome } from './player_window';
import { usePlayerKeyboard } from './use_player_keyboard';
import { preferredSource, resumePosition } from './video_helpers';

const aspectLabels: Record<AppSettings['videoAspectRatio'], string> = {
  auto: '自动',
  crop: '裁剪',
  stretch: '拉伸',
  ratio4x3: '4:3',
};

export function VideoPlayerPanel({ video, onNext }: { video: VideoDetail; onNext?: () => void }) {
  const tr = useI18n();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const { sidebarOpen, setSidebarOpen } = usePlayerChrome();
  const confirmation = useConfirmation();
  const preferences = useRef(settings);
  preferences.current = settings;

  const frames = useQuery({
    queryKey: ['keyframes', video.id],
    queryFn: () => keyframes.load(video.id),
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const selectedQuality = useRef<number | undefined>(undefined);
  const restored = useRef(false);
  const switching = useRef(false);
  const nextStart = useRef<{ position: number; playing: boolean } | undefined>(undefined);
  const savePlayback = useRef<() => void>(() => {});

  const [framesOpen, setFramesOpen] = useState(false);
  const [frameNotice, setFrameNotice] = useState<{ id: number; text: string } | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);
  const [hoveringControls, setHoveringControls] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const [sourceUrl, setSourceUrl] = useState(
    () => preferredSource(video.sources, settings.preferredQuality)?.url ?? '',
  );
  const [playbackError, setPlaybackError] = useState('');
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [speed, setSpeed] = useState(settings.defaultPlaybackSpeed);
  const [qualityAnchor, setQualityAnchor] = useState<HTMLElement | null>(null);
  const [speedAnchor, setSpeedAnchor] = useState<HTMLElement | null>(null);
  const [aspectAnchor, setAspectAnchor] = useState<HTMLElement | null>(null);

  const restoreSidebar = useCallback(() => setSidebarOpen(true), [setSidebarOpen]);
  usePlayerKeyboard(player, !sidebarOpen ? restoreSidebar : undefined);

  useEffect(() => {
    const source = preferredSource(
      video.sources,
      selectedQuality.current ?? settings.preferredQuality,
    );
    if (source?.url === sourceUrl) {
      return;
    }
    const element = player.current;
    if (element) {
      savePlayback.current();
      nextStart.current = { position: element.currentTime, playing: !element.paused };
      switching.current = true;
    }
    setSourceUrl(source?.url ?? '');
  }, [video.sources, settings.preferredQuality, sourceUrl]);

  useEffect(() => {
    setStuck(false);
    if (!buffering) {
      return;
    }
    const timer = window.setTimeout(() => setStuck(true), 10000);
    return () => window.clearTimeout(timer);
  }, [buffering, sourceUrl]);

  useEffect(() => {
    if (!frameNotice) {
      return;
    }
    const timer = window.setTimeout(() => setFrameNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [frameNotice]);

  useEffect(() => {
    const changed = () => setFullscreenOpen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  useEffect(() => {
    const element = player.current;
    if (!element) {
      return;
    }
    let playingSince: number | undefined;
    let watchedMs = 0;
    let lastSaved = 0;
    const report = () => {};

    function stopClock() {
      if (playingSince !== undefined) {
        watchedMs += performance.now() - playingSince;
      }
      playingSince = undefined;
    }

    function flush() {
      if (switching.current || element!.readyState === 0) {
        return;
      }
      if (playingSince !== undefined) {
        watchedMs += performance.now() - playingSince;
        playingSince = performance.now();
      }
      if (preferences.current.incognitoPlayback) {
        return;
      }
      const duration = Number.isFinite(element!.duration)
        ? element!.duration
        : (parseVideoDuration(video.duration) ?? 0);
      void watch
        .progress({
          id: video.id,
          title: video.title,
          coverUrl: video.coverUrl,
          positionMs: Math.round(element!.currentTime * 1000),
          durationMs: Math.round(duration * 1000),
        })
        .catch(report);
      lastSaved = performance.now();
    }

    function recordWatch() {
      stopClock();
      if (watchedMs < 5000) {
        return;
      }
      const amount = Math.floor(watchedMs);
      watchedMs = 0;
      if (!preferences.current.incognitoPlayback) {
        void watch.addTime(video.id, video.title, amount, video.coverUrl).catch(report);
      }
    }

    function leave() {
      pause();
      recordWatch();
    }

    const playing = () => {
      for (const other of document.querySelectorAll('video')) {
        if (other !== element) {
          other.pause();
        }
      }
      if (playingSince === undefined) {
        playingSince = performance.now();
      }
    };

    const pause = () => {
      stopClock();
      flush();
    };

    const timeupdate = () => {
      if (performance.now() - lastSaved >= 5000) {
        flush();
      }
    };

    element.addEventListener('playing', playing);
    element.addEventListener('pause', pause);
    element.addEventListener('waiting', stopClock);
    element.addEventListener('seeking', stopClock);
    element.addEventListener('timeupdate', timeupdate);
    window.addEventListener('pagehide', leave);
    savePlayback.current = flush;
    return () => {
      stopClock();
      flush();
      recordWatch();
      element.removeEventListener('playing', playing);
      element.removeEventListener('pause', pause);
      element.removeEventListener('waiting', stopClock);
      element.removeEventListener('seeking', stopClock);
      element.removeEventListener('timeupdate', timeupdate);
      window.removeEventListener('pagehide', leave);
      element.pause();
    };
  }, [video.id, video.title, video.coverUrl, video.duration, sourceUrl === '']);

  useEffect(() => {
    if (!settings.autoPictureInPicture) {
      return;
    }
    async function visibilityChanged() {
      const element = player.current;
      if (!document.hidden || !element || element.paused) {
        return;
      }
      if (document.pictureInPictureElement === element || !document.pictureInPictureEnabled) {
        return;
      }
      try {
        await element.requestPictureInPicture();
      } catch {}
    }

    document.addEventListener('visibilitychange', visibilityChanged);
    return () => document.removeEventListener('visibilitychange', visibilityChanged);
  }, [settings.autoPictureInPicture]);

  useEffect(() => {
    const element = player.current;
    if (!element || !sourceUrl) {
      return;
    }
    const type = video.sources.find((item) => item.url === sourceUrl)?.type ?? '';
    const isHls = /\.m3u8(?:[?#]|$)/i.test(sourceUrl) || /(?:mpegurl|m3u8)/i.test(type);
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 45,
        maxMaxBufferLength: 120,
        backBufferLength: 60,
      });
      hls.on(Hls.Events.ERROR, (_event, error) => {
        if (!error.fatal) {
          return;
        }
        setBuffering(false);
        setPlaybackError('视频加载中断，请重试或切换播放源。');
      });
      hls.loadSource(sourceUrl);
      hls.attachMedia(element);
      return () => hls.destroy();
    }
    element.src = sourceUrl;
    return () => {
      element.removeAttribute('src');
      element.load();
    };
  }, [sourceUrl, playbackAttempt, video.sources]);

  const nextFrame = frames.data?.find((position) => position >= positionMs);
  const frameCountdown = nextFrame === undefined ? undefined : nextFrame - positionMs;
  const sourceIndex = video.sources.findIndex((item) => item.url === sourceUrl);
  const source = sourceIndex >= 0 ? video.sources[sourceIndex] : undefined;
  const speedOptions = [...new Set([0.5, 0.75, 1, 1.25, 1.5, 2, 3, speed])].sort((a, b) => a - b);
  const currentQualityLabel = source
    ? source.quality === 'Default'
      ? tr('默认 {0}', sourceIndex + 1)
      : source.quality
    : '';
  const showKeyframeCountdown =
    settings.keyframesEnabled && frameCountdown !== undefined && frameCountdown <= 10000;

  async function loadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    const loadedSource = element.currentSrc;
    element.playbackRate = speed;
    let position = nextStart.current?.position ?? 0;
    const shouldPlay = nextStart.current?.playing ?? settings.autoPlayOnOpen;
    if (!nextStart.current && !restored.current && settings.resumePlayback) {
      try {
        position = resumePosition(
          (await watch.readWatchState()).continueItems.find((item) => item.videoCode === video.id),
        );
      } catch {}
    }
    if (player.current !== element || loadedSource !== element.currentSrc) {
      return;
    }
    if (position > 0) {
      element.currentTime = Number.isFinite(element.duration)
        ? Math.min(position, Math.max(0, element.duration - 0.1))
        : position;
    }
    restored.current = true;
    switching.current = false;
    nextStart.current = undefined;
    if (shouldPlay) {
      try {
        await element.play();
      } catch (error) {
        if (element.currentSrc !== loadedSource || player.current !== element) {
          return;
        }
        if ((error as Error).name === 'NotAllowedError') {
          setPlaybackError(tr('自动播放未开始，请点击播放器中的播放按钮。'));
        } else if ((error as Error).name !== 'AbortError') {
          setPlaybackError(tr('播放失败：{0}', (error as Error).message));
        }
      }
    }
  }

  function changeSource(url: string) {
    setQualityAnchor(null);
    if (url === sourceUrl) {
      return;
    }
    const element = player.current!;
    selectedQuality.current = Number(
      /\d+/.exec(video.sources.find((item) => item.url === url)!.quality)?.[0] ??
        settings.preferredQuality,
    );
    savePlayback.current();
    nextStart.current = {
      position: element.currentTime,
      playing: !element.paused,
    };
    switching.current = true;
    setPlaybackError('');
    setSourceUrl(url);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current?.requestFullscreen();
    }
  }

  function selectSpeed(value: number) {
    setSpeedAnchor(null);
    setSpeed(value);
    player.current!.playbackRate = value;
  }

  function selectAspect(value: AppSettings['videoAspectRatio']) {
    setAspectAnchor(null);
    void saveSettings({ videoAspectRatio: value });
  }

  function seekTo(seconds: number) {
    const element = player.current;
    if (element && Number.isFinite(element.duration)) {
      element.currentTime = Math.max(0, Math.min(element.duration, seconds));
      setPositionMs(element.currentTime * 1000);
    }
  }

  function togglePlay() {
    const element = player.current;
    if (!element) {
      return;
    }
    if (element.paused) {
      void element.play().catch(() => {});
    } else {
      element.pause();
    }
  }

  function changeVolume(value: number) {
    const element = player.current;
    if (!element) {
      return;
    }
    element.volume = value;
    element.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function toggleMute() {
    const element = player.current;
    if (!element) {
      return;
    }
    const nextMuted = !element.muted;
    element.muted = nextMuted;
    if (!nextMuted && element.volume === 0) {
      element.volume = 0.6;
      setVolume(0.6);
    }
    setMuted(nextMuted);
  }

  function togglePip() {
    const element = player.current;
    if (!element || !document.pictureInPictureEnabled) {
      return;
    }
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture();
    } else {
      void element.requestPictureInPicture().catch(() => {});
    }
  }

  function bumpControls() {
    setControlsShown(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsShown(false), 2500);
  }

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  function updateBuffered(element: HTMLVideoElement) {
    if (element.buffered.length > 0) {
      setBufferedEnd(element.buffered.end(element.buffered.length - 1));
    }
  }

  async function addKeyframe() {
    const element = player.current!;
    if (!element.paused) {
      setFrameNotice({ id: Date.now(), text: tr('请先暂停播放再添加关键帧') });
      return;
    }
    const position = Math.round(element.currentTime * 1000);
    if (
      !(await confirmation.confirm(tr('将 {0} 秒添加为关键帧？', (position / 1000).toFixed(1))))
    ) {
      return;
    }
    const added = await keyframes.add(video.id, position, video.title);
    setFrameNotice({
      id: Date.now(),
      text: added ? tr('关键帧已添加') : tr('与已有关键帧相隔不足 10 秒'),
    });
    void frames.refetch();
  }

  async function removeKeyframe(position: number) {
    await keyframes.remove(video.id, position);
    void frames.refetch();
  }

  function jumpToKeyframe(position: number) {
    player.current!.currentTime = position / 1000;
    setFramesOpen(false);
  }

  function playbackEnded() {
    savePlayback.current();
    if (settings.autoPlayNext && !settings.loopPlayback) {
      onNext?.();
    }
  }

  function playbackFailed(event: SyntheticEvent<HTMLVideoElement>) {
    setBuffering(false);
    if (event.currentTarget.error?.code === 4) {
      setPlaybackError(tr('播放器无法加载此播放源，可能是格式不支持或地址已失效。'));
    } else {
      setPlaybackError(tr('视频加载中断，请重试或切换播放源。'));
    }
  }

  function retryPlayback() {
    savePlayback.current();
    nextStart.current = {
      position: nextStart.current?.position ?? player.current!.currentTime,
      playing: !player.current!.paused,
    };
    switching.current = true;
    setPlaybackError('');
    setPlaybackAttempt((value) => value + 1);
  }

  function handlePlaying() {
    setPlaybackError('');
    setBuffering(false);
    setIsPlaying(true);
    bumpControls();
  }

  function openQualityMenu(event: MouseEvent<HTMLElement>) {
    setQualityAnchor(event.currentTarget);
  }

  function openSpeedMenu(event: MouseEvent<HTMLElement>) {
    setSpeedAnchor(event.currentTarget);
  }

  function openAspectMenu(event: MouseEvent<HTMLElement>) {
    setAspectAnchor(event.currentTarget);
  }

  if (!source) {
    return (
      <Box
        sx={{
          height: '100%',
          bgcolor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Alert severity="warning" sx={{ maxWidth: 420 }}>
          <AlertTitle>{tr('暂无可用播放源')}</AlertTitle>
          {tr('可以刷新详情后重试。')}
        </Alert>
      </Box>
    );
  }

  const menuOpen = Boolean(qualityAnchor || speedAnchor || aspectAnchor);
  const controlsVisible = !isPlaying || controlsShown || hoveringControls || menuOpen;

  return (
    <Box
      ref={stageRef}
      data-player-stage
      component="section"
      aria-label={tr('视频播放器')}
      onMouseMove={bumpControls}
      onMouseLeave={() => isPlaying && !menuOpen && setControlsShown(false)}
      sx={{
        height: '100%',
        width: '100%',
        bgcolor: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        cursor: !controlsVisible && isPlaying ? 'none' : 'default',
      }}
    >
      <Box
        onMouseDown={() => (document.activeElement as HTMLElement | null)?.blur()}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        sx={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#000',
          overflow: 'hidden',
        }}
      >
        <Box
          component="video"
          ref={player}
          poster={video.coverUrl}
          playsInline
          preload="auto"
          loop={settings.loopPlayback}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0);
            updateBuffered(event.currentTarget);
            void loadedMetadata(event);
          }}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onProgress={(event) => updateBuffered(event.currentTarget)}
          onPlaying={handlePlaying}
          onPause={() => {
            setIsPlaying(false);
            setControlsShown(true);
          }}
          onVolumeChange={(event) => {
            setVolume(event.currentTarget.volume);
            setMuted(event.currentTarget.muted);
          }}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onTimeUpdate={(event) => {
            setPositionMs(event.currentTarget.currentTime * 1000);
            updateBuffered(event.currentTarget);
          }}
          onEnded={playbackEnded}
          onError={playbackFailed}
          sx={{
            display: 'block',
            bgcolor: '#000',
            width: settings.videoAspectRatio === 'ratio4x3' ? 'auto' : '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: settings.videoAspectRatio === 'ratio4x3' ? '4 / 3' : undefined,
            objectFit:
              settings.videoAspectRatio === 'crop'
                ? 'cover'
                : settings.videoAspectRatio === 'stretch'
                  ? 'fill'
                  : 'contain',
          }}
        />
        {buffering && !playbackError && (
          <Box sx={{ position: 'absolute', pointerEvents: 'none' }}>
            <LoadingIndicator size="lg" color="rgba(255, 255, 255, 0.9)" />
          </Box>
        )}
        <Fade in={Boolean(frameNotice)} timeout={{ enter: 180, exit: 320 }} unmountOnExit>
          <Box
            sx={{
              position: 'absolute',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 3,
              pointerEvents: 'none',
              px: 2.75,
              py: 1.1,
              borderRadius: '999px',
              bgcolor: 'rgba(20, 20, 26, 0.9)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 500,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              whiteSpace: 'nowrap',
            }}
          >
            {frameNotice?.text}
          </Box>
        </Fade>
        {(showKeyframeCountdown || stuck || playbackError) && (
          <Stack
            spacing={1}
            onClick={(event) => event.stopPropagation()}
            sx={{
              position: 'absolute',
              top: 14,
              right: 14,
              zIndex: 3,
              maxWidth: 360,
            }}
          >
            {showKeyframeCountdown && (
              <Alert severity="info" variant="filled" sx={{ py: 0.25 }}>
                {tr('距下一个关键帧 {0} 秒', (frameCountdown / 1000).toFixed(1))}
              </Alert>
            )}
            {stuck && (
              <Alert
                severity="info"
                variant="filled"
                action={
                  <Button color="inherit" size="small" onClick={retryPlayback}>
                    {tr('重试播放')}
                  </Button>
                }
              >
                {tr('正在缓冲…')}
              </Alert>
            )}
            {playbackError && (
              <Alert
                severity="warning"
                variant="filled"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<ReplayIcon />}
                    onClick={retryPlayback}
                  >
                    {tr('重试播放')}
                  </Button>
                }
              >
                {tr(playbackError)}
              </Alert>
            )}
          </Stack>
        )}
        <PlayerControls
          visible={controlsVisible}
          playing={isPlaying}
          currentTime={positionMs / 1000}
          duration={duration}
          bufferedEnd={bufferedEnd}
          volume={volume}
          muted={muted}
          speed={speed}
          qualityLabel={`${currentQualityLabel}${/\.m3u8(?:\?|$)/i.test(source.url) ? ' · HLS' : ''}`}
          aspectLabel={tr(aspectLabels[settings.videoAspectRatio])}
          fullscreen={fullscreenOpen}
          pipSupported={Boolean(document.pictureInPictureEnabled)}
          keyframesEnabled={settings.keyframesEnabled}
          keyframes={frames.data ?? []}
          hasNext={Boolean(onNext)}
          onTogglePlay={togglePlay}
          onSeekTo={seekTo}
          onNext={onNext}
          onVolumeChange={changeVolume}
          onToggleMute={toggleMute}
          onOpenQuality={openQualityMenu}
          onOpenSpeed={openSpeedMenu}
          onOpenAspect={openAspectMenu}
          onOpenKeyframes={() => setFramesOpen(true)}
          onAddKeyframe={addKeyframe}
          onJumpKeyframe={jumpToKeyframe}
          onTogglePip={togglePip}
          onToggleFullscreen={toggleFullscreen}
          onHoverChange={setHoveringControls}
        />
      </Box>
      <Menu
        anchorEl={qualityAnchor}
        open={Boolean(qualityAnchor)}
        onClose={() => setQualityAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {video.sources.map((item, index) => (
          <MenuItem
            key={`${item.url}-${index}`}
            selected={item.url === sourceUrl}
            onClick={() => changeSource(item.url)}
          >
            {item.quality === 'Default' ? tr('默认 {0}', index + 1) : item.quality}
            {/\.m3u8(?:\?|$)/i.test(item.url) ? ' · HLS' : ''}
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={speedAnchor}
        open={Boolean(speedAnchor)}
        onClose={() => setSpeedAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {speedOptions.map((value) => (
          <MenuItem key={value} selected={value === speed} onClick={() => selectSpeed(value)}>
            {value}×
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={aspectAnchor}
        open={Boolean(aspectAnchor)}
        onClose={() => setAspectAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {(['auto', 'crop', 'stretch', 'ratio4x3'] as const).map((value) => (
          <MenuItem
            key={value}
            selected={value === settings.videoAspectRatio}
            onClick={() => selectAspect(value)}
          >
            {tr(aspectLabels[value])}
          </MenuItem>
        ))}
      </Menu>
      <Dialog open={framesOpen} onClose={() => setFramesOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{tr('关键帧')}</DialogTitle>
        <DialogContent>
          {frames.data?.length ? (
            <List dense>
              {frames.data.map((position) => (
                <ListItem
                  key={position}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" onClick={() => jumpToKeyframe(position)}>
                        {tr('跳转')}
                      </Button>
                      <Button size="small" color="error" onClick={() => removeKeyframe(position)}>
                        {tr('删除')}
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemText primary={tr('{0} 秒', (position / 1000).toFixed(1))} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {tr('暂无关键帧')}
            </Typography>
          )}
        </DialogContent>
      </Dialog>
      {confirmation.dialog}
    </Box>
  );
}
