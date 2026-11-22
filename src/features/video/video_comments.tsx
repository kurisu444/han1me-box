import { useAccount } from '../account/account_controller';
import { useI18n } from '../../app/i18n';
import { CommentActions, CommentActionsContext } from './comment_actions';
import { useMemo, useState } from 'react';
import { Alert, Avatar, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplyIcon from '@mui/icons-material/Reply';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import type { Comment, VideoDetail } from '../../domain/models/video';
import { RequestError, LoadingState } from '../shared/request_error';
import { useQuery } from '@tanstack/react-query';
import { visibleComments, type CommentSort } from './video_helpers';

const sortLabels = {
  latest: '最新',
  earliest: '最早',
  mostReplies: '回复最多',
  mostLikes: '赞最多',
  mostDislikes: '踩最多',
};

function CommentContent({ comment }: { comment: Comment }) {
  const tr = useI18n();

  return (
    <Stack direction="row" spacing={1.5}>
      <Avatar src={comment.avatarUrl} alt={comment.username} />
      <Box
        sx={{
          minWidth: 0,
          flex: 1,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
            alignItems: 'baseline',
            mb: 1,
          }}
        >
          <Typography variant="subtitle2">{comment.username}</Typography>
          <Typography variant="caption" color="text.secondary">
            {comment.timeAgo}
          </Typography>
        </Stack>
        <Typography
          sx={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 1.8,
          }}
        >
          {comment.content}
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: 'center',
            color: 'text.secondary',
            mt: 1,
          }}
        >
          <ThumbUpOutlinedIcon fontSize="small" />
          <Typography variant="caption">
            {tr('赞')}
            {comment.likesSum ?? comment.likeCount ?? 0}
          </Typography>
        </Stack>
        <CommentActions comment={comment} />
      </Box>
    </Stack>
  );
}
function Replies({ id }: { id: string }) {
  const tr = useI18n();
  const settings = useSettings();
  const baseUrl = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const { data, isPending, error, refetch } = useQuery(repository.replies(baseUrl, id));

  const replies = data?.comments ?? [];

  if (isPending) {
    return <LoadingState label={tr('正在加载回复…')} />;
  }
  if (error) {
    return <RequestError error={error} onRetry={refetch} />;
  }

  return (
    <Stack
      spacing={2.5}
      sx={{
        ml: {
          xs: 2,
          sm: 6,
        },
        mt: 2,
        pl: 2,
        borderLeft: 2,
        borderColor: 'divider',
      }}
    >
      {replies.length ? (
        replies.map((reply, index) => (
          <CommentContent key={`${reply.foreignId}-${index}`} comment={reply} />
        ))
      ) : (
        <Typography color="text.secondary">{tr('暂无可显示的回复。')}</Typography>
      )}
    </Stack>
  );
}
function CommentCard({ comment }: { comment: Comment }) {
  const tr = useI18n();
  const [expanded, setExpanded] = useState(false);

  const replyLabel = expanded
    ? tr('收起回复')
    : tr('查看回复{0}', comment.replyCount !== undefined ? `（${comment.replyCount}）` : '');

  return (
    <Box
      component="article"
      sx={{
        py: 2.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <CommentContent comment={comment} />
      {comment.hasMoreReplies && (
        <Button
          startIcon={<ReplyIcon />}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          sx={{
            ml: 5,
            mt: 1,
          }}
        >
          {replyLabel}
        </Button>
      )}
      {expanded && <Replies id={comment.id} />}
    </Box>
  );
}
export function CommentsList({
  id,
  sort: selectedSort,
  type = 'video',
}: {
  id: string;
  sort?: CommentSort;
  type?: string;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const baseUrl = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const { account, ready } = useAccount();
  const [localSort, setLocalSort] = useState<CommentSort>('latest');
  const { data, error, isPending, refetch } = useQuery({
    ...repository.comments(baseUrl, id, type, account?.id),
    enabled: ready !== false,
  });
  const sort = selectedSort ?? localSort;
  const comments = visibleComments(data?.comments ?? [], settings, sort);

  if (!settings.commentsEnabled) {
    return <Alert severity="info">{tr('评论已关闭。')}</Alert>;
  }
  if (isPending) {
    return <LoadingState label={tr('正在加载评论…')} />;
  }
  if (error) {
    return <RequestError error={error} onRetry={refetch} />;
  }

  return (
    <CommentActionsContext
      value={{
        token: data?.csrfToken ?? '',
        userId: data?.currentUserId ?? '',
        reload: refetch,
      }}
    >
      <CommentActions targetId={id} type={type} />
      {!selectedSort && (
        <TextField
          select
          label={tr('排序')}
          value={localSort}
          onChange={(event) => setLocalSort(event.target.value as CommentSort)}
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {tr(label)}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {comments.length}
          {tr('条评论')}
        </Typography>
        <Button startIcon={<RefreshIcon />} onClick={() => refetch()}>
          {tr('刷新评论')}
        </Button>
      </Stack>
      {comments.length ? (
        comments.map((comment, index) => (
          <CommentCard key={`${comment.id}-${index}`} comment={comment} />
        ))
      ) : (
        <Alert severity="info">{tr('暂无可显示的评论。')}</Alert>
      )}
    </CommentActionsContext>
  );
}
export function VideoComments({ video }: { video: VideoDetail }) {
  const tr = useI18n();
  const settings = useSettings();
  const [id, setId] = useState(video.id);
  const [sorts, setSorts] = useState<Record<string, CommentSort>>({});

  const sort = sorts[id] ?? 'latest';

  function setSort(value: CommentSort) {
    setSorts((current) => ({ ...current, [id]: value }));
  }

  const episodes = video.playlist.some((item) => item.id === video.id)
    ? video.playlist
    : [
        {
          id: video.id,
          title: video.title,
        },
        ...video.playlist,
      ];

  if (!settings.commentsEnabled) {
    return <Alert severity="info">{tr('评论已关闭。')}</Alert>;
  }

  return (
    <Box component="section">
      <Stack
        direction={{
          xs: 'column',
          sm: 'row',
        }}
        spacing={2}
        sx={{
          mb: 3,
        }}
      >
        <TextField
          select
          label={tr('查看评论的剧集')}
          value={id}
          onChange={(event) => setId(event.target.value)}
          sx={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {episodes.map((episode) => (
            <MenuItem key={episode.id} value={episode.id}>
              {episode.title}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={tr('排序')}
          value={sort}
          onChange={(event) => setSort(event.target.value as CommentSort)}
          sx={{
            minWidth: 150,
          }}
        >
          <MenuItem value="latest">{tr('最新')}</MenuItem>
          <MenuItem value="earliest">{tr('最早')}</MenuItem>
          <MenuItem value="mostReplies">{tr('回复最多')}</MenuItem>
          <MenuItem value="mostLikes">{tr('赞最多')}</MenuItem>
          <MenuItem value="mostDislikes">{tr('踩最多')}</MenuItem>
        </TextField>
      </Stack>
      <CommentsList key={id} id={id} sort={sort} />
    </Box>
  );
}
