import { useEffect, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoginIcon from '@mui/icons-material/Login';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { siteEndpointUrl } from '../../core/site_url';
import * as api from '../../data/remote/account_api';
import { useConfirmation } from '../shared/use_confirmation';
import { useAccount } from './account_controller';

export function AccountPage() {
  const tr = useI18n();
  const controller = useAccount();
  const confirm = useConfirmation();
  const settings = useSettings();
  const [cookie, setCookie] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    setName(controller.account?.name ?? '');
    setEmail(controller.account?.email ?? '');
  }, [controller.account]);

  const base = resolvedBaseUrl(settings);
  const account = controller.account;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    await run(async () => {
      const completed = await window.electron.session.login(siteEndpointUrl(base, 'login'));
      if (completed) {
        await controller.saveCookie(await window.electron.session.cookies(base));
      }
    });
  }

  async function importCookie() {
    if (!cookie.trim() || !cookie.includes('=')) {
      setError(tr('无效的 Cookie'));
      return;
    }
    await run(() => controller.saveCookie(cookie.trim()));
  }

  async function logout() {
    if (await confirm.confirm(tr('确认退出登录？'))) {
      await controller.logout();
    }
  }

  async function profile() {
    if (!account?.id || !account.csrfToken) {
      return;
    }
    const { id, csrfToken } = account;
    await run(async () => {
      await api.updateProfile(base, id, csrfToken, name.trim(), email.trim());
      await controller.refresh();
    });
  }

  async function openProfile() {
    if (!account?.id) {
      return;
    }
    await window.electron.session.profile(siteEndpointUrl(base, `user/${account.id}/edit`));
    await controller.refresh();
  }

  async function changePassword() {
    if (!account?.id || !account.csrfToken) {
      return;
    }
    const { id, csrfToken } = account;
    await run(() => api.updatePassword(base, id, csrfToken, oldPassword, password, confirmation));
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 780, mx: 'auto' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button component={Link} to="/library" startIcon={<ArrowBackIcon />} size="small">
            {tr('返回')}
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {tr('账号管理')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          size="small"
          startIcon={<LoginIcon />}
          disabled={busy}
          onClick={login}
        >
          {tr('网页登录 / 添加账号')}
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {account && (
        <>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Tooltip title={tr('账号资料')}>
                  <IconButton onClick={openProfile} aria-label={tr('账号资料')} sx={{ p: 0 }}>
                    <Avatar src={account.avatarUrl} sx={{ width: 56, height: 56 }} />
                  </IconButton>
                </Tooltip>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {account.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[account.email, account.joinedLabel].filter(Boolean).join(' · ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {account.subscriberCount ?? 0}
                    {tr('位订阅者 ·')}
                    {account.videoCount ?? 0}
                    {tr('个视频')}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={controller.refresh}
                >
                  {tr('刷新资料')}
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<LogoutOutlinedIcon />}
                  onClick={logout}
                >
                  {tr('退出登录')}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
                {tr('账号资料')}
              </Typography>
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  label={tr('昵称')}
                  placeholder={account.name}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <TextField
                  size="small"
                  label={tr('邮箱')}
                  placeholder={account.email}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                />
              </Stack>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="outlined" size="small" disabled={busy} onClick={profile}>
                  {tr('保存资料')}
                </Button>
              </Box>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
                {tr('修改密码')}
              </Typography>
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  type="password"
                  label={tr('旧密码')}
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  sx={{ flex: 1, minWidth: 180 }}
                />
                <TextField
                  size="small"
                  type="password"
                  label={tr('新密码')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  sx={{ flex: 1, minWidth: 180 }}
                />
                <TextField
                  size="small"
                  type="password"
                  label={tr('确认新密码')}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  sx={{ flex: 1, minWidth: 180 }}
                />
              </Stack>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={busy || !password || password !== confirmation}
                  onClick={changePassword}
                >
                  {tr('修改密码')}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </>
      )}

      {controller.accounts.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
              {tr('已保存账号')}
            </Typography>
            {controller.accounts.map((item) => {
              const isCurrent = item.id === account?.id;
              return (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1.5}
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 0.75,
                    px: 1.5,
                    borderRadius: '8px',
                    bgcolor: isCurrent ? 'action.selected' : 'transparent',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Avatar src={item.avatarUrl} sx={{ width: 32, height: 32 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {item.name ?? item.id}
                    </Typography>
                    {isCurrent && <Chip label={tr('当前账号')} size="small" color="primary" />}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    {!isCurrent && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => controller.activate(item)}
                      >
                        {tr('切换')}
                      </Button>
                    )}
                    <Button size="small" color="error" onClick={() => controller.remove(item)}>
                      {tr('移除')}
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
            {tr('手动导入 Cookie')}
          </Typography>
          <TextField
            size="small"
            placeholder="remember_web=..."
            multiline
            minRows={2}
            value={cookie}
            onChange={(event) => setCookie(event.target.value)}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              size="small"
              disabled={busy || !cookie.trim()}
              onClick={importCookie}
            >
              {tr('导入')}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {confirm.dialog}
    </Stack>
  );
}
