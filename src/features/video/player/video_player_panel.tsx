import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import { useI18n } from '../../../app/i18n';
import { useSettings } from '../../../app/settings_context';
import type { VideoDetail } from '../../../domain/models/video';
import { PlayerControls } from './player_controls';
import { PlayerMenus, usePlayerMenus, aspectLabels } from './player_menus';
import { PlayerOverlays } from './player_overlays';
import { usePlayerChrome } from '../player_window';
import { usePlayerKeyboard } from './use_player_keyboard';
import { useHlsPlayback } from './use_hls_playback';

export function VideoPlayerPanel({ video, onNext }: { video: VideoDetail; onNext?: () => void }) {
  const tr = useI18n();
  const settings = useSettings();
  const { sidebarOpen, setSidebarOpen } = usePlayerChrome();

  const stageRef = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const savePlayback = useRef<() => void>(() => {});

  const [volumeHud, setVolumeHud] = useState({ open: false, percent: 100 });
  const volumeHudTimer = useRef<number | undefined>(undefined);
  const [positionMs, setPositionMs] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);
  const [hoveringControls, setHoveringControls] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [speed, setSpeed] = useState(settings.defaultPlaybackSpeed);
  const {
    sourceUrl,
    playbackError,
    setPlaybackError,
    buffering,
    setBuffering,
    loadedMetadata,
    changeSource,
    playbackFailed,
    retryPlayback,
  } = useHlsPlayback(video, player, savePlayback, speed);
  const menu = usePlayerMenus(video, player, changeSource, setSpeed);
  const handleKeyboardVolume = useCallback((percent: number) => {
    setVolumeHud({ open: true, percent });
    window.clearTimeout(volumeHudTimer.current);
    volumeHudTimer.current = window.setTimeout(
      () => setVolumeHud((prev) => ({ ...prev, open: false })),
      900,
    );
  }, []);

  useEffect(() => () => window.clearTimeout(volumeHudTimer.current), []);

  const restoreSidebar = useCallback(() => setSidebarOpen(true), [setSidebarOpen]);
  usePlayerKeyboard(player, !sidebarOpen ? restoreSidebar : undefined, handleKeyboardVolume);

  useEffect(() => {
    const changed = () => setFullscreenOpen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

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

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const { frames, qualityAnchor, speedAnchor, aspectAnchor } = menu;
  const nextFrame = frames.data?.find((position) => position >= positionMs);
  const frameCountdown = nextFrame === undefined ? undefined : nextFrame - positionMs;
  const sourceIndex = video.sources.findIndex((item) => item.url === sourceUrl);
  const source = sourceIndex >= 0 ? video.sources[sourceIndex] : undefined;
  const currentQualityLabel = source
    ? source.quality === 'Default'
      ? tr('默认 {0}', sourceIndex + 1)
      : source.quality
    : '';
  const showKeyframeCountdown =
    settings.keyframesEnabled && frameCountdown !== undefined && frameCountdown <= 10000;

  const menuOpen = Boolean(qualityAnchor || speedAnchor || aspectAnchor);
  const controlsVisible = !isPlaying || controlsShown || hoveringControls || menuOpen;

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current?.requestFullscreen();
    }
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

  function updateBuffered(element: HTMLVideoElement) {
    if (element.buffered.length > 0) {
      setBufferedEnd(element.buffered.end(element.buffered.length - 1));
    }
  }

  function playbackEnded() {
    savePlayback.current();
    if (settings.autoPlayNext && !settings.loopPlayback) {
      onNext?.();
    }
  }

  function handlePlaying() {
    setPlaybackError('');
    setBuffering(false);
    setIsPlaying(true);
    bumpControls();
  }

  function handleMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    setDuration(event.currentTarget.duration || 0);
    updateBuffered(event.currentTarget);
    void loadedMetadata(event);
  }

  function handlePause() {
    setIsPlaying(false);
    setControlsShown(true);
  }

  function handleVolumeChange(event: SyntheticEvent<HTMLVideoElement>) {
    setVolume(event.currentTarget.volume);
    setMuted(event.currentTarget.muted);
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    setPositionMs(event.currentTarget.currentTime * 1000);
    updateBuffered(event.currentTarget);
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
          onLoadedMetadata={handleMetadata}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onProgress={(event) => updateBuffered(event.currentTarget)}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onVolumeChange={handleVolumeChange}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onTimeUpdate={handleTimeUpdate}
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
        <PlayerOverlays
          buffering={buffering}
          playbackError={playbackError}
          volumeHud={volumeHud}
          frameNotice={menu.frameNotice}
          onCloseNotice={() => menu.setFrameNotice(null)}
          frameCountdown={showKeyframeCountdown ? frameCountdown : undefined}
          retryPlayback={retryPlayback}
        />
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
          onOpenQuality={menu.openQualityMenu}
          onOpenSpeed={menu.openSpeedMenu}
          onOpenAspect={menu.openAspectMenu}
          onOpenKeyframes={() => menu.setFramesOpen(true)}
          onAddKeyframe={menu.addKeyframe}
          onJumpKeyframe={menu.jumpToKeyframe}
          onTogglePip={togglePip}
          onToggleFullscreen={toggleFullscreen}
          onHoverChange={setHoveringControls}
        />
      </Box>
      <PlayerMenus video={video} sourceUrl={sourceUrl} speed={speed} menu={menu} />
    </Box>
  );
}
