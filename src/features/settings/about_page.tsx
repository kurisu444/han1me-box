import { useState, useSyncExternalStore } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import DesktopWindowsOutlinedIcon from '@mui/icons-material/DesktopWindowsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, Chip, Divider, Paper, Stack, Typography, useTheme } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../../assets/logo.png';
import { version } from '../../../package.json';
import { useI18n } from '../../app/i18n';
import * as logs from '../../core/logging/app_log';
import { NoticeToast, type NoticeMessage } from '../shared/notice_toast';

export function AboutPage({
  embedded = false,
  onOpenLogs,
}: {
  embedded?: boolean;
  onOpenLogs?: () => void;
}) {
  const tr = useI18n();
  const navigate = useNavigate();
  const [versionTaps, setVersionTaps] = useState(0);

  function onVersionTap() {
    const next = versionTaps + 1;
    setVersionTaps(next === 5 ? 0 : next);
    if (next === 5) {
      if (onOpenLogs) {
        onOpenLogs();
      } else {
        navigate('/settings/logs');
      }
    }
  }

  const infoRows = [
    {
      icon: <BalanceOutlinedIcon fontSize="small" />,
      label: tr('开源许可'),
      value: 'GNU AGPL-3.0',
    },
    {
      icon: <DesktopWindowsOutlinedIcon fontSize="small" />,
      label: tr('运行环境'),
      value: 'Electron · React',
    },
    ...(onOpenLogs
      ? [
          {
            icon: <ReceiptLongOutlinedIcon fontSize="small" />,
            label: tr('诊断日志'),
            value: tr('查看'),
            onClick: onOpenLogs,
          },
        ]
      : []),
  ];

  return (
    <Stack spacing={2.5} sx={embedded ? undefined : { maxWidth: 760, mx: 'auto' }}>
      {!embedded && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button component={Link} to="/settings" startIcon={<ArrowBackIcon />} size="small">
            {tr('返回')}
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {tr('关于')}
          </Typography>
        </Stack>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
        <Stack direction="row" spacing={2.25} sx={{ alignItems: 'center' }}>
          <Box
            component="img"
            src={logo}
            alt="Han1meBox"
            sx={{ width: 60, height: 60, borderRadius: '14px', flexShrink: 0 }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Han1meBox
              </Typography>
              <Chip
                label={`v${version}`}
                size="small"
                color="primary"
                variant="outlined"
                onClick={onVersionTap}
                sx={{
                  height: 22,
                  fontSize: 12,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  cursor: 'pointer',
                }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {tr('第三方客户端')}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
        {infoRows.map((row, index) => (
          <Box key={row.label}>
            {index > 0 && <Divider />}
            <Stack
              direction="row"
              spacing={1.5}
              onClick={row.onClick}
              sx={{
                px: 2.25,
                py: 1.5,
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: row.onClick ? 'pointer' : undefined,
                '&:hover': row.onClick ? { bgcolor: 'action.hover' } : undefined,
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                <Box sx={{ color: 'text.secondary', display: 'flex' }}>{row.icon}</Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {row.label}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                color={row.onClick ? 'primary.main' : 'text.secondary'}
                sx={{ fontWeight: row.onClick ? 600 : 400 }}
              >
                {row.value}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: '12px',
          bgcolor: 'action.hover',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
          <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.15 }} />
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {tr('数据来源：内容来自站点，应用仅提供浏览功能。')}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}

function logTone(entry: logs.AppLogEntry): 'error' | 'warning' | 'success' | 'default' {
  if (entry.statusCode == null) {
    return /fail|error|err_/i.test(entry.message) ? 'error' : 'default';
  }
  if (entry.statusCode >= 400) {
    return 'error';
  }
  if (entry.statusCode >= 300) {
    return 'warning';
  }
  return 'success';
}

export function DebugLogPage({ embedded = false }: { embedded?: boolean }) {
  const tr = useI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const entries = useSyncExternalStore(logs.subscribe, logs.getEntries, logs.getEntries);
  const [, refresh] = useState(0);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  function showNotice(text: string) {
    setNotice({ id: Date.now(), text });
  }

  function clear() {
    logs.clear();
    showNotice(tr('日志已清空'));
  }

  async function copy() {
    await navigator.clipboard.writeText(logs.exportLogs());
    showNotice(tr('日志已复制'));
  }

  return (
    <Stack spacing={2} sx={embedded ? undefined : { maxWidth: 860, mx: 'auto' }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {!embedded && (
            <Button component={Link} to="/settings" startIcon={<ArrowBackIcon />} size="small">
              {tr('返回')}
            </Button>
          )}
          <Typography variant={embedded ? 'h6' : 'h5'} sx={{ fontWeight: 700 }}>
            {tr('诊断日志')}
          </Typography>
          <Chip
            label={tr('请求日志：{0} 条', entries.length)}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={() => refresh((value) => value + 1)}
          >
            {tr('刷新')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyOutlinedIcon fontSize="small" />}
            disabled={entries.length === 0}
            onClick={copy}
          >
            {tr('复制')}
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<DeleteSweepOutlinedIcon fontSize="small" />}
            disabled={entries.length === 0}
            onClick={clear}
          >
            {tr('清空')}
          </Button>
        </Stack>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          borderRadius: '12px',
          bgcolor: isDark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.025)',
          overflow: 'hidden',
        }}
      >
        {entries.length > 0 ? (
          <Box
            sx={{
              maxHeight: '58vh',
              minHeight: 280,
              overflowY: 'auto',
              p: 1.5,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 12,
              lineHeight: 1.6,
              fontVariantNumeric: 'tabular-nums',
              overflowWrap: 'anywhere',
            }}
          >
            {entries.map((entry, index) => {
              const tone = logTone(entry);
              const color =
                tone === 'error'
                  ? 'error.main'
                  : tone === 'warning'
                    ? 'warning.main'
                    : tone === 'success'
                      ? 'text.primary'
                      : 'text.secondary';
              return (
                <Box
                  key={`${entry.timestamp}-${index}`}
                  sx={{
                    px: 1,
                    py: 0.4,
                    borderRadius: '6px',
                    color,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {logs.displayLine(entry)}
                </Box>
              );
            })}
          </Box>
        ) : (
          <Stack
            spacing={1}
            sx={{
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            <ReceiptLongOutlinedIcon sx={{ fontSize: 32, opacity: 0.5 }} />
            <Typography variant="body2">{tr('暂无请求日志')}</Typography>
          </Stack>
        )}
      </Paper>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
    </Stack>
  );
}
