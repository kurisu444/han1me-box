import { useEffect, type RefObject } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSettings } from '../../app/settings_context';
import { isPlayerWindow } from './player_window';

export function usePlayerKeyboard(
  player: RefObject<HTMLVideoElement | null>,
  exitWideMode?: () => void,
) {
  const settings = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previousSpeed: number | undefined;

    function seek(seconds: number) {
      const video = player.current!;
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
      }
    }

    function release() {
      clearTimeout(timer);
      timer = undefined;
      if (previousSpeed !== undefined && player.current) {
        player.current.playbackRate = previousSpeed;
      }
      previousSpeed = undefined;
    }

    function down(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [role="menu"]',
        )
      ) {
        return;
      }
      if (event.key === 'Escape' && exitWideMode && !document.fullscreenElement) {
        exitWideMode();
        event.preventDefault();
        return;
      }
      const video = player.current;
      if (!video || !video.readyState) {
        return;
      }
      switch (event.key) {
        case 'ArrowLeft':
          seek(-settings.skipSeconds);
          break;
        case 'ArrowRight':
          if (!event.repeat && !timer && previousSpeed === undefined) {
            timer = setTimeout(() => {
              timer = undefined;
              if (video.paused) {
                return;
              }
              previousSpeed = video.playbackRate;
              video.playbackRate = settings.longPressPlaybackSpeed;
            }, 450);
          }
          break;
        case 'ArrowUp':
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'f':
        case 'F':
          if (!event.repeat) {
            void (document.fullscreenElement
              ? document.exitFullscreen()
              : video.closest('[data-player-stage]')?.requestFullscreen());
          }
          break;
        case 'Escape':
          if (isPlayerWindow()) {
            void window.electron.player.focusMain();
          } else {
            navigate(params.get('home') ?? '/');
          }
          break;
        case ' ':
        case 'Enter':
        case 'MediaPlayPause':
        case 'MediaPlay':
        case 'MediaPause':
          if (target.closest('button, a')) {
            return;
          }
          if (video.paused) {
            void video.play();
          } else {
            video.pause();
          }
          break;
        default:
          return;
      }
      event.preventDefault();
    }

    function up(event: KeyboardEvent) {
      if (event.key !== 'ArrowRight') {
        return;
      }
      const pending = timer !== undefined;
      release();
      if (pending) {
        seek(settings.skipSeconds);
      }
    }

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      release();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, [
    player,
    settings.skipSeconds,
    settings.longPressPlaybackSpeed,
    navigate,
    params,
    exitWideMode,
  ]);
}
