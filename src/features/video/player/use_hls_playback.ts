import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import Hls from 'hls.js';
import { useI18n } from '../../../app/i18n';
import { useSettings } from '../../../app/settings_context';
import type { VideoDetail } from '../../../domain/models/video';
import * as watch from '../../../data/local/watch_repository';
import { usePlaybackHistory } from './use_playback_history';
import { preferredSource, resumePosition } from '../video_helpers';

export function useHlsPlayback(
  video: VideoDetail,
  player: RefObject<HTMLVideoElement | null>,
  savePlayback: RefObject<() => void>,
  speed: number,
) {
  const tr = useI18n();
  const settings = useSettings();
  const selectedQuality = useRef<number | undefined>(undefined);
  const restored = useRef(false);
  const switching = useRef(false);
  const nextStart = useRef<{ position: number; playing: boolean } | undefined>(undefined);
  const [sourceUrl, setSourceUrl] = useState(
    () => preferredSource(video.sources, settings.preferredQuality)?.url ?? '',
  );
  const [playbackError, setPlaybackError] = useState('');
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [buffering, setBuffering] = useState(false);
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
  }, [video.sources, settings.preferredQuality, sourceUrl, player, savePlayback]);

  // 卸载时先保存进度，再清理下方 effect 中的播放源。
  usePlaybackHistory(video, player, sourceUrl, switching, savePlayback);

  const playbackRequest = useMemo(
    () => ({ url: sourceUrl, attempt: playbackAttempt }),
    [sourceUrl, playbackAttempt],
  );
  const reportHlsError = useEffectEvent(() => {
    setBuffering(false);
    setPlaybackError(tr('视频加载中断，请重试或切换播放源。'));
  });

  useEffect(() => {
    const sourceUrl = playbackRequest.url;
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
        reportHlsError();
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
  }, [playbackRequest, video.sources, player]);

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
    if (url === sourceUrl) {
      return;
    }
    const element = player.current;
    if (!element) {
      return;
    }
    selectedQuality.current = Number(
      /\d+/.exec(video.sources.find((item) => item.url === url)?.quality ?? '')?.[0] ??
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

  function playbackFailed(event: SyntheticEvent<HTMLVideoElement>) {
    setBuffering(false);
    if (event.currentTarget.error?.code === 4) {
      setPlaybackError(tr('播放器无法加载此播放源，可能是格式不支持或地址已失效。'));
    } else {
      setPlaybackError(tr('视频加载中断，请重试或切换播放源。'));
    }
  }

  function retryPlayback() {
    const element = player.current;
    if (!element) {
      return;
    }
    savePlayback.current();
    nextStart.current = {
      position: nextStart.current?.position ?? element.currentTime,
      playing: !element.paused,
    };
    switching.current = true;
    setPlaybackError('');
    setPlaybackAttempt((value) => value + 1);
  }

  return {
    sourceUrl,
    switching,
    playbackError,
    setPlaybackError,
    buffering,
    setBuffering,
    loadedMetadata,
    changeSource,
    playbackFailed,
    retryPlayback,
  };
}
