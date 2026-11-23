import { useEffect, useMemo, useState, type ChangeEvent, type SyntheticEvent } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  IconButton,
  Pagination,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import * as repository from '../../data/han1me_repository';
import { searchLocale } from '../../data/search_option_catalog';
import {
  createSearchQuery,
  searchQueryToUri,
  type SearchQuery,
} from '../../domain/models/search_query';
import { useAccount } from '../account/account_controller';
import { LoadingState, RequestError } from '../shared/request_error';
import { CompactVideoCard, VideoCardTile, VideoCover, VideoGrid } from '../shared/video_card';
import {
  canonicalQuery,
  compactSearchGenre,
  filterSearchResult,
  recordSearch,
  searchRouteQuery,
  searchRouteUrl,
} from './search_controller';
import { SearchDateDialog } from './search_date_dialog';
import { SearchHeader } from './search_header';
import { SearchTagDialog } from './search_tag_dialog';

export function SearchPage() {
  const tr = useI18n();
  const settings = useSettings();
  const { ready } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const baseUrl = useMemo(() => resolvedBaseUrl(settings), [settings]);
  const query = useMemo(() => searchRouteQuery(location.search), [location.search]);
  const historyKey = useMemo(() => searchQueryToUri(query), [query]);
  const [input, setInput] = useState(query.text);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [jumpPage, setJumpPage] = useState(String(query.page));

  const { data, isPending, error, refetch } = useQuery({
    ...repository.search(baseUrl, query),
    enabled: ready !== false,
    select: (result) => filterSearchResult(result, settings),
  });

  useEffect(() => {
    setInput(query.text);
    setJumpPage(String(query.page));
  }, [query]);

  useEffect(() => {
    void recordSearch(searchRouteQuery(historyKey)).catch(() => {});
  }, [historyKey]);

  const locale = searchLocale(settings.language, navigator.language);
  const totalPages = Math.max(data?.totalPages ?? query.page, data?.page ?? query.page);
  const currentPage = data?.page ?? query.page;
  const compact = settings.useCompactSearchCards && compactSearchGenre(query.genre);

  function replace(next: SearchQuery) {
    navigate(searchRouteUrl(canonicalQuery({ ...next, page: 1 })));
  }

  function update(values: Partial<SearchQuery>) {
    replace({ ...query, ...values });
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (input.trim() === query.text && query.page === 1) {
      refetch();
    } else {
      update({ text: input.trim() });
    }
  }

  function clearInput() {
    setInput('');
    update({ text: '' });
  }

  function goBack() {
    navigate('/');
  }

  function changePage(_event: ChangeEvent<unknown>, page: number) {
    navigate(searchRouteUrl({ ...query, page }));
  }

  function jumpToPage(event: SyntheticEvent) {
    event.preventDefault();
    navigate(
      searchRouteUrl({
        ...query,
        page: Math.max(1, Math.min(Number(jumpPage), totalPages)),
      }),
    );
  }

  return (
    <>
      <SearchHeader
        query={query}
        input={input}
        locale={locale}
        onInputChange={setInput}
        onSubmit={submit}
        onClearInput={clearInput}
        onUpdate={update}
        onSelectHistory={replace}
        onReset={() => replace(createSearchQuery())}
        onBack={goBack}
        onOpenTags={() => setTagsOpen(true)}
        onOpenDate={() => setDateOpen(true)}
      />
      {isPending && <LoadingState label={tr('正在搜索…')} />}
      {error && <RequestError error={error} onRetry={refetch} />}
      {!isPending && !error && data && (
        <>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {tr('第')}
              {currentPage} / {totalPages}
              {tr('页 · 本页')}
              {data.items.length}
              {tr('项')}
            </Typography>
            <Tooltip title={tr('刷新结果')}>
              <IconButton
                size="small"
                onClick={() => refetch()}
                aria-label={tr('刷新结果')}
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <VideoGrid layout={compact ? 'compact' : 'grid'}>
            {data.items.map((item, index) =>
              item.id ? (
                compact ? (
                  <CompactVideoCard key={`${item.id}-${index}`} video={item} vertical />
                ) : (
                  <VideoCardTile key={`${item.id}-${index}`} video={item} />
                )
              ) : (
                <Card key={`${item.artistQuery}-${index}`}>
                  <CardActionArea
                    onClick={() => update({ text: item.artistQuery ?? item.title, type: '' })}
                    sx={{ height: '100%' }}
                  >
                    <Box sx={{ aspectRatio: '1' }}>
                      <VideoCover url={item.coverUrl} title={item.title} />
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <Typography variant="subtitle1">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.artist}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              ),
            )}
          </VideoGrid>
          {data.items.length === 0 && (
            <Alert severity="info">{tr('没有符合当前条件的结果。')}</Alert>
          )}
          <Stack
            direction="row"
            spacing={2}
            useFlexGap
            sx={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', my: 4 }}
          >
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={changePage}
              color="primary"
              showFirstButton
              showLastButton
            />
            <Stack component="form" direction="row" spacing={1} onSubmit={jumpToPage}>
              <TextField
                label={tr('跳转页码')}
                type="number"
                size="small"
                required
                value={jumpPage}
                onChange={(event) => setJumpPage(event.target.value)}
                slotProps={{ htmlInput: { min: 1, max: totalPages, step: 1 } }}
                sx={{ width: 100 }}
              />
              <Button type="submit" variant="outlined" size="small">
                {tr('跳转')}
              </Button>
            </Stack>
          </Stack>
        </>
      )}
      {tagsOpen && (
        <SearchTagDialog
          query={query}
          locale={locale}
          onApply={(tags, broad) => update({ tags, broad })}
          onClose={() => setTagsOpen(false)}
        />
      )}
      {dateOpen && (
        <SearchDateDialog
          current={query.date}
          locale={locale}
          onApply={(date) => update({ date })}
          onClose={() => setDateOpen(false)}
        />
      )}
    </>
  );
}
