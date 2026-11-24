import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import SortIcon from '@mui/icons-material/Sort';
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import type { Comment, VideoDetail } from '../../domain/models/video';
import { useAccount } from '../account/account_controller';
import { LoadingIndicator } from '../shared/loading_indicator';
import { LoadingState, RequestError } from '../shared/request_error';
import { CommentActions, CommentActionsContext, CommentComposer } from './comment_actions';
import { visibleComments, type CommentSort } from './video_helpers';

const sortLabels: Record<CommentSort, string> = {
  latest: '最新',
  earliest: '最早',
  mostReplies: '回复最多',
  mostLikes: '赞最多',
  mostDislikes: '踩最多',
};

function CommentContent({ comment, compact = false }: { comment: Comment; compact?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
      <Avatar
        src={comment.avatarUrl}
        alt={comment.username}
        sx={{
          width: compact ? 24 : 32,
          height: compact ? 24 : 32,
          fontSize: compact ? 11 : 13,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {comment.username.slice(0, 1).toUpperCase()}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ fontSize: compact ? 12 : 13, fontWeight: 600, lineHeight: 1.35 }}
        >
          {comment.username}
        </Typography>
        {comment.timeAgo && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', fontSize: 11, lineHeight: 1.3, mt: 0.15 }}
          >
            {comment.timeAgo}
          </Typography>
        )}
        <Typography
          variant="body2"
          sx={{
            mt: 0.75,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 1.6,
            fontSize: compact ? 12.5 : 13,
          }}
        >
          {comment.content}
        </Typography>
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
    return (
      <Box sx={{ mt: 1, py: 1 }}>
        <LoadingState label={tr('正在加载回复…')} />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ mt: 1 }}>
        <RequestError error={error} onRetry={refetch} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mt: 1,
        px: 1.5,
        py: 1.25,
        borderRadius: '8px',
        bgcolor: 'action.hover',
      }}
    >
      {replies.length ? (
        <Stack spacing={1.5}>
          {replies.map((reply, index) => (
            <CommentContent
              key={`${reply.foreignId ?? reply.username}-${index}`}
              comment={reply}
              compact
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          {tr('暂无可显示的回复。')}
        </Typography>
      )}
    </Box>
  );
}

function CommentCard({ comment }: { comment: Comment }) {
  const tr = useI18n();
  const [expanded, setExpanded] = useState(false);

  const replyLabel = expanded
    ? tr('收起回复')
    : comment.replyCount !== undefined
      ? tr('共 {0} 条回复', comment.replyCount)
      : tr('查看回复');

  return (
    <Box
      component="article"
      sx={{
        py: 1.75,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <CommentContent comment={comment} />
      {comment.hasMoreReplies && (
        <Box sx={{ pl: '42px', mt: 0.75 }}>
          <Button
            size="small"
            color="primary"
            endIcon={
              expanded ? (
                <KeyboardArrowUpIcon sx={{ fontSize: '16px !important' }} />
              ) : (
                <KeyboardArrowDownIcon sx={{ fontSize: '16px !important' }} />
              )
            }
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            sx={{ minWidth: 'auto', px: 0.5, py: 0.15, fontSize: 12 }}
          >
            {replyLabel}
          </Button>
          {expanded && <Replies id={comment.id} />}
        </Box>
      )}
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
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const {
    data,
    error,
    isPending,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteQuery({
    ...repository.commentsInfinite(baseUrl, id, type, account?.id),
    enabled: ready !== false,
  });

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) {
      return;
    }
    const root = sentinel.closest('#comments-panel');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: '240px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sort = selectedSort ?? localSort;
  const allComments = useMemo(() => {
    const seen = new Set<string>();
    const list: Comment[] = [];
    for (const page of data?.pages ?? []) {
      for (const item of page.comments) {
        if (!item.id || !seen.has(item.id)) {
          if (item.id) {
            seen.add(item.id);
          }
          list.push(item);
        }
      }
    }
    return list;
  }, [data]);
  const comments = visibleComments(allComments, settings, sort);
  const firstPage = data?.pages[0];

  function openSortMenu(event: MouseEvent<HTMLElement>) {
    setSortAnchor(event.currentTarget);
  }

  function chooseSort(value: CommentSort) {
    setLocalSort(value);
    setSortAnchor(null);
  }

  if (!settings.commentsEnabled) {
    return <Alert severity="info">{tr('评论已关闭。')}</Alert>;
  }
  if (isPending) {
    return <LoadingState label={tr('正在加载评论…')} />;
  }
  if (error && !data) {
    return <RequestError error={error} onRetry={refetch} />;
  }

  return (
    <CommentActionsContext
      value={{
        token: firstPage?.csrfToken ?? '',
        userId: firstPage?.currentUserId ?? '',
        reload: refetch,
      }}
    >
      <Stack spacing={1.5} sx={{ mb: 0.5 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            {comments.length} {tr('条评论')}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {!selectedSort && (
              <>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<SortIcon sx={{ fontSize: '15px !important' }} />}
                  onClick={openSortMenu}
                  sx={{
                    minWidth: 'auto',
                    px: 0.75,
                    py: 0.25,
                    fontSize: 12,
                    color: 'text.secondary',
                  }}
                >
                  {tr(sortLabels[sort])}
                </Button>
                <Menu
                  anchorEl={sortAnchor}
                  open={Boolean(sortAnchor)}
                  onClose={() => setSortAnchor(null)}
                >
                  {(Object.entries(sortLabels) as [CommentSort, string][]).map(([value, label]) => (
                    <MenuItem
                      key={value}
                      selected={value === sort}
                      onClick={() => chooseSort(value)}
                    >
                      {tr(label)}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
            <Tooltip title={tr('刷新评论')}>
              <IconButton
                size="small"
                aria-label={tr('刷新评论')}
                onClick={() => refetch()}
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <CommentComposer targetId={id} type={type} />
      </Stack>
      {comments.length ? (
        <>
          {comments.map((comment, index) => (
            <CommentCard key={`${comment.id}-${index}`} comment={comment} />
          ))}
          <Box ref={loadMoreRef} sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
            {isFetchingNextPage && (
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: 'center', color: 'text.secondary' }}
              >
                <LoadingIndicator size="sm" />
                <Typography variant="body2">{tr('正在加载更多…')}</Typography>
              </Stack>
            )}
            {isFetchNextPageError && (
              <Button variant="outlined" size="small" onClick={() => void fetchNextPage()}>
                {tr('重试')}
              </Button>
            )}
            {!hasNextPage && !isFetchingNextPage && (
              <Typography variant="caption" color="text.secondary">
                {tr('已经到底了')}
              </Typography>
            )}
          </Box>
        </>
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {tr('暂无可显示的评论。')}
        </Alert>
      )}
    </CommentActionsContext>
  );
}

export function VideoComments({ video }: { video: VideoDetail }) {
  return (
    <Box component="section">
      <CommentsList key={video.id} id={video.id} />
    </Box>
  );
}
