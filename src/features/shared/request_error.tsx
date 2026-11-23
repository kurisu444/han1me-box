import { useI18n } from '../../app/i18n';
import { useState } from 'react';
import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { CloudflareChallengeException } from '../../data/remote/han1me_api';
import { LoadingIndicator } from './loading_indicator';

export function RequestError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const tr = useI18n();
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const challenged = error instanceof CloudflareChallengeException;

  async function verify() {
    setVerifying(true);
    setVerificationError('');
    try {
      await window.electron.session.verify((error as CloudflareChallengeException).url);
      onRetry();
    } catch (cause) {
      setVerificationError((cause as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Alert
      severity={challenged ? 'warning' : 'error'}
      sx={{
        my: 2,
        overflowWrap: 'anywhere',
      }}
    >
      <AlertTitle>{challenged ? tr('网站需要浏览器验证') : tr('加载失败')}</AlertTitle>
      <Typography
        variant="body2"
        sx={{
          mb: 2,
        }}
      >
        {challenged
          ? tr('验证成功后会自动返回应用并重试；也可点击“返回应用”结束验证。')
          : error.message}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{
          flexWrap: 'wrap',
        }}
      >
        {challenged && (
          <Button
            onClick={verify}
            disabled={verifying}
            variant="contained"
            startIcon={<VerifiedUserOutlinedIcon />}
          >
            {verifying ? tr('等待验证完成…') : tr('开始验证')}
          </Button>
        )}
        <Button onClick={onRetry} disabled={verifying} startIcon={<RefreshIcon />}>
          {tr('重试')}
        </Button>
      </Stack>
      {verificationError && (
        <Typography
          sx={{
            mt: 2,
          }}
        >
          {verificationError}
        </Typography>
      )}
    </Alert>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <Stack role="status" spacing={1.5} sx={{ alignItems: 'center', py: 6 }}>
      <LoadingIndicator size="md" label={label} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
