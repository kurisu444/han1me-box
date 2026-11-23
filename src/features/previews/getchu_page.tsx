import { useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import * as api from '../../data/remote/getchu_api';
import type { GetchuPreviewItem } from '../../domain/models/getchu_preview';
import type { VideoDetail } from '../../domain/models/video';
import { ImageGallery } from '../shared/image_gallery';
import { LoadingState, RequestError } from '../shared/request_error';
import { MonthNavigation, previewMonth } from './month_navigation';
import {
  PreviewEmpty,
  PreviewGroupHeader,
  PreviewHeader,
  PreviewPosterCard,
  previewGridSx,
} from './preview_layout';

function Items({ items }: { items: GetchuPreviewItem[] }) {
  return (
    <Box sx={previewGridSx}>
      {items.map((item) => (
        <PreviewPosterCard
          key={item.id}
          to={`/getchu/${item.id}`}
          coverUrl={item.coverUrl}
          title={item.title}
          subtitle={item.brand || undefined}
          highlight={item.price || undefined}
          aspectRatio="5 / 7"
        />
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

  const setMonth = (value: string) => setParams({ month: value }, { replace: true });
  const totalCount = useMemo(
    () => data?.groups.reduce((sum, group) => sum + group.items.length, 0),
    [data?.groups],
  );

  return (
    <Stack spacing={2.5}>
      <PreviewHeader
        title={tr('Getchu 月度预告')}
        source="getchu"
        month={month}
        count={totalCount}
      />
      <MonthNavigation month={month} onChange={setMonth} future />

      {isPending ? (
        <LoadingState label={tr('正在加载预告…')} />
      ) : error ? (
        <RequestError error={error} onRetry={refetch} />
      ) : !data?.groups.length ? (
        <PreviewEmpty month={month} onChange={setMonth} onRetry={refetch} />
      ) : (
        <Stack spacing={3}>
          {data.groups.map((group) => (
            <Stack key={group.releaseDate} spacing={1.5}>
              <PreviewGroupHeader title={group.releaseDate} count={group.items.length} />
              <Items items={group.items} />
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function GetchuDetailPage() {
  const tr = useI18n();
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['getchu-detail', id],
    queryFn: () => api.detail(id ?? ''),
    enabled: Boolean(id),
  });

  if (isPending) {
    return <LoadingState label={tr('正在加载详情…')} />;
  }
  if (error || !data) {
    return <RequestError error={error ?? new Error(tr('暂无预告'))} onRetry={refetch} />;
  }

  const detail = data;

  function playTrailer(index: number) {
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
    void window.electron.player.open({ id: video.id, localVideo: video });
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {data.title}
      </Typography>
      <Box>
        <Button
          variant="outlined"
          size="small"
          onClick={() => window.electron.openExternal(data.productUrl)}
          sx={{ borderRadius: '8px' }}
        >
          {tr('商品页面')}
        </Button>
      </Box>
      <Box
        component="img"
        src={data.coverUrl}
        alt={data.title}
        sx={{ maxWidth: 360, borderRadius: '10px' }}
      />
      <Typography color="text.secondary">
        {[data.brand, data.releaseDate, data.price].filter(Boolean).join(' · ')}
      </Typography>
      {!data.sections.length && data.description && (
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.description}</Typography>
      )}
      {data.videoUrls.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {data.videoUrls.map((url, index) => (
            <Button
              key={url}
              variant="contained"
              size="small"
              onClick={() => playTrailer(index)}
              sx={{ borderRadius: '8px' }}
            >
              {tr('播放预告 {0}', index + 1)}
            </Button>
          ))}
        </Stack>
      )}
      {data.sections.map((section) => (
        <Stack key={section.title} spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {section.title}
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{section.body}</Typography>
        </Stack>
      ))}
      <ImageGallery title={data.title} images={data.sampleImages} />
      {data.seriesItems.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {tr('同系列')}
          </Typography>
          <Items items={data.seriesItems} />
        </Stack>
      )}
    </Stack>
  );
}
