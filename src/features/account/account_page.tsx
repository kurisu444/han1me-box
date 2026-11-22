import { useI18n } from '../../app/i18n';
import { useConfirmation } from '../shared/use_confirmation';
import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAccount } from './account_controller';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { siteEndpointUrl } from '../../core/site_url';
import * as api from '../../data/remote/account_api';
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
      if (completed) await controller.saveCookie(await window.electron.session.cookies(base));
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
    if (await confirm.confirm(tr('确认退出登录？'))) await controller.logout();
  }

  async function profile() {
    if (!account?.id || !account.csrfToken) return;
    await run(async () => {
      await api.updateProfile(base, account!.id!, account!.csrfToken!, name.trim(), email.trim());
      await controller.refresh();
    });
  }

  async function openProfile() {
    if (!account?.id) return;
    await window.electron.session.profile(siteEndpointUrl(base, `user/${account.id}/edit`));
    await controller.refresh();
  }

  async function changePassword() {
    if (!account?.id || !account.csrfToken) return;
    await run(() =>
      api.updatePassword(
        base,
        account!.id!,
        account!.csrfToken!,
        oldPassword,
        password,
        confirmation,
      ),
    );
  }

  return (
    <Stack
      spacing={2}
      sx={{
        maxWidth: 800,
        mx: 'auto',
      }}
    >
      <Typography variant="h4">{tr('账号')}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {account && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
          }}
        >
          <Stack spacing={2}>
            <IconButton
              onClick={openProfile}
              aria-label={tr('账号资料')}
              sx={{ alignSelf: 'start' }}
            >
              <Avatar src={account.avatarUrl} />
            </IconButton>
            <Typography variant="h5">{account.name}</Typography>
            <Typography>
              {account.email} · {account.joinedLabel}
            </Typography>
            <Typography>
              {account.subscriberCount ?? 0}
              {tr('位订阅者 ·')}
              {account.videoCount ?? 0}
              {tr('个视频')}
            </Typography>
            <Button onClick={controller.refresh}>{tr('刷新资料')}</Button>
            <Button onClick={logout}>{tr('退出登录')}</Button>
            <Divider />
            <TextField
              label={tr('昵称')}
              placeholder={account.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              label={tr('邮箱')}
              placeholder={account.email}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button disabled={busy} onClick={profile}>
              {tr('保存资料')}
            </Button>
            <TextField
              type="password"
              label={tr('旧密码')}
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
            />
            <TextField
              type="password"
              label={tr('新密码')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <TextField
              type="password"
              label={tr('确认新密码')}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <Button
              disabled={busy || !password || password !== confirmation}
              onClick={changePassword}
            >
              {tr('修改密码')}
            </Button>
          </Stack>
        </Paper>
      )}
      <Button variant="contained" disabled={busy} onClick={login}>
        {tr('网页登录 / 添加账号')}
      </Button>
      <TextField
        label={tr('手动导入 Cookie')}
        multiline
        value={cookie}
        onChange={(event) => setCookie(event.target.value)}
      />
      <Button disabled={busy || !cookie.trim()} onClick={importCookie}>
        {tr('导入')}
      </Button>
      <List>
        {controller.accounts.map((item) => (
          <ListItem
            key={item.id}
            secondaryAction={<Button onClick={() => controller.remove(item)}>{tr('移除')}</Button>}
          >
            <ListItemText
              primary={item.name ?? item.id}
              secondary={item.id === account?.id ? tr('当前账号') : undefined}
            />
            <Button disabled={item.id === account?.id} onClick={() => controller.activate(item)}>
              {tr('切换')}
            </Button>
          </ListItem>
        ))}
      </List>
      {confirm.dialog}
    </Stack>
  );
}
