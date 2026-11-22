import { useSettings } from '../../app/settings_context';
import { useI18n } from '../../app/i18n';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Box, Card, CardActionArea, Chip, Stack, Typography, useMediaQuery } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import { type VideoCard } from '../../domain/models/video';

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
    if (fallbackUrl && source !== fallbackUrl) setSource(fallbackUrl);
    else setFailed(true);
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
  const tr = useI18n();

  const settings = useSettings();

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
          aspectRatio: compact ? '3 / 4' : settings.useHorizontalSearchCards ? '16 / 9' : '0.58',
          overflow: 'hidden',
          alignSelf: 'start',
        }}
      >
        <VideoCover key={video.coverUrl} url={video.coverUrl} title={video.title} />
        {video.duration && (
          <Chip
            label={video.duration}
            size="small"
            sx={{
              position: 'absolute',
              right: 6,
              bottom: 6,
              bgcolor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              height: 22,
            }}
          />
        )}
      </Box>
      <Stack
        spacing={0.5}
        sx={{
          p: 1.5,
          minWidth: 0,
        }}
      >
        <Typography
          component="h3"
          variant="subtitle2"
          title={video.title}
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {video.title}
        </Typography>
        {video.artist && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {video.artist}
          </Typography>
        )}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: 'center',
            color: 'text.secondary',
          }}
        >
          {video.views && (
            <VisibilityOutlinedIcon
              sx={{
                fontSize: '1rem',
              }}
            />
          )}
          <Typography variant="caption">
            {[video.views && tr('{0} 次观看', video.views), video.rating]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Stack>
        {video.uploadTime && (
          <Typography variant="caption" color="text.secondary">
            {video.uploadTime}
          </Typography>
        )}
      </Stack>
    </Box>
  );

  function select(event: React.MouseEvent) {
    if (!onSelect) return;
    event.preventDefault();
    onSelect();
  }

  return (
    <Card
      component="article"
      sx={{
        minWidth: 0,
        height: '100%',
        flexShrink: 0,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
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

const videoGridCardWidth = { min: 220, max: 280 };

export function VideoGrid({
  children,
  layout = 'grid',
}: {
  children: ReactNode;
  layout?: 'grid' | 'row' | 'compact';
}) {
  const settings = useSettings();
  const wide = useMediaQuery('(min-width:700px)');

  const cardWidth = settings.useHorizontalSearchCards ? (wide ? 220 : 154) : wide ? 170 : 132;

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
                layout === 'compact'
                  ? 'repeat(3, minmax(0, 1fr))'
                  : `repeat(auto-fill, minmax(${videoGridCardWidth.min}px, 1fr))`,
              ...(layout === 'grid' && {
                overflowX: 'auto',
                '& > *': {
                  width: '100%',
                  minWidth: videoGridCardWidth.min,
                  maxWidth: videoGridCardWidth.max,
                },
              }),
              gap: layout === 'compact' ? '16px' : '20px',
              '@media (max-width:620px)': { gap: '10px' },
            }
      }
    >
      {children}
    </Box>
  );
}
