import { useMemo } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { previews } from '../../data/han1me_repository';
import type { PreviewItem } from '../../domain/models/video';
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

function groupItems(items: PreviewItem[], otherLabel: string) {
  if (!items.some((item) => item.releaseDate?.trim())) {
    return [{ key: '', items }];
  }
  const map = new Map<string, PreviewItem[]>();
  for (const item of items) {
    const key = item.releaseDate?.trim() || otherLabel;
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return Array.from(map, ([key, grouped]) => ({ key, items: grouped }));
}

export function PreviewsPage() {
  const tr = useI18n();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const base = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const month = previewMonth(params.get('month'));
  const { data, isPending, error, refetch } = useQuery(previews(base, month.replace('-', '')));

  const setMonth = (value: string) => setParams({ month: value }, { replace: true });
  const pageTitle = tr('新番预告');
  const feedTitle = data?.title?.trim();
  const showFeedSubtitle = Boolean(
    feedTitle && feedTitle !== pageTitle && feedTitle !== '新番预告' && feedTitle !== '新番預告',
  );
  const groups = useMemo(() => groupItems(data?.items ?? [], tr('其他')), [data?.items, tr]);

  return (
    <Stack spacing={2.5}>
      <PreviewHeader title={pageTitle} source="site" month={month} count={data?.items.length} />
      <MonthNavigation month={month} onChange={setMonth} />

      {isPending ? (
        <LoadingState label={tr('正在加载预告…')} />
      ) : error ? (
        <RequestError error={error} onRetry={refetch} />
      ) : !data?.items.length ? (
        <PreviewEmpty month={month} onChange={setMonth} onRetry={refetch} />
      ) : (
        <Stack spacing={2.5}>
          {(showFeedSubtitle || data.description) && (
            <Stack spacing={0.5}>
              {showFeedSubtitle && (
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {feedTitle}
                </Typography>
              )}
              {data.description && (
                <Typography variant="body2" color="text.secondary">
                  {data.description}
                </Typography>
              )}
            </Stack>
          )}
          {groups.map((group) => (
            <Stack key={group.key || 'all'} spacing={1.5}>
              {group.key && <PreviewGroupHeader title={group.key} count={group.items.length} />}
              <Box sx={previewGridSx}>
                {group.items.map((item) => {
                  const hasExtra = Boolean(
                    item.description || item.tags.length > 0 || item.previewImages.length > 0,
                  );
                  return (
                    <PreviewPosterCard
                      key={item.id}
                      to={`/video/${encodeURIComponent(item.id)}`}
                      coverUrl={item.coverUrl}
                      title={item.title}
                      subtitle={
                        [item.brand, item.releaseDate].filter(Boolean).join(' · ') || undefined
                      }
                      footer={
                        hasExtra ? (
                          <Stack spacing={0.75} sx={{ pt: 0.75, px: 0.25 }}>
                            {item.description && (
                              <Typography variant="caption" color="text.secondary">
                                {item.description}
                              </Typography>
                            )}
                            {item.tags.length > 0 && (
                              <Stack
                                direction="row"
                                spacing={0.5}
                                useFlexGap
                                sx={{ flexWrap: 'wrap' }}
                              >
                                {item.tags.slice(0, 4).map((tag) => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    sx={{ height: 20, fontSize: 11, borderRadius: '6px' }}
                                  />
                                ))}
                              </Stack>
                            )}
                            {item.previewImages.length > 0 && (
                              <ImageGallery
                                title={item.videoTitle ?? item.title}
                                images={item.previewImages}
                              />
                            )}
                          </Stack>
                        ) : undefined
                      }
                    />
                  );
                })}
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
