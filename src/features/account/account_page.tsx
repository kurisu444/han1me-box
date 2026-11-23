import { useEffect, useState, type ReactNode } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoginIcon from '@mui/icons-material/Login';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
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
import { NoticeToast, type NoticeMessage } from '../shared/notice_toast';
import { useConfirmation } from '../shared/use_confirmation';
import { useAccount } from './account_controller';

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '200px minmax(0, 1fr)',
        gap: 3,
        py: 2.75,
        alignItems: 'start',
        '@media (max-width:680px)': {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 1.5,
        },
      }}
    >
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}
          >
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export function AccountPage() {
  const tr = useI18n();
  const controller = useAccount();
  const confirm = useConfirmation();
  const settings = useSettings();
  const [cookie, setCookie] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
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

  async function run(action: () => Promise<void>, successMessage?: string) {
    setBusy(true);
    setError('');
    try {
      await action();
      if (successMessage) {
        setNotice({ id: Date.now(), text: successMessage });
      }
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
    await run(async () => {
      await controller.saveCookie(cookie.trim());
      setCookie('');
    }, tr('已保存'));
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
    }, tr('已保存'));
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
    await run(async () => {
      await api.updatePassword(base, id, csrfToken, oldPassword, password, confirmation);
      setOldPassword('');
      setPassword('');
      setConfirmation('');
    }, tr('已保存'));
  }

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2.5 }}>
        <Button component={Link} to="/library" startIcon={<ArrowBackIcon />} size="small">
          {tr('返回')}
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {tr('账号管理')}
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {account ? (
        <Stack
          direction="row"
          spacing={2}
          sx={{
            py: 2.5,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Tooltip title={tr('账号资料')}>
              <IconButton onClick={openProfile} aria-label={tr('账号资料')} sx={{ p: 0 }}>
                <Avatar src={account.avatarUrl} sx={{ width: 56, height: 56 }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                {account.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
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
              startIcon={<RefreshIcon fontSize="small" />}
              onClick={controller.refresh}
              sx={{ borderRadius: '8px' }}
            >
              {tr('刷新资料')}
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<LogoutOutlinedIcon fontSize="small" />}
              onClick={logout}
              sx={{ borderRadius: '8px' }}
            >
              {tr('退出登录')}
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack
          direction="row"
          spacing={2}
          sx={{
            py: 3,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar
              sx={{ width: 52, height: 52, bgcolor: 'action.hover', color: 'text.secondary' }}
            >
              <PersonOutlineRoundedIcon sx={{ fontSize: 28 }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {tr('尚未登录账号')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tr('登录后可同步收藏、片单与订阅作者。')}
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<LoginIcon fontSize="small" />}
            disabled={busy}
            onClick={login}
            sx={{ borderRadius: '8px' }}
          >
            {tr('网页登录')}
          </Button>
        </Stack>
      )}

      {account && (
        <>
          <Divider />
          <FormSection title={tr('账号资料')}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  label={tr('昵称')}
                  placeholder={account.name}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  sx={{ flex: 1, minWidth: 180 }}
                />
                <TextField
                  size="small"
                  label={tr('邮箱')}
                  placeholder={account.email}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  sx={{ flex: 1, minWidth: 180 }}
                />
              </Stack>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={busy}
                  onClick={profile}
                  sx={{ borderRadius: '8px' }}
                >
                  {tr('保存资料')}
                </Button>
              </Box>
            </Stack>
          </FormSection>

          <Divider />
          <FormSection title={tr('修改密码')}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  type="password"
                  label={tr('旧密码')}
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  sx={{ flex: 1, minWidth: 160 }}
                />
                <TextField
                  size="small"
                  type="password"
                  label={tr('新密码')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  sx={{ flex: 1, minWidth: 160 }}
                />
                <TextField
                  size="small"
                  type="password"
                  label={tr('确认新密码')}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  sx={{ flex: 1, minWidth: 160 }}
                />
              </Stack>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={busy || !password || password !== confirmation}
                  onClick={changePassword}
                  sx={{ borderRadius: '8px' }}
                >
                  {tr('修改密码')}
                </Button>
              </Box>
            </Stack>
          </FormSection>
        </>
      )}

      <Divider />
      <FormSection title={tr('手动导入 Cookie')}>
        <Stack spacing={1.5}>
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
              sx={{ borderRadius: '8px' }}
            >
              {tr('导入')}
            </Button>
          </Box>
        </Stack>
      </FormSection>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      {confirm.dialog}
    </Box>
  );
}
