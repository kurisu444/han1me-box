import { createContext, useContext, useState, type MouseEvent, type SyntheticEvent } from 'react';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import reasons from '../../../assets/search_options/report_reason.json';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import * as api from '../../data/remote/account_api';
import { searchLocale } from '../../data/search_option_catalog';
import type { Comment } from '../../domain/models/video';
import { useAccount } from '../account/account_controller';

export const CommentActionsContext = createContext({
  token: '',
  userId: '',
  reload: () => {},
});

function InlineComposer({
  placeholder,
  disabled,
  busy,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  disabled: boolean;
  busy: boolean;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const tr = useI18n();
  const [content, setContent] = useState('');

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled || busy) {
      return;
    }
    await onSubmit(trimmed);
    setContent('');
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        pl: 1.5,
        pr: 0.5,
        py: 0.4,
        borderRadius: '8px',
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'divider',
        '&:focus-within': { borderColor: 'primary.main' },
      }}
    >
      <InputBase
        fullWidth
        multiline
        maxRows={3}
        disabled={disabled || busy}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={placeholder}
        sx={{ fontSize: 12.5, py: 0.35 }}
      />
      {onCancel && (
        <Button
          size="small"
          color="inherit"
          onClick={onCancel}
          sx={{ minWidth: 'auto', px: 0.75, fontSize: 12, color: 'text.secondary' }}
        >
          {tr('取消')}
        </Button>
      )}
      <Tooltip title={tr('发送')}>
        <span>
          <IconButton
            type="submit"
            size="small"
            color="primary"
            aria-label={tr('发送')}
            disabled={disabled || busy || !content.trim()}
          >
            <SendRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

export function CommentComposer({ targetId, type = 'video' }: { targetId: string; type?: string }) {
  const tr = useI18n();
  const { account } = useAccount();
  const settings = useSettings();
  const { token, userId, reload } = useContext(CommentActionsContext);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!account) {
    return null;
  }

  const base = resolvedBaseUrl(settings);

  async function submit(text: string) {
    setBusy(true);
    setError('');
    try {
      await api.postComment(base, token, userId, type, targetId, text);
      reload();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={1}>
      <InlineComposer
        placeholder={tr('发一条评论…')}
        disabled={!token || !userId}
        busy={busy}
        onSubmit={submit}
      />
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}

export function CommentActions({ comment }: { comment: Comment }) {
  const tr = useI18n();
  const { account } = useAccount();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const { token, reload } = useContext(CommentActionsContext);
  const [replyOpen, setReplyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [reason, setReason] = useState(reasons[0].reason_key);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const base = resolvedBaseUrl(settings);
  const locale = searchLocale(settings.language, navigator.language);
  const selectedReason = reasons.find((item) => item.reason_key === reason) ?? reasons[0];
  const reportReason =
    selectedReason.lang[locale as keyof typeof selectedReason.lang] ?? selectedReason.reason_key;

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      setReplyOpen(false);
      setReportOpen(false);
      reload();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  function openMenu(event: MouseEvent<HTMLElement>) {
    setMenuAnchor(event.currentTarget);
  }

  async function blockUser() {
    setMenuAnchor(null);
    const name = comment.username.trim();
    if (!name || settings.blockedCommentUsers.includes(name)) {
      return;
    }
    await saveSettings({ blockedCommentUsers: [...settings.blockedCommentUsers, name] });
  }

  function submitReport() {
    const accountId = account?.id;
    if (!accountId) {
      return;
    }
    void perform(() => api.reportComment(base, token, accountId, comment, reportReason));
  }

  const likesDisplay = comment.likesSum ?? comment.likeCount ?? 0;

  return (
    <Box sx={{ mt: 0.75 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', color: 'text.secondary' }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <ButtonBase
            disabled={busy || !token}
            aria-label={comment.liked ? tr('取消赞') : tr('赞')}
            onClick={() => perform(() => api.voteComment(base, token, comment, true))}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.5,
              py: 0.25,
              borderRadius: '6px',
              color: comment.liked ? 'primary.main' : 'text.secondary',
              '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
              '&.Mui-disabled': { opacity: 0.5 },
            }}
          >
            {comment.liked ? (
              <ThumbUpIcon sx={{ fontSize: 15 }} />
            ) : (
              <ThumbUpOutlinedIcon sx={{ fontSize: 15 }} />
            )}
            <Typography variant="caption" sx={{ fontSize: 11.5, lineHeight: 1 }}>
              {likesDisplay}
            </Typography>
          </ButtonBase>
          <ButtonBase
            disabled={busy || !token}
            aria-label={comment.disliked ? tr('取消踩') : tr('踩')}
            onClick={() => perform(() => api.voteComment(base, token, comment, false))}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              p: 0.35,
              borderRadius: '6px',
              color: comment.disliked ? 'primary.main' : 'text.secondary',
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              '&.Mui-disabled': { opacity: 0.5 },
            }}
          >
            {comment.disliked ? (
              <ThumbDownIcon sx={{ fontSize: 15 }} />
            ) : (
              <ThumbDownOutlinedIcon sx={{ fontSize: 15 }} />
            )}
          </ButtonBase>
          {comment.id && (
            <Tooltip title={tr('回复')}>
              <span>
                <ButtonBase
                  disabled={busy || !token}
                  aria-label={tr('回复')}
                  onClick={() => setReplyOpen((open) => !open)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    p: 0.35,
                    borderRadius: '6px',
                    color: replyOpen ? 'primary.main' : 'text.secondary',
                    '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 15 }} />
                </ButtonBase>
              </span>
            </Tooltip>
          )}
        </Stack>
        <IconButton
          size="small"
          aria-label={tr('更多')}
          onClick={openMenu}
          sx={{ p: 0.35, color: 'text.secondary' }}
        >
          <MoreVertIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      {replyOpen && (
        <Box sx={{ mt: 1 }}>
          <InlineComposer
            placeholder={tr('回复 {0}…', comment.username)}
            disabled={!token}
            busy={busy}
            onSubmit={(text) => perform(() => api.replyComment(base, token, comment.id, text))}
            onCancel={() => setReplyOpen(false)}
          />
        </Box>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          disabled={!token || !account?.id}
          onClick={() => {
            setMenuAnchor(null);
            setReportOpen(true);
          }}
        >
          <ListItemIcon>
            <FlagOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {tr('举报')}
        </MenuItem>
        <MenuItem onClick={() => void blockUser()}>
          <ListItemIcon>
            <PersonOffOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {tr('屏蔽此用户')}
        </MenuItem>
      </Menu>

      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{tr('举报评论')}</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField
            select
            fullWidth
            size="small"
            label={tr('原因')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {reasons.map((item) => (
              <MenuItem key={item.reason_key} value={item.reason_key}>
                {item.lang[locale as keyof typeof item.lang] ?? item.lang['zh-rCN']}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportOpen(false)}>{tr('取消')}</Button>
          <Button
            variant="contained"
            disabled={busy || !token || !account?.id}
            onClick={submitReport}
          >
            {tr('提交')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
