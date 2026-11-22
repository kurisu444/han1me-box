import { usePlayerKeyboard } from './use_player_keyboard';
import Hls from 'hls.js';
import { useI18n } from '../../app/i18n';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from 'react';
import * as keyframes from '../../data/local/keyframe_repository';
import { useQuery } from '@tanstack/react-query';
import { useConfirmation } from '../shared/use_confirmation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  Alert,
  AlertTitle,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from '@mui/material';

import SkipNextIcon from '@mui/icons-material/SkipNext';
import ReplayIcon from '@mui/icons-material/Replay';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { isPortraitVideo, playerHeightLimit } from '../../core/video_metrics';
import { parseVideoDuration, type VideoDetail } from '../../domain/models/video';
import * as watch from '../../data/local/watch_repository';
import { preferredSource, resumePosition } from './video_helpers';
export function VideoPlayerPanel({ video, onNext }: { video: VideoDetail; onNext?: () => void }) {
  const tr = useI18n();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const preferences = useRef(settings);
  preferences.current = settings;
  const confirmation = useConfirmation();
  const frames = useQuery({
    queryKey: ['keyframes', video.id],
    queryFn: () => keyframes.load(video.id),
  });
  const [framesOpen, setFramesOpen] = useState(false);
  const [frameNotice, setFrameNotice] = useState('');
  const player = useRef<HTMLVideoElement>(null);
  const [windowFullscreen, setWindowFullscreen] = useState(false);
  const exitWindowFullscreen = useCallback(() => setWindowFullscreen(false), []);
  usePlayerKeyboard(player, windowFullscreen ? exitWindowFullscreen : undefined);
  useEffect(() => {
    if (!windowFullscreen) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [windowFullscreen]);
  const [positionMs, setPositionMs] = useState(0);
  const [sourceUrl, setSourceUrl] = useState(
    () => preferredSource(video.sources, settings.preferredQuality)?.url ?? '',
  );
  const [playbackError, setPlaybackError] = useState('');
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const selectedQuality = useRef<number | undefined>(undefined);
  const [speed, setSpeed] = useState(settings.defaultPlaybackSpeed);
  const [portraitHeight, setPortraitHeight] = useState<number>();
  const restored = useRef(false);
  const switching = useRef(false);
  const nextStart = useRef<
    | {
        position: number;
        playing: boolean;
      }
    | undefined
  >(undefined);
  const savePlayback = useRef<() => void>(() => {});
  useEffect(() => {
    const source = preferredSource(
      video.sources,
      selectedQuality.current ?? settings.preferredQuality,
    );
    if (source?.url === sourceUrl) return;
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
    if (!buffering) return;
    const timer = window.setTimeout(() => setStuck(true), 10000);
    return () => window.clearTimeout(timer);
  }, [buffering, sourceUrl]);
  useEffect(() => {
    const changed = () => setFullscreenOpen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    const element = player.current;
    if (!element) return;
    let playingSince: number | undefined;
    let watchedMs = 0;
    let lastSaved = 0;
    const report = () => {};
    function stopClock() {
      if (playingSince !== undefined) watchedMs += performance.now() - playingSince;
      playingSince = undefined;
    }
    function flush() {
      if (switching.current || element!.readyState === 0) return;
      if (playingSince !== undefined) {
        watchedMs += performance.now() - playingSince;
        playingSince = performance.now();
      }
      if (preferences.current.incognitoPlayback) return;
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
      if (watchedMs < 5000) return;
      const amount = Math.floor(watchedMs);
      watchedMs = 0;
      if (!preferences.current.incognitoPlayback)
        void watch.addTime(video.id, video.title, amount).catch(report);
    }
    function leave() {
      pause();
      recordWatch();
    }
    const playing = () => {
      for (const other of document.querySelectorAll('video')) {
        if (other !== element) other.pause();
      }
      if (playingSince === undefined) playingSince = performance.now();
    };
    const pause = () => {
      stopClock();
      flush();
    };
    const timeupdate = () => {
      if (performance.now() - lastSaved >= 5000) flush();
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
  }, [video.id, sourceUrl === '']);
  useEffect(() => {
    async function visibilityChanged() {
      const element = player.current;
      if (!document.hidden || !element || element.paused) return;
      if (document.pictureInPictureElement === element) return;
      if (settings.autoPictureInPicture && document.pictureInPictureEnabled) {
        try {
          await element.requestPictureInPicture();
          return;
        } catch {}
      }
      element.pause();
    }
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => document.removeEventListener('visibilitychange', visibilityChanged);
  }, [settings.autoPictureInPicture]);
  useEffect(() => {
    const element = player.current;
    if (!element || !sourceUrl) return;
    const type = video.sources.find((item) => item.url === sourceUrl)?.type ?? '';
    const isHls = /\.m3u8(?:[?#]|$)/i.test(sourceUrl) || /(?:mpegurl|m3u8)/i.test(type);
    if (isHls && Hls.isSupported()) {
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, error) => {
        if (!error.fatal) return;
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
  }, [sourceUrl, playbackAttempt]);

  const nextFrame = frames.data?.find((position) => position >= positionMs);
  const frameCountdown = nextFrame === undefined ? undefined : nextFrame - positionMs;

  const source = video.sources.find((item) => item.url === sourceUrl);
  const speedOptions = [...new Set([0.5, 0.75, 1, 1.25, 1.5, 2, 3, speed])].sort((a, b) => a - b);

  async function loadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    const loadedSource = element.currentSrc;
    setPortraitHeight(isPortraitVideo(element) ? playerHeightLimit(window.innerHeight) : undefined);
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
    if (player.current !== element || loadedSource !== element.currentSrc) return;
    if (position > 0)
      element.currentTime = Number.isFinite(element.duration)
        ? Math.min(position, Math.max(0, element.duration - 0.1))
        : position;
    restored.current = true;
    switching.current = false;
    nextStart.current = undefined;
    if (shouldPlay) {
      try {
        await element.play();
      } catch (error) {
        if (element.currentSrc !== loadedSource || player.current !== element) return;
        if ((error as Error).name === 'NotAllowedError')
          setPlaybackError(tr('自动播放未开始，请点击播放器中的播放按钮。'));
        else if ((error as Error).name !== 'AbortError')
          setPlaybackError(tr('播放失败：{0}', (error as Error).message));
      }
    }
  }

  function changeSource(url: string) {
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

  function fullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void player.current!.parentElement!.requestFullscreen();
  }

  function changeSpeed(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const value = Number(event.target.value);
    setSpeed(value);
    player.current!.playbackRate = value;
  }

  function seek(seconds: number) {
    const element = player.current!;
    element.currentTime = Math.max(0, Math.min(element.duration, element.currentTime + seconds));
  }

  async function addKeyframe() {
    const element = player.current!;
    if (!element.paused) {
      setFrameNotice(tr('请先暂停播放再添加关键帧'));
      return;
    }
    const position = Math.round(element.currentTime * 1000);
    if (!(await confirmation.confirm(tr('将 {0} 秒添加为关键帧？', (position / 1000).toFixed(1)))))
      return;
    const added = await keyframes.add(video.id, position, video.title);
    setFrameNotice(added ? tr('关键帧已添加') : tr('与已有关键帧相隔不足 10 秒'));
    frames.refetch();
  }

  async function removeKeyframe(position: number) {
    await keyframes.remove(video.id, position);
    frames.refetch();
  }

  function jumpToKeyframe(position: number) {
    player.current!.currentTime = position / 1000;
    setFramesOpen(false);
  }

  function playbackEnded() {
    savePlayback.current();
    if (settings.autoPlayNext && !settings.loopPlayback) onNext?.();
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

  function playing() {
    setPlaybackError('');
    setBuffering(false);
  }

  if (!source) {
    return (
      <Alert severity="warning">
        <AlertTitle>{tr('暂无可用播放源')}</AlertTitle>
        {tr('可以刷新详情后重试。')}
      </Alert>
    );
  }

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={tr('视频播放器')}
      sx={{
        overflow: 'hidden',
        ...(windowFullscreen && {
          position: 'fixed',
          inset: 0,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
        }),
        '& > video': {
          width: '100%',
          display: 'block',
          aspectRatio: settings.videoAspectRatio === 'ratio4x3' ? '4 / 3' : '16 / 9',
          maxHeight: '70vh',
          background: '#000',
          objectFit:
            settings.videoAspectRatio === 'crop'
              ? 'cover'
              : settings.videoAspectRatio === 'stretch'
                ? 'fill'
                : 'contain',
          ...(windowFullscreen && {
            flex: '1 1 0',
            minHeight: 0,
            height: 0,
            maxHeight: 'none',
            aspectRatio: 'auto',
            objectFit: 'contain',
          }),
        },
        '&:fullscreen': { overflowY: 'auto' },
        '&:fullscreen > video': { height: 'calc(100vh - 100px)', maxHeight: 'none' },
      }}
    >
      <video
        ref={player}
        poster={video.coverUrl}
        controls
        playsInline
        preload="metadata"
        loop={settings.loopPlayback}
        style={
          portraitHeight && !windowFullscreen
            ? {
                height: portraitHeight,
              }
            : undefined
        }
        onLoadedMetadata={loadedMetadata}
        onPlaying={playing}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(event) => setPositionMs(event.currentTarget.currentTime * 1000)}
        onEnded={playbackEnded}
        onError={playbackFailed}
      />
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{
          alignItems: 'center',
          flexWrap: 'wrap',
          p: 2,
          ...(windowFullscreen && { flexShrink: 0, maxHeight: '40%', overflowY: 'auto' }),
        }}
      >
        <TextField
          select
          label={tr('清晰度')}
          value={sourceUrl}
          onChange={(event) => changeSource(event.target.value)}
          sx={{
            minWidth: 150,
            flex: 1,
          }}
        >
          {video.sources.map((item, index) => (
            <MenuItem key={`${item.url}-${index}`} value={item.url}>
              {item.quality === 'Default' ? tr('默认 {0}', index + 1) : item.quality}
              {/\.m3u8(?:\?|$)/i.test(item.url) ? ' · HLS' : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={tr('速度')}
          value={speed}
          onChange={changeSpeed}
          sx={{
            minWidth: 110,
          }}
        >
          {speedOptions.map((value) => (
            <MenuItem key={value} value={value}>
              {value}×
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={() => seek(-settings.skipSeconds)}>
          {tr('后退')}
          {settings.skipSeconds}
          {tr('秒')}
        </Button>
        <Button onClick={() => seek(settings.skipSeconds)}>
          {tr('快进')}
          {settings.skipSeconds}
          {tr('秒')}
        </Button>
        {settings.keyframesEnabled && (
          <>
            <Button onClick={() => setFramesOpen(true)}>{tr('关键帧')}</Button>
            <Button onClick={addKeyframe}>{tr('添加关键帧')}</Button>
          </>
        )}
        <Button
          startIcon={<FitScreenIcon />}
          aria-pressed={windowFullscreen}
          onClick={() => setWindowFullscreen((value) => !value)}
        >
          {tr(windowFullscreen ? '退出窗口内全屏' : '窗口内全屏')}
        </Button>
        <Button onClick={fullscreen}>{tr('全屏')}</Button>
        <Button onClick={() => window.electron.openExternal(source.url)}>{tr('外部播放')}</Button>
        <TextField
          select
          label={tr('画面比例')}
          value={settings.videoAspectRatio}
          onChange={(event) =>
            saveSettings({
              videoAspectRatio: event.target.value as typeof settings.videoAspectRatio,
            })
          }
        >
          {['auto', 'crop', 'stretch', 'ratio4x3'].map((value, index) => (
            <MenuItem key={value} value={value}>
              {tr(['自动', '裁剪', '拉伸', '4:3'][index])}
            </MenuItem>
          ))}
        </TextField>
        {onNext && (
          <Button variant="outlined" startIcon={<SkipNextIcon />} onClick={onNext}>
            {tr('下一集')}
          </Button>
        )}
      </Stack>
      {fullscreenOpen &&
        settings.keyframesEnabled &&
        frameCountdown !== undefined &&
        frameCountdown <= 10000 && (
          <Alert severity="info">
            {tr('距下一个关键帧 {0} 秒', (frameCountdown / 1000).toFixed(1))}
          </Alert>
        )}
      {frameNotice && <Alert severity="info">{frameNotice}</Alert>}
      <Dialog open={framesOpen} onClose={() => setFramesOpen(false)}>
        <DialogTitle>{tr('关键帧')}</DialogTitle>
        <DialogContent>
          <List>
            {frames.data?.map((position) => (
              <ListItem key={position}>
                <ListItemText primary={tr('{0} 秒', position / 1000)} />
                <Button onClick={() => jumpToKeyframe(position)}>{tr('跳转')}</Button>
                <Button onClick={() => removeKeyframe(position)}>{tr('删除')}</Button>
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
      {confirmation.dialog}
      {stuck && (
        <Alert severity="info" action={<Button onClick={retryPlayback}>{tr('重试播放')}</Button>}>
          {tr('正在缓冲…')}
        </Alert>
      )}
      {playbackError && (
        <Alert
          severity="warning"
          sx={{
            m: 2,
            mt: 0,
          }}
          action={
            <Button startIcon={<ReplayIcon />} onClick={retryPlayback}>
              {tr('重试播放')}
            </Button>
          }
        >
          {tr(playbackError)}
        </Alert>
      )}
    </Paper>
  );
}
