import { useState, type ReactNode } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Box, Button, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { VideoCover } from '../shared/video_card';
import { CommentsList } from '../video/comments/video_comments';
import { offsetMonth } from './month_navigation';

export const previewGridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
  gap: '22px 16px',
  '@media (max-width:620px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px 10px',
  },
};

export function PreviewHeader({
  title,
  source,
  month,
  count,
}: {
  title: string;
  source: 'site' | 'getchu';
  month: string;
  count?: number;
}) {
  const tr = useI18n();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [year, monthNum] = month.split('-').map(Number);
  const tabs: Array<{ id: 'site' | 'getchu'; label: string; to: string }> = [
    { id: 'site', label: tr('站点预告'), to: `/previews?month=${month}` },
    { id: 'getchu', label: tr('Getchu 预告'), to: `/getchu?month=${month}` },
  ];

  return (
    <>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 1 }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'baseline', minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {Boolean(count) && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
              {tr('共 {0} 部', count ?? 0)}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<ForumOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setCommentsOpen(true)}
            sx={{
              height: 36,
              px: 1.5,
              borderRadius: '10px',
              borderColor: 'divider',
              color: 'text.secondary',
              fontSize: 13,
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            {tr('预告评论')}
          </Button>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              p: '3px',
              borderRadius: '10px',
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {tabs.map((tab) => {
              const active = tab.id === source;
              return (
                <Box
                  key={tab.id}
                  component={Link}
                  to={tab.to}
                  replace
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    px: 1.5,
                    py: 0.6,
                    borderRadius: '8px',
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    lineHeight: 1.25,
                    textDecoration: 'none',
                    color: active ? 'text.primary' : 'text.secondary',
                    bgcolor: active ? 'background.paper' : 'transparent',
                    boxShadow: active ? '0 1px 3px rgba(0, 0, 0, 0.14)' : 'none',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {tab.label}
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Stack>

      <Drawer
        anchor="right"
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        slotProps={{
          paper: {
            sx: {
              top: 'var(--titlebar-height)',
              height: 'calc(100vh - var(--titlebar-height))',
              width: { xs: '100vw', sm: 420 },
              borderLeft: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{tr('预告评论')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {tr('{0} 年 {1} 月', year, monthNum)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setCommentsOpen(false)}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, py: 1.5 }}>
          <CommentsList id={month.replace('-', '')} type="preview" />
        </Box>
      </Drawer>
    </>
  );
}

export function PreviewGroupHeader({ title, count }: { title: string; count: number }) {
  const tr = useI18n();
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pt: 0.5 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '999px', bgcolor: 'primary.main' }} />
      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
        {tr('{0} 部新作', count)}
      </Typography>
    </Stack>
  );
}

export function PreviewEmpty({
  month,
  onChange,
  onRetry,
}: {
  month: string;
  onChange(value: string): void;
  onRetry(): void;
}) {
  const tr = useI18n();
  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center', py: 8, textAlign: 'center' }}>
      <EventBusyRoundedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {tr('暂无预告')}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onChange(offsetMonth(month, -1))}
          sx={{ borderRadius: '8px' }}
        >
          {tr('上个月')}
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<RefreshRoundedIcon fontSize="small" />}
          onClick={onRetry}
          sx={{ borderRadius: '8px' }}
        >
          {tr('重新加载')}
        </Button>
      </Stack>
    </Stack>
  );
}

export function PreviewPosterCard({
  to,
  coverUrl,
  title,
  subtitle,
  highlight,
  aspectRatio = '2 / 3',
  footer,
}: {
  to: string;
  coverUrl?: string;
  title: string;
  subtitle?: string;
  highlight?: string;
  aspectRatio?: string;
  footer?: ReactNode;
}) {
  return (
    <Box
      component="article"
      sx={{
        minWidth: 0,
        '&:hover .preview-cover img': { transform: 'scale(1.03)' },
        '&:hover .preview-title': { color: 'primary.main' },
      }}
    >
      <Box
        component={Link}
        to={to}
        sx={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      >
        <Box
          className="preview-cover"
          sx={(theme) => ({
            aspectRatio,
            borderRadius: '10px',
            overflow: 'hidden',
            bgcolor: 'action.hover',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 4px 14px rgba(0, 0, 0, 0.38)'
                : '0 4px 14px rgba(0, 0, 0, 0.12)',
            '& img': { transition: 'transform 0.2s ease' },
          })}
        >
          <VideoCover key={coverUrl ?? ''} url={coverUrl ?? ''} title={title} />
        </Box>
        <Stack spacing={0.35} sx={{ pt: 1, px: 0.25, minWidth: 0 }}>
          <Typography
            className="preview-title"
            component="h3"
            variant="subtitle2"
            title={title}
            sx={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              transition: 'color 0.15s ease',
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              title={subtitle}
              sx={{ fontSize: 11.5 }}
            >
              {subtitle}
            </Typography>
          )}
          {highlight && (
            <Typography
              variant="caption"
              noWrap
              sx={{ fontSize: 12, fontWeight: 700, color: 'error.main' }}
            >
              {highlight}
            </Typography>
          )}
        </Stack>
      </Box>
      {footer}
    </Box>
  );
}
