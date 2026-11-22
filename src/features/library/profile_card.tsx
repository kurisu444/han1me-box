import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import { Avatar, Box, Button, Card, Divider, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import type { Account } from '../../domain/models/account';

interface ProfileCardProps {
  account?: Account;
  onLogout: () => void;
}

export function ProfileCard({ account, onLogout }: ProfileCardProps) {
  const tr = useI18n();

  return (
    <Card sx={{ px: 2.5, py: 2, borderRadius: '12px' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Avatar src={account?.avatarUrl} sx={{ width: 60, height: 60 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {account?.name || tr(account ? '已登录' : '未登录')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {account?.id ? `@${account.id}` : tr('请先登录')}
            </Typography>
          </Box>
          {!account && (
            <Button component={Link} to="/account" variant="contained" size="small">
              {tr('登录')}
            </Button>
          )}
        </Stack>
        <Divider />
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            component={Link}
            to="/account"
            size="small"
            color="inherit"
            startIcon={<ManageAccountsOutlinedIcon fontSize="small" />}
            sx={{ color: 'text.secondary' }}
          >
            {tr('账号管理')}
          </Button>
          <Button
            component={Link}
            to="/stats"
            size="small"
            color="inherit"
            startIcon={<BarChartOutlinedIcon fontSize="small" />}
            sx={{ color: 'text.secondary' }}
          >
            {tr('统计')}
          </Button>
          {account && (
            <Button
              size="small"
              color="inherit"
              startIcon={<LogoutOutlinedIcon fontSize="small" />}
              onClick={onLogout}
              sx={{ color: 'text.secondary' }}
            >
              {tr('退出登录')}
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
