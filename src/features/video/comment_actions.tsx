import { useI18n } from '../../app/i18n';
import { createContext, useContext, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useAccount } from '../account/account_controller';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { searchLocale } from '../../data/search_option_catalog';
import reasons from '../../../assets/search_options/report_reason.json';
import * as api from '../../data/remote/account_api';
import type { Comment } from '../../domain/models/video';
export const CommentActionsContext = createContext({
  token: '',
  userId: '',
  reload: () => {},
});
export function CommentActions({
  comment,
  targetId,
  type = 'video',
}: {
  comment?: Comment;
  targetId?: string;
  type?: string;
}) {
  const tr = useI18n();
  const { account } = useAccount();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const context = useContext(CommentActionsContext);
  const [mode, setMode] = useState('');
  const [content, setContent] = useState('');
  const [reason, setReason] = useState(reasons[0].reason_key);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const base = resolvedBaseUrl(settings);
  const token = context.token;
  const userId = context.userId;
  const locale = searchLocale(settings.language, navigator.language);
  const selectedReason = reasons.find((item) => item.reason_key === reason)!;
  const reportReason =
    selectedReason.lang[locale as keyof typeof selectedReason.lang] ?? selectedReason.reason_key;

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      setMode('');
      setContent('');
      context.reload();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    await perform(() =>
      mode === 'report'
        ? api.reportComment(base, token, account!.id!, comment!, reportReason)
        : comment
          ? api.replyComment(base, token, comment.id, content.trim())
          : api.postComment(base, token, userId, type, targetId!, content.trim()),
    );
  }

  function filterUser() {
    const name = comment!.username;
    if (settings.blockedCommentUsers.some((user) => user.toLowerCase() === name.toLowerCase()))
      return;
    void saveSettings({ blockedCommentUsers: [...settings.blockedCommentUsers, name] });
  }

  if (!comment && !account) return null;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1}>
        {(!comment || comment.id) && (
          <Button disabled={busy || !token} onClick={() => setMode('comment')}>
            {comment ? tr('回复') : tr('发表评论')}
          </Button>
        )}
        {comment && (
          <>
            <Button
              disabled={busy}
              onClick={() => perform(() => api.voteComment(base, token, comment, true))}
            >
              {comment.liked ? tr('取消赞') : tr('赞')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => perform(() => api.voteComment(base, token, comment, false))}
            >
              {comment.disliked ? tr('取消踩') : tr('踩')}
            </Button>
            <Button disabled={!token || !account?.id} onClick={() => setMode('report')}>
              {tr('举报')}
            </Button>
          </>
        )}
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Dialog open={!!mode} onClose={() => setMode('')} fullWidth>
        <DialogTitle>{mode === 'report' ? tr('举报评论') : tr('评论')}</DialogTitle>
        <DialogContent>
          {mode === 'report' ? (
            <TextField
              select
              fullWidth
              label={tr('原因')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {reasons.map((item) => (
                <MenuItem key={item.reason_key} value={item.reason_key}>
                  {item.lang[
                    searchLocale(settings.language, navigator.language) as keyof typeof item.lang
                  ] ?? item.lang['zh-rCN']}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              fullWidth
              multiline
              minRows={3}
              label={tr('内容')}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode('')}>{tr('取消')}</Button>
          <Button
            disabled={
              busy || !token || (!comment && !userId) || (mode !== 'report' && !content.trim())
            }
            onClick={submit}
          >
            {tr('提交')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
