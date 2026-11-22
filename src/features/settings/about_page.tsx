import { useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import * as logs from '../../core/logging/app_log';
import { useI18n } from '../../app/i18n';
import { version } from '../../../package.json';
import logo from '../../../assets/logo.png';

export function AboutPage() {
  const tr = useI18n();
  const navigate = useNavigate();
  const [versionTaps, setVersionTaps] = useState(0);

  function onVersionTap() {
    const next = versionTaps + 1;
    setVersionTaps(next === 5 ? 0 : next);
    if (next === 5) navigate('/settings/logs');
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 800, mx: 'auto' }}>
      <Box component="img" src={logo} alt="Han1meBox" sx={{ width: 72, borderRadius: 2 }} />
      <Typography variant="h4">Han1meBox</Typography>
      <Typography>{tr('第三方客户端')}</Typography>
      <Button onClick={onVersionTap}>
        {tr('版本')} {version}
      </Button>
      <Typography>{tr('数据来源：内容来自站点，应用仅提供浏览功能。')}</Typography>
    </Stack>
  );
}

export function DebugLogPage() {
  const tr = useI18n();
  const entries = useSyncExternalStore(logs.subscribe, logs.getEntries, logs.getEntries);
  const [, refresh] = useState(0);
  const [notice, setNotice] = useState('');

  function clear() {
    logs.clear();
    setNotice(tr('日志已清空'));
  }
  async function copy() {
    await navigator.clipboard.writeText(logs.exportLogs());
    setNotice(tr('日志已复制'));
  }
  async function share() {
    if (navigator.share) await navigator.share({ title: tr('诊断日志'), text: logs.exportLogs() });
    else await copy();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('诊断日志')}</Typography>
      <Stack direction="row" spacing={1}>
        <Button onClick={() => refresh((value) => value + 1)}>{tr('刷新')}</Button>
        <Button onClick={clear}>{tr('清空')}</Button>
        <Button onClick={copy}>{tr('复制')}</Button>
        <Button onClick={share}>{tr('分享')}</Button>
      </Stack>
      <Typography>{tr('请求日志：{0} 条', entries.length)}</Typography>
      {notice && <Alert severity="success">{notice}</Alert>}
      <Box sx={{ fontFamily: 'monospace', fontSize: '0.8rem', overflowWrap: 'anywhere' }}>
        {entries.map((entry, index) => (
          <Box key={index} sx={{ py: 0.5 }}>
            {logs.displayLine(entry)}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
