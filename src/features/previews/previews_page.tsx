import { VideoCover } from '../shared/video_card';
import { useMemo, useState } from 'react';
import { useI18n } from '../../app/i18n';
import { CommentsList } from '../video/video_comments';
import { ImageGallery } from '../shared/image_gallery';
import { MonthNavigation, previewMonth } from './month_navigation';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { useSettings, useSettingsReady } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { previews } from '../../data/han1me_repository';
import { useQuery } from '@tanstack/react-query';
import { LoadingState, RequestError } from '../shared/request_error';

export function PreviewsPage() {
  const tr = useI18n();
  const settings = useSettings();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const base = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const month = previewMonth(params.get('month'));
  const { data, isPending, error, refetch } = useQuery({
    ...previews(base, month.replace('-', '')),
    enabled: useSettingsReady(),
  });

  function setMonth(value: string) {
    setParams({ month: value }, { replace: true });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('新番预告')}</Typography>
      <Stack direction="row" spacing={1}>
        <Button component={Link} to={`/getchu?month=${month}`}>
          {tr('Getchu 预告')}
        </Button>
        <Button onClick={() => setCommentsOpen(true)}>{tr('预告评论')}</Button>
      </Stack>
      <MonthNavigation month={month} onChange={setMonth} />
      {isPending ? (
        <LoadingState label={tr('正在加载预告…')} />
      ) : error ? (
        <RequestError error={error} onRetry={refetch} />
      ) : (
        <>
          <Typography variant="h5">{data?.title}</Typography>
          {!data?.items.length && (
            <Alert
              severity="info"
              action={<Button onClick={() => refetch()}>{tr('重新加载')}</Button>}
            >
              {tr('暂无预告')}
            </Alert>
          )}
          {data?.description && <Typography>{data.description}</Typography>}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))',
              gap: 2,
              alignItems: 'stretch',
              '& > *': { maxWidth: 180, minWidth: 0, width: '100%' },
            }}
          >
            {data?.items.map((item) => (
              <Card key={item.id}>
                <CardActionArea component={Link} to={`/video/${encodeURIComponent(item.id)}`}>
                  <Box sx={{ aspectRatio: '2 / 3', overflow: 'hidden' }}>
                    <VideoCover url={item.coverUrl} title={item.title} />
                  </Box>
                  <Typography
                    variant="subtitle2"
                    title={item.title}
                    sx={{
                      m: 1,
                      lineHeight: 1.5,
                      height: '3em',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.title}
                  </Typography>
                </CardActionArea>
                {(item.brand ||
                  item.releaseDate ||
                  item.description ||
                  item.tags.length > 0 ||
                  item.previewImages.length > 0) && (
                  <CardContent sx={{ p: 1 }}>
                    <Stack spacing={1}>
                      {(item.brand || item.releaseDate) && (
                        <Typography variant="caption">
                          {[item.brand, item.releaseDate].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                      {item.description && (
                        <Typography variant="body2">{item.description}</Typography>
                      )}
                      <Stack
                        direction="row"
                        sx={{
                          flexWrap: 'wrap',
                        }}
                      >
                        {item.tags.map((tag) => (
                          <Chip key={tag} label={tag} />
                        ))}
                      </Stack>
                      <ImageGallery
                        title={item.videoTitle ?? item.title}
                        images={item.previewImages}
                      />
                    </Stack>
                  </CardContent>
                )}
              </Card>
            ))}
          </Box>
        </>
      )}
      <Dialog open={commentsOpen} onClose={() => setCommentsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{tr('预告评论')}</DialogTitle>
        <DialogContent>
          <CommentsList id={month.replace('-', '')} type="preview" />
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
