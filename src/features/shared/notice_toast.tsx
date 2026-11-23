import { Box, Fade, Snackbar } from '@mui/material';

export interface NoticeMessage {
  id: number;
  text: string;
}

export function NoticeToast({
  notice,
  onClose,
}: {
  notice: NoticeMessage | null;
  onClose: () => void;
}) {
  return (
    <Snackbar
      key={notice?.id}
      open={Boolean(notice)}
      autoHideDuration={2400}
      onClose={onClose}
      slots={{ transition: Fade }}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: 'calc(var(--titlebar-height) + 20px) !important', pointerEvents: 'none' }}
    >
      <Box
        sx={{
          px: 2.75,
          py: 1.1,
          borderRadius: '999px',
          bgcolor: 'rgba(20, 20, 26, 0.9)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          fontSize: 13.5,
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
        }}
      >
        {notice?.text}
      </Box>
    </Snackbar>
  );
}
