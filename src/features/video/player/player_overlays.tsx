import { Alert, Box, Button, Fade, Stack } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { useI18n } from '../../../app/i18n';
import { NoticeToast, type NoticeMessage } from '../../shared/notice_toast';
import { LoadingIndicator } from '../../shared/loading_indicator';

export function PlayerOverlays({
  buffering,
  playbackError,
  volumeHud,
  frameNotice,
  onCloseNotice,
  frameCountdown,
  retryPlayback,
}: {
  buffering: boolean;
  playbackError: string;
  volumeHud: { open: boolean; percent: number };
  frameNotice: NoticeMessage | null;
  onCloseNotice: () => void;
  frameCountdown?: number;
  retryPlayback: () => void;
}) {
  const tr = useI18n();
  const showKeyframeCountdown = frameCountdown !== undefined;
  return (
    <>
      {buffering && !playbackError && (
        <Box sx={{ position: 'absolute', pointerEvents: 'none' }}>
          <LoadingIndicator size="lg" color="rgba(255, 255, 255, 0.9)" />
        </Box>
      )}
      <Fade in={volumeHud.open} timeout={{ enter: 100, exit: 240 }} unmountOnExit>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 3,
            pointerEvents: 'none',
            px: 2,
            py: 0.9,
            borderRadius: '6px',
            bgcolor: 'rgba(0, 0, 0, 0.72)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.4,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {tr('音量: {0}%', volumeHud.percent)}
        </Box>
      </Fade>
      <NoticeToast notice={frameNotice} onClose={onCloseNotice} />
      {(showKeyframeCountdown || playbackError) && (
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
            <Box
              sx={{
                px: 1.25,
                py: 0.5,
                bgcolor: 'rgba(0, 0, 0, 0.72)',
                borderRadius: '6px',
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {tr('距下一个关键帧 {0} 秒', (frameCountdown / 1000).toFixed(1))}
            </Box>
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
              {playbackError}
            </Alert>
          )}
        </Stack>
      )}
    </>
  );
}
