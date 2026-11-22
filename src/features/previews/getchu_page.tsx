import { cardGridSx } from '../shared/video_card';
import type { VideoDetail } from '../../domain/models/video';
import { useI18n } from '../../app/i18n';
import { ImageGallery } from '../shared/image_gallery';
import { MonthNavigation, previewMonth } from './month_navigation';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Stack,
  Typography,
} from '@mui/material';
import * as api from '../../data/remote/getchu_api';
import { useQuery } from '@tanstack/react-query';
import { RequestError, LoadingState } from '../shared/request_error';
import type { GetchuPreviewItem } from '../../domain/models/getchu_preview';

function Items({ items }: { items: GetchuPreviewItem[] }) {
  return (
    <Box sx={cardGridSx}>
      {items.map((item) => (
        <Card key={item.id}>
          <CardActionArea component={Link} to={`/getchu/${item.id}`}>
            <CardMedia
              component="img"
              image={item.coverUrl}
              alt={item.title}
              sx={{
                aspectRatio: '3/4',
                objectFit: 'contain',
              }}
            />
            <CardContent>
              <Typography>{item.title}</Typography>
              <Typography variant="body2">
                {item.brand} · {item.price}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
export function GetchuPage() {
  const tr = useI18n();
  const [params, setParams] = useSearchParams();
  const month = previewMonth(params.get('month'));
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['getchu-previews', month],
    queryFn: () => api.previews(month.replace('-', '')),
  });

  function setMonth(value: string) {
    setParams({ month: value }, { replace: true });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('Getchu 月度预告')}</Typography>
      <Button component={Link} to="/previews">
        {tr('站点预告')}
      </Button>
      <MonthNavigation month={month} onChange={setMonth} future />
      {!isPending && !error && !data?.groups.length && (
        <Alert severity="info" action={<Button onClick={() => refetch()}>{tr('重新加载')}</Button>}>
          {tr('暂无预告')}
        </Alert>
      )}
      {isPending ? (
        <LoadingState label={tr('正在加载预告…')} />
      ) : error ? (
        <RequestError error={error} onRetry={refetch} />
      ) : (
        data?.groups.map((group) => (
          <Stack key={group.releaseDate} spacing={2}>
            <Typography variant="h5">{group.releaseDate}</Typography>
            <Items items={group.items} />
          </Stack>
        ))
      )}
    </Stack>
  );
}
export function GetchuDetailPage() {
  const navigate = useNavigate();
  const tr = useI18n();
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['getchu-detail', id],
    queryFn: () => api.detail(id!),
  });

  function playTrailer(index: number) {
    const detail = data!;
    const video: VideoDetail = {
      id: `getchu-${detail.id}-${index}`,
      title: detail.videoUrls.length === 1 ? detail.title : `${detail.title} ${index + 1}`,
      coverUrl: detail.coverUrl,
      artist: detail.brand,
      uploadDate: detail.releaseDate,
      description: detail.description,
      sources: [{ quality: 'Trailer', url: detail.videoUrls[index], type: 'video/mp4' }],
      tags: [],
      playlist: [],
      related: [],
    };
    navigate(`/video/${video.id}`, { state: { localVideo: video } });
  }

  if (isPending) {
    return <LoadingState label={tr('正在加载详情…')} />;
  }
  if (error) {
    return <RequestError error={error} onRetry={refetch} />;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{data!.title}</Typography>
      <Button onClick={() => window.electron.openExternal(data!.productUrl)}>
        {tr('商品页面')}
      </Button>
      <Box
        component="img"
        src={data!.coverUrl}
        sx={{
          maxWidth: 420,
        }}
      />
      <Typography>
        {data!.brand} · {data!.releaseDate} · {data!.price}
      </Typography>
      {!data!.sections.length && (
        <Typography
          sx={{
            whiteSpace: 'pre-wrap',
          }}
        >
          {data!.description}
        </Typography>
      )}
      {data!.videoUrls.map((url, index) => (
        <Button key={url} onClick={() => playTrailer(index)}>
          {tr('播放预告 {0}', index + 1)}
        </Button>
      ))}
      {data!.sections.map((section) => (
        <Stack key={section.title} spacing={1}>
          <Typography variant="h5">{section.title}</Typography>
          <Typography
            sx={{
              whiteSpace: 'pre-wrap',
            }}
          >
            {section.body}
          </Typography>
        </Stack>
      ))}
      <ImageGallery title={data!.title} images={data!.sampleImages} />
      <Typography variant="h5">{tr('同系列')}</Typography>
      <Items items={data!.seriesItems} />
    </Stack>
  );
}
