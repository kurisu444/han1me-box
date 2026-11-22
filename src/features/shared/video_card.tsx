import { useI18n } from '../../app/i18n';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Box, Card, CardActionArea, Stack, Typography, useMediaQuery } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import type { VideoCard } from '../../domain/models/video';

export const cardGridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '20px',
  '@media (max-width:620px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
};

export function VideoCover({
  url,
  title,
  eager = false,
  fallbackUrl,
}: {
  url: string;
  title: string;
  eager?: boolean;
  fallbackUrl?: string;
}) {
  const tr = useI18n();
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState(url);

  function imageFailed() {
    if (fallbackUrl && source !== fallbackUrl) {
      setSource(fallbackUrl);
    } else {
      setFailed(true);
    }
  }

  if (!url || failed) {
    return (
      <Stack
        spacing={1}
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'text.secondary',
          bgcolor: 'action.hover',
        }}
      >
        <ImageNotSupportedOutlinedIcon />
        <Typography variant="caption">{tr('暂无封面')}</Typography>
      </Stack>
    );
  }

  return (
    <Box
      component="img"
      src={source}
      alt={title}
      loading={eager ? 'eager' : 'lazy'}
      onError={imageFailed}
      sx={{
        width: '100%',
        height: '100%',
        display: 'block',
        objectFit: 'cover',
      }}
    />
  );
}
export function VideoCardTile({
  video,
  selected = false,
  compact = false,
  vertical = false,
  onSelect,
}: {
  video: VideoCard;
  selected?: boolean;
  compact?: boolean;
  vertical?: boolean;
  onSelect?: () => void;
}) {
  const horizontal = compact && !vertical;
  const content = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: horizontal ? '90px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        height: '100%',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: compact ? '3 / 4' : '16 / 9',
          borderRadius: '10px',
          overflow: 'hidden',
          alignSelf: 'start',
          '& img': { transition: 'transform 0.2s ease' },
        }}
      >
        <VideoCover key={video.coverUrl} url={video.coverUrl} title={video.title} />
        {(video.duration || video.views || video.rating) && (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              position: 'absolute',
              inset: 'auto 0 0',
              px: 1,
              pt: 2.5,
              pb: 0.6,
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.78))',
              color: '#fff',
              fontSize: 11,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
              {video.views && <VisibilityOutlinedIcon sx={{ fontSize: 13, flexShrink: 0 }} />}
              <Typography component="span" noWrap sx={{ fontSize: 11, color: 'inherit' }}>
                {[video.views, video.rating].filter(Boolean).join(' · ')}
              </Typography>
            </Stack>
            {video.duration && (
              <Typography
                component="span"
                sx={{ fontSize: 11, fontWeight: 500, color: 'inherit', flexShrink: 0 }}
              >
                {video.duration}
              </Typography>
            )}
          </Stack>
        )}
      </Box>
      <Stack
        spacing={0.35}
        sx={{ px: horizontal ? 1.25 : 0.25, pt: horizontal ? 0.5 : 1, pb: 0.5, minWidth: 0 }}
      >
        <Typography
          component="h3"
          variant="subtitle2"
          title={video.title}
          sx={{
            fontSize: 13,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {video.title}
        </Typography>
        {(video.artist || video.uploadTime) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11.5 }}>
            {[video.artist, video.uploadTime].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Stack>
    </Box>
  );

  function select(event: React.MouseEvent) {
    if (!onSelect) {
      return;
    }
    event.preventDefault();
    onSelect();
  }

  return (
    <Card
      component="article"
      elevation={0}
      sx={{
        minWidth: 0,
        height: '100%',
        flexShrink: 0,
        border: selected ? 1.5 : 0,
        borderColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? 'action.selected' : 'transparent',
        borderRadius: '10px',
        '&:hover img': { transform: 'scale(1.03)' },
      }}
    >
      {video.id ? (
        <CardActionArea
          component={Link}
          to={`/video/${encodeURIComponent(video.id)}`}
          onClick={select}
          aria-current={selected ? 'page' : undefined}
          sx={{
            height: '100%',
            borderRadius: '10px',
            '&:hover .MuiCardActionArea-focusHighlight': { opacity: 0 },
          }}
        >
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}

export function CompactVideoCard({
  video,
  selected = false,
  vertical = false,
  onSelect,
}: {
  video: VideoCard;
  selected?: boolean;
  vertical?: boolean;
  onSelect?: () => void;
}) {
  return (
    <VideoCardTile
      video={video}
      selected={selected}
      compact
      vertical={vertical}
      onSelect={onSelect}
    />
  );
}

export function VideoGrid({
  children,
  layout = 'grid',
}: {
  children: ReactNode;
  layout?: 'grid' | 'row' | 'compact';
}) {
  const wide = useMediaQuery('(min-width:700px)');
  const cardWidth = wide ? 220 : 154;

  return (
    <Box
      sx={
        layout === 'row'
          ? {
              display: 'grid',
              gridAutoFlow: 'column',
              gridAutoColumns: `${cardWidth}px`,
              overflowX: 'auto',
              gap: '18px',
              padding: '4px 4px 16px',
              scrollbarWidth: 'thin',
            }
          : {
              display: 'grid',
              gridTemplateColumns:
                layout === 'compact' ? 'repeat(3, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
              gap: '16px',
              ...(layout === 'grid' && {
                '@media (max-width:1099px)': {
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                },
                '@media (max-width:849px)': {
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                },
                '@media (max-width:619px)': {
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                },
              }),
            }
      }
    >
      {children}
    </Box>
  );
}
