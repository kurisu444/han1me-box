import { useEffect, useRef, useState, type ReactNode } from 'react';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Box, Card, Stack, Typography, useMediaQuery } from '@mui/material';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
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
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState(url);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

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
    <Box sx={{ width: '100%', height: '100%', bgcolor: 'action.hover' }}>
      <Box
        component="img"
        ref={imgRef}
        src={source}
        alt={title}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        onError={imageFailed}
        sx={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 180ms ease-out, transform 200ms cubic-bezier(0.2, 0, 0, 1)',
        }}
      />
    </Box>
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
  const videoUrl = !onSelect && video.id ? `/video/${encodeURIComponent(video.id)}` : '';
  const artistUrl =
    !onSelect && video.artist ? `/search?${new URLSearchParams({ query: video.artist })}` : '';

  const cover = (
    <Box
      sx={{
        position: 'relative',
        aspectRatio: compact ? '3 / 4' : '16 / 9',
        borderRadius: '10px',
        overflow: 'hidden',
        alignSelf: 'start',
        outline: selected ? '2px solid' : 'none',
        outlineColor: 'primary.main',
        outlineOffset: '-2px',
        '& img': { transition: 'transform 0.2s ease, opacity 0.15s ease' },
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
  );

  const titleNode = (
    <Typography
      component="h3"
      variant="subtitle2"
      title={video.title}
      sx={{
        fontSize: 13,
        lineHeight: 1.35,
        color: selected ? 'primary.main' : undefined,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
      }}
    >
      {video.title}
    </Typography>
  );

  return (
    <Card
      component="article"
      elevation={0}
      onClick={onSelect}
      sx={{
        minWidth: 0,
        height: '100%',
        flexShrink: 0,
        bgcolor: 'transparent',
        borderRadius: '10px',
        cursor: onSelect ? 'pointer' : undefined,
        '&:hover img': { transform: 'scale(1.03)' },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: horizontal ? '90px minmax(0, 1fr)' : 'minmax(0, 1fr)',
          height: '100%',
        }}
      >
        {videoUrl ? (
          <Box
            component={Link}
            to={videoUrl}
            aria-label={video.title}
            sx={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
          >
            {cover}
          </Box>
        ) : (
          cover
        )}
        <Stack
          spacing={0.35}
          sx={{ px: horizontal ? 1.25 : 0.25, pt: horizontal ? 0.5 : 1, pb: 0.5, minWidth: 0 }}
        >
          {videoUrl ? (
            <Box
              component={Link}
              to={videoUrl}
              aria-current={selected ? 'page' : undefined}
              sx={{
                display: 'block',
                textDecoration: 'none',
                color: 'text.primary',
                transition: 'color 0.15s ease',
                '&:hover': { color: 'primary.main' },
              }}
            >
              {titleNode}
            </Box>
          ) : (
            titleNode
          )}
          {(video.artist || video.uploadTime) &&
            (artistUrl ? (
              <Box
                component={Link}
                to={artistUrl}
                title={video.artist}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 0,
                  maxWidth: '100%',
                  width: 'fit-content',
                  textDecoration: 'none',
                  color: 'text.secondary',
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  transition: 'color 0.15s ease',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {video.artist}
                </Box>
                {video.uploadTime && (
                  <>
                    <Box component="span" sx={{ flexShrink: 0 }}>
                      ·
                    </Box>
                    <Box component="span" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {video.uploadTime}
                    </Box>
                  </>
                )}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11.5 }}>
                {[video.artist, video.uploadTime].filter(Boolean).join(' · ')}
              </Typography>
            ))}
        </Stack>
      </Box>
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
