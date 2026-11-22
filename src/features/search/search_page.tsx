import { VideoGrid, VideoCardTile, VideoCover, CompactVideoCard } from '../shared/video_card';
import { useI18n } from '../../app/i18n';
import { useAccount } from '../account/account_controller';
import { SearchDateDialog } from './search_date_dialog';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import {
  searchOptionCatalog,
  searchLocale,
  labelFor,
  localize,
  localizeTag,
  type SearchOptionGroup,
} from '../../data/search_option_catalog';
import * as repository from '../../data/han1me_repository';
import {
  recordSearch,
  canonicalQuery,
  compactSearchGenre,
  filterSearchResult,
  searchRouteQuery,
  searchRouteUrl,
} from './search_controller';
import {
  createSearchQuery,
  searchQueryToUri,
  type SearchQuery,
} from '../../domain/models/search_query';
import { RequestError, LoadingState } from '../shared/request_error';
import { useQuery } from '@tanstack/react-query';
import { SearchHistorySheet } from './search_history_sheet';
import { SearchTagDialog } from './search_tag_dialog';

function OptionSelect({
  label,
  group,
  value,
  locale,
  onChange,
}: {
  label: string;
  group: SearchOptionGroup;
  value: string;
  locale: string;
  onChange: (value: string) => void;
}) {
  const tr = useI18n();

  return (
    <TextField
      select
      label={tr(label)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        inputLabel: {
          shrink: true,
        },
        select: {
          displayEmpty: true,
        },
      }}
      sx={{
        minWidth: 150,
        flex: 1,
      }}
    >
      {!group.options.some((option) => (option.searchKey ?? '') === value) && (
        <MenuItem value={value}>{value || tr('全部')}</MenuItem>
      )}
      {group.options.map((option, index) => (
        <MenuItem key={index} value={option.searchKey ?? ''}>
          {labelFor(option, locale)}
        </MenuItem>
      ))}
    </TextField>
  );
}
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const filters = [
    {
      key: 'genre',
      label: '分类',
      group: searchOptionCatalog.genres,
    },
    {
      key: 'sort',
      label: '排序',
      group: searchOptionCatalog.sorts,
    },
    {
      key: 'date',
      label: '发布日期',
      group: searchOptionCatalog.releaseDates,
    },
    {
      key: 'duration',
      label: '时长',
      group: searchOptionCatalog.durations,
    },
  ] as const;

  function replace(next: SearchQuery) {
    navigate(
      searchRouteUrl(
        canonicalQuery({
          ...next,
          page: 1,
        }),
      ),
    );
  }

  function update(values: Partial<SearchQuery>) {
    replace({
      ...query,
      ...values,
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (input.trim() === query.text && query.page === 1) refetch();
    else
      update({
        text: input.trim(),
      });
  }

  function clearInput() {
    setInput('');
    update({ text: '' });
  }

  function changePage(_event: ChangeEvent<unknown>, page: number) {
    navigate(
      searchRouteUrl({
        ...query,
        page,
      }),
    );
  }

  function jumpToPage(event: FormEvent) {
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
      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography component="h1" variant="h4">
          {tr('搜索与筛选')}
        </Typography>
        <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setHistoryOpen(true)}>
          {tr('搜索历史')}
        </Button>
      </Stack>
      <Stack
        component="form"
        direction="row"
        spacing={2}
        onSubmit={submit}
        sx={{
          mb: 3,
        }}
      >
        <TextField
          fullWidth
          type="search"
          label={tr('搜索关键词')}
          placeholder={tr('搜索视频或作者')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: input && (
                <InputAdornment position="end">
                  <IconButton aria-label={tr('清除搜索关键词')} onClick={clearInput} edge="end">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button variant="contained" type="submit">
          {tr('搜索')}
        </Button>
      </Stack>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
          }}
        >
          {filters
            .filter(({ key }) => key !== 'date')
            .map(({ key, label, group }) => (
              <OptionSelect
                key={key}
                label={tr(label)}
                group={group}
                locale={locale}
                value={query[key]}
                onChange={(value) =>
                  update({
                    [key]: value,
                  })
                }
              />
            ))}
          <Button onClick={() => setDateOpen(true)}>
            {tr('发布日期')}：
            {localize(searchOptionCatalog.releaseDates, query.date, locale) ||
              query.date ||
              tr('全部')}
          </Button>
          <TextField
            select
            label={tr('类型')}
            value={query.type}
            onChange={(event) =>
              update({
                type: event.target.value,
              })
            }
            slotProps={{
              inputLabel: {
                shrink: true,
              },
              select: {
                displayEmpty: true,
              },
            }}
            sx={{
              minWidth: 120,
            }}
          >
            <MenuItem value="">{tr('视频')}</MenuItem>
            <MenuItem value="artist">{tr('作者')}</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            startIcon={<LabelOutlinedIcon />}
            onClick={() => setTagsOpen(true)}
          >
            {tr('标签（')}
            {query.tags.length}）{query.broad ? tr(' · 广泛匹配') : ''}
          </Button>
          <Button startIcon={<RestartAltIcon />} onClick={() => replace(createSearchQuery())}>
            {tr('重置筛选')}
          </Button>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
            mt: 2,
          }}
          aria-label={tr('已选筛选条件')}
        >
          {filters
            .filter(({ key }) => query[key])
            .map(({ key, label, group }) => (
              <Chip
                key={key}
                label={`${label}：${localize(group, query[key], locale) ?? query[key]}`}
                onDelete={() =>
                  update({
                    [key]: '',
                  })
                }
              />
            ))}
          {query.type && (
            <Chip
              label={tr('类型：作者')}
              onDelete={() =>
                update({
                  type: '',
                })
              }
            />
          )}
          {query.tags.map((tag, index) => (
            <Chip
              key={`${tag}-${index}`}
              label={localizeTag(tag, locale)}
              aria-label={tr('移除标签 {0}', localizeTag(tag, locale))}
              onDelete={() =>
                update({
                  tags: query.tags.filter((value) => value !== tag),
                })
              }
            />
          ))}
          {query.broad && (
            <Chip
              label={tr('广泛匹配')}
              onDelete={() =>
                update({
                  broad: false,
                })
              }
            />
          )}
        </Stack>
      </Paper>
      {isPending && <LoadingState label={tr('正在搜索…')} />}
      {error && <RequestError error={error} onRetry={refetch} />}
      {!isPending && !error && data && (
        <>
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {tr('第')}
              {currentPage} / {totalPages}
              {tr('页 · 本页')}
              {data.items.length}
              {tr('项')}
            </Typography>
            <Button startIcon={<RefreshIcon />} onClick={() => refetch()}>
              {tr('刷新结果')}
            </Button>
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
                    onClick={() =>
                      update({
                        text: item.artistQuery ?? item.title,
                        type: '',
                      })
                    }
                    sx={{
                      height: '100%',
                    }}
                  >
                    <Box
                      sx={{
                        aspectRatio: '1',
                      }}
                    >
                      <VideoCover url={item.coverUrl} title={item.title} />
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                      }}
                    >
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
            sx={{
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              my: 4,
            }}
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
                required
                value={jumpPage}
                onChange={(event) => setJumpPage(event.target.value)}
                slotProps={{
                  htmlInput: {
                    min: 1,
                    max: totalPages,
                    step: 1,
                  },
                }}
                sx={{
                  width: 100,
                }}
              />
              <Button type="submit" variant="outlined">
                {tr('跳转')}
              </Button>
            </Stack>
          </Stack>
        </>
      )}
      {historyOpen && (
        <SearchHistorySheet
          locale={locale}
          onSelect={replace}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {tagsOpen && (
        <SearchTagDialog
          query={query}
          locale={locale}
          onApply={(tags, broad) =>
            update({
              tags,
              broad,
            })
          }
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
