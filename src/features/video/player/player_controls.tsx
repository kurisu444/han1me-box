import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PictureInPictureAltRoundedIcon from '@mui/icons-material/PictureInPictureAltRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import VolumeDownRoundedIcon from '@mui/icons-material/VolumeDownRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { Box, Button, IconButton, Slider, Stack, Tooltip, Typography } from '@mui/material';
import { useI18n } from '../../../app/i18n';

const barButtonSx = {
  color: 'rgba(255, 255, 255, 0.88)',
  minWidth: 'auto',
  px: 0.9,
  py: 0.35,
  fontSize: 12,
  fontWeight: 500,
  borderRadius: '6px',
  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.14)', color: '#fff' },
};

const barIconSx = {
  color: 'rgba(255, 255, 255, 0.88)',
  p: 0.65,
  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.14)', color: '#fff' },
};

export function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface PlayerControlsProps {
  visible: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  volume: number;
  muted: boolean;
  speed: number;
  qualityLabel: string;
  aspectLabel: string;
  fullscreen: boolean;
  pipSupported: boolean;
  keyframesEnabled: boolean;
  keyframes: number[];
  hasNext: boolean;
  onTogglePlay: () => void;
  onSeekTo: (seconds: number) => void;
  onNext?: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onOpenQuality: (event: MouseEvent<HTMLElement>) => void;
  onOpenSpeed: (event: MouseEvent<HTMLElement>) => void;
  onOpenAspect: (event: MouseEvent<HTMLElement>) => void;
  onOpenKeyframes: () => void;
  onAddKeyframe: () => void;
  onJumpKeyframe: (positionMs: number) => void;
  onTogglePip: () => void;
  onToggleFullscreen: () => void;
  onHoverChange: (hovering: boolean) => void;
}

export function PlayerControls({
  visible,
  playing,
  currentTime,
  duration,
  bufferedEnd,
  volume,
  muted,
  speed,
  qualityLabel,
  aspectLabel,
  fullscreen,
  pipSupported,
  keyframesEnabled,
  keyframes,
  hasNext,
  onTogglePlay,
  onSeekTo,
  onNext,
  onVolumeChange,
  onToggleMute,
  onOpenQuality,
  onOpenSpeed,
  onOpenAspect,
  onOpenKeyframes,
  onAddKeyframe,
  onJumpKeyframe,
  onTogglePip,
  onToggleFullscreen,
  onHoverChange,
}: PlayerControlsProps) {
  const tr = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingRatio, setDraggingRatio] = useState<number | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const displayRatio =
    draggingRatio ?? (safeDuration > 0 ? Math.min(1, Math.max(0, currentTime / safeDuration)) : 0);
  const bufferedRatio = safeDuration > 0 ? Math.min(1, Math.max(0, bufferedEnd / safeDuration)) : 0;

  function ratioFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!safeDuration) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const ratio = ratioFromClientX(event.clientX);
    setDraggingRatio(ratio);
    onSeekTo(ratio * safeDuration);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const ratio = ratioFromClientX(event.clientX);
    setHoverRatio(ratio);
    if (draggingRatio !== null && safeDuration) {
      setDraggingRatio(ratio);
      onSeekTo(ratio * safeDuration);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (draggingRatio !== null) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDraggingRatio(null);
    }
  }

  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon =
    effectiveVolume === 0
      ? VolumeOffRoundedIcon
      : effectiveVolume < 0.5
        ? VolumeDownRoundedIcon
        : VolumeUpRoundedIcon;

  return (
    <Box
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      sx={{
        position: 'absolute',
        inset: 'auto 0 0',
        zIndex: 4,
        pt: 5,
        pb: 1,
        px: 1.75,
        background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.85))',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 180ms ease',
        userSelect: 'none',
      }}
    >
      {/* 自定义进度条 + 关键帧圆点标记 */}
      <Box
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setHoverRatio(null)}
        sx={{
          position: 'relative',
          height: 18,
          display: 'flex',
          alignItems: 'center',
          cursor: safeDuration ? 'pointer' : 'default',
          mb: 0.5,
          '&:hover .player-rail': { height: 5 },
          '&:hover .player-thumb': { transform: 'translate(-50%, -50%) scale(1)' },
        }}
      >
        {hoverRatio !== null && safeDuration > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 20,
              left: `${Math.min(96, Math.max(4, hoverRatio * 100))}%`,
              transform: 'translateX(-50%)',
              px: 0.9,
              py: 0.25,
              borderRadius: '6px',
              bgcolor: 'rgba(18, 18, 24, 0.92)',
              color: '#fff',
              fontSize: 11.5,
              fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {formatPlayerTime(hoverRatio * safeDuration)}
          </Box>
        )}

        <Box
          className="player-rail"
          sx={{
            position: 'relative',
            width: '100%',
            height: draggingRatio !== null ? 5 : 3.5,
            borderRadius: 999,
            bgcolor: 'rgba(255, 255, 255, 0.18)',
            transition: 'height 120ms ease',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: '0 auto 0 0',
              width: `${bufferedRatio * 100}%`,
              borderRadius: 999,
              bgcolor: 'rgba(255, 255, 255, 0.34)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: '0 auto 0 0',
              width: `${displayRatio * 100}%`,
              borderRadius: 999,
              bgcolor: 'rgba(255, 255, 255, 0.95)',
            }}
          />
          {keyframesEnabled &&
            safeDuration > 0 &&
            keyframes.map((positionMs) => {
              const pct = Math.min(100, Math.max(0, (positionMs / 1000 / safeDuration) * 100));
              return (
                <Tooltip
                  key={positionMs}
                  title={`${tr('关键帧')} · ${formatPlayerTime(positionMs / 1000)}`}
                  placement="top"
                >
                  <Box
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onJumpKeyframe(positionMs);
                    }}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: `${pct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 8,
                      height: 8,
                      borderRadius: '999px',
                      bgcolor: '#fbbf24',
                      boxShadow: '0 0 0 1.5px rgba(0, 0, 0, 0.55)',
                      cursor: 'pointer',
                      zIndex: 2,
                      transition: 'transform 120ms ease',
                      '&:hover': { transform: 'translate(-50%, -50%) scale(1.45)' },
                    }}
                  />
                </Tooltip>
              );
            })}
        </Box>

        <Box
          className="player-thumb"
          sx={{
            position: 'absolute',
            top: '50%',
            left: `${displayRatio * 100}%`,
            transform:
              draggingRatio !== null
                ? 'translate(-50%, -50%) scale(1)'
                : 'translate(-50%, -50%) scale(0)',
            width: 13,
            height: 13,
            borderRadius: '999px',
            bgcolor: '#fff',
            boxShadow: '0 1px 6px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            transition: 'transform 120ms ease',
            zIndex: 3,
          }}
        />
      </Box>

      {/* 单行一体化底部控制栏 */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
      >
        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Tooltip title={tr(playing ? '暂停' : '播放')}>
            <IconButton
              size="small"
              aria-label={tr(playing ? '暂停' : '播放')}
              onClick={onTogglePlay}
              sx={barIconSx}
            >
              {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
            </IconButton>
          </Tooltip>
          {hasNext && onNext && (
            <Tooltip title={tr('下一集')}>
              <IconButton size="small" aria-label={tr('下一集')} onClick={onNext} sx={barIconSx}>
                <SkipNextRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
          <Typography
            component="span"
            sx={{
              ml: 0.75,
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.85)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {formatPlayerTime(draggingRatio !== null ? draggingRatio * safeDuration : currentTime)}{' '}
            / {formatPlayerTime(safeDuration)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {keyframesEnabled && (
            <>
              <Button
                size="small"
                startIcon={<BookmarksOutlinedIcon sx={{ fontSize: '15px !important' }} />}
                onClick={onOpenKeyframes}
                sx={barButtonSx}
              >
                {tr('关键帧')}
                {keyframes.length ? ` (${keyframes.length})` : ''}
              </Button>
              <Tooltip title={tr('添加关键帧')}>
                <IconButton
                  size="small"
                  aria-label={tr('添加关键帧')}
                  onClick={onAddKeyframe}
                  sx={barIconSx}
                >
                  <BookmarkAddOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Button size="small" onClick={onOpenQuality} sx={barButtonSx}>
            {qualityLabel}
          </Button>
          <Button size="small" onClick={onOpenSpeed} sx={barButtonSx}>
            {speed}×
          </Button>
          <Tooltip title={tr('画面比例')}>
            <Button
              size="small"
              startIcon={<AspectRatioIcon sx={{ fontSize: '15px !important' }} />}
              onClick={onOpenAspect}
              sx={barButtonSx}
            >
              {aspectLabel}
            </Button>
          </Tooltip>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', px: 0.5, display: { xs: 'none', sm: 'flex' } }}
          >
            <Tooltip title={tr(effectiveVolume === 0 ? '取消静音' : '静音')}>
              <IconButton
                size="small"
                aria-label={tr(effectiveVolume === 0 ? '取消静音' : '静音')}
                onClick={onToggleMute}
                sx={barIconSx}
              >
                <VolumeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Slider
              size="small"
              aria-label={tr('音量')}
              min={0}
              max={1}
              step={0.02}
              value={effectiveVolume}
              onChange={(_event, val) => onVolumeChange(val as number)}
              sx={{
                width: 64,
                color: '#fff',
                '& .MuiSlider-thumb': { width: 10, height: 10 },
                '& .MuiSlider-rail': { opacity: 0.3 },
              }}
            />
          </Stack>
          {pipSupported && (
            <Tooltip title={tr('画中画')}>
              <IconButton
                size="small"
                aria-label={tr('画中画')}
                onClick={onTogglePip}
                sx={barIconSx}
              >
                <PictureInPictureAltRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={tr(fullscreen ? '退出全屏' : '全屏')}>
            <IconButton
              size="small"
              aria-label={tr(fullscreen ? '退出全屏' : '全屏')}
              onClick={onToggleFullscreen}
              sx={barIconSx}
            >
              {fullscreen ? (
                <FullscreenExitIcon fontSize="small" />
              ) : (
                <FullscreenIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}
