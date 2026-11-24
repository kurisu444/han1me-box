import { useEffect, useRef, type RefObject } from 'react';
import { useSettings } from '../../../app/settings_context';
import * as watch from '../../../data/local/watch_repository';
import { parseVideoDuration, type VideoDetail } from '../../../domain/models/video';

export function usePlaybackHistory(
  video: VideoDetail,
  player: RefObject<HTMLVideoElement | null>,
  sourceUrl: string,
  switching: RefObject<boolean>,
  savePlayback: RefObject<() => void>,
) {
  const settings = useSettings();
  const preferences = useRef(settings);
  preferences.current = settings;
  const hasSource = sourceUrl !== '';

  useEffect(() => {
    const element = player.current;
    if (!element || !hasSource) {
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

    const flush = () => {
      if (switching.current || element.readyState === 0) {
        return;
      }
      if (playingSince !== undefined) {
        watchedMs += performance.now() - playingSince;
        playingSince = performance.now();
      }
      if (preferences.current.incognitoPlayback) {
        return;
      }
      const duration = Number.isFinite(element.duration)
        ? element.duration
        : (parseVideoDuration(video.duration) ?? 0);
      void watch
        .progress({
          id: video.id,
          title: video.title,
          coverUrl: video.coverUrl,
          positionMs: Math.round(element.currentTime * 1000),
          durationMs: Math.round(duration * 1000),
        })
        .catch(report);
      lastSaved = performance.now();
    };

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
  }, [
    video.id,
    video.title,
    video.coverUrl,
    video.duration,
    hasSource,
    player,
    switching,
    savePlayback,
  ]);
}
