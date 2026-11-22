import { useState, type SyntheticEvent } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  InputBase,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  useTheme,
} from '@mui/material';
import { useI18n } from '../../app/i18n';
import {
  labelFor,
  localize,
  localizeTag,
  searchOptionCatalog,
} from '../../data/search_option_catalog';
import type { SearchQuery } from '../../domain/models/search_query';

interface SearchHeaderProps {
  query: SearchQuery;
  input: string;
  locale: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: SyntheticEvent) => void;
  onClearInput: () => void;
  onUpdate: (values: Partial<SearchQuery>) => void;
  onReset: () => void;
  onBack: () => void;
  onOpenHistory: () => void;
  onOpenTags: () => void;
  onOpenDate: () => void;
}

export function SearchHeader({
  query,
  input,
  locale,
  onInputChange,
  onSubmit,
  onClearInput,
  onUpdate,
  onReset,
  onBack,
  onOpenHistory,
  onOpenTags,
  onOpenDate,
}: SearchHeaderProps) {
  const tr = useI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [moreOpen, setMoreOpen] = useState(false);

  const extraFilterCount =
    (query.date ? 1 : 0) +
    (query.duration ? 1 : 0) +
    (query.type ? 1 : 0) +
    query.tags.length +
    (query.broad ? 1 : 0);

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title={tr('返回')}>
          <IconButton onClick={onBack} aria-label={tr('返回')}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              maxWidth: 520,
              pl: 2.25,
              pr: 0.75,
              height: 42,
              borderRadius: '999px',
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              '&:focus-within': {
                outline: '1.5px solid',
                outlineColor: 'primary.main',
              },
            }}
          >
            <InputBase
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={tr('搜索视频、作者、标签…')}
              inputProps={{ 'aria-label': tr('搜索关键词') }}
              sx={{ flexGrow: 1, fontSize: 14 }}
            />
            {input && (
              <IconButton size="small" aria-label={tr('清除搜索关键词')} onClick={onClearInput}>
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton type="submit" size="small" aria-label={tr('搜索')}>
              <SearchIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Tooltip title={tr('搜索历史')}>
          <IconButton onClick={onOpenHistory} aria-label={tr('搜索历史')}>
            <HistoryIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          justifyContent: 'center',
          flexWrap: 'wrap',
          rowGap: 0.5,
        }}
      >
        {searchOptionCatalog.genres.options.map((option) => {
          const key = option.searchKey ?? '';
          const selected = query.genre === key;
          return (
            <Button
              key={key || 'all'}
              size="small"
              color={selected ? 'primary' : 'inherit'}
              onClick={() => onUpdate({ genre: key })}
              sx={{
                position: 'relative',
                minWidth: 'auto',
                px: 1.25,
                py: 0.5,
                fontWeight: selected ? 700 : 500,
                opacity: selected ? 1 : 0.8,
                '&::after': selected
                  ? {
                      content: '""',
                      position: 'absolute',
                      left: '25%',
                      right: '25%',
                      bottom: 0,
                      height: 2.5,
                      borderRadius: 999,
                      bgcolor: 'primary.main',
                    }
                  : undefined,
              }}
            >
              {labelFor(option, locale)}
            </Button>
          );
        })}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 1.5,
          '@media (max-width:960px)': {
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          },
        }}
      >
        <Box sx={{ '@media (max-width:960px)': { display: 'none' } }} />
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {searchOptionCatalog.sorts.options.map((option) => {
            const key = option.searchKey ?? '';
            const selected = query.sort === key;
            return (
              <Chip
                key={key || 'default'}
                label={labelFor(option, locale)}
                color={selected ? 'primary' : 'default'}
                onClick={() => onUpdate({ sort: key })}
                sx={{
                  height: 34,
                  px: 0.75,
                  fontSize: 13,
                  borderRadius: '10px',
                  fontWeight: selected ? 600 : 400,
                  ...(!selected && {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.045)',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.11)' : 'rgba(0, 0, 0, 0.08)',
                    },
                  }),
                }}
              />
            );
          })}
        </Stack>
        <Box sx={{ justifySelf: 'end' }}>
          <Button
            size="small"
            color={moreOpen || extraFilterCount > 0 ? 'primary' : 'inherit'}
            startIcon={<TuneIcon fontSize="small" />}
            onClick={() => setMoreOpen((open) => !open)}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {tr('更多筛选')}
            {extraFilterCount > 0 ? ` (${extraFilterCount})` : ''}
          </Button>
        </Box>
      </Box>

      <Collapse in={moreOpen}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: '12px',
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          >
            <TextField
              select
              size="small"
              value={query.duration}
              onChange={(event) => onUpdate({ duration: event.target.value })}
              slotProps={{
                select: {
                  displayEmpty: true,
                  renderValue: (selected) =>
                    `${tr('时长')}：${localize(searchOptionCatalog.durations, String(selected), locale) || tr('全部')}`,
                },
              }}
              sx={{
                minWidth: 130,
                '& .MuiInputBase-root': { height: 36, borderRadius: '8px', fontSize: 13 },
              }}
            >
              {searchOptionCatalog.durations.options.map((option) => (
                <MenuItem key={option.searchKey ?? 'all'} value={option.searchKey ?? ''}>
                  {labelFor(option, locale)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              value={query.type}
              onChange={(event) => onUpdate({ type: event.target.value })}
              slotProps={{
                select: {
                  displayEmpty: true,
                  renderValue: (selected) =>
                    `${tr('类型')}：${selected === 'artist' ? tr('作者') : tr('视频')}`,
                },
              }}
              sx={{
                minWidth: 115,
                '& .MuiInputBase-root': { height: 36, borderRadius: '8px', fontSize: 13 },
              }}
            >
              <MenuItem value="">{tr('视频')}</MenuItem>
              <MenuItem value="artist">{tr('作者')}</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={onOpenDate}
              sx={{
                height: 36,
                borderRadius: '8px',
                borderColor: 'divider',
                color: 'text.primary',
                fontWeight: 400,
              }}
            >
              {tr('发布日期')}：
              {localize(searchOptionCatalog.releaseDates, query.date, locale) ||
                query.date ||
                tr('全部')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LabelOutlinedIcon fontSize="small" />}
              onClick={onOpenTags}
              sx={{
                height: 36,
                borderRadius: '8px',
                borderColor: 'divider',
                color: 'text.primary',
                fontWeight: 400,
              }}
            >
              {tr('标签（')}
              {query.tags.length}）{query.broad ? tr(' · 广泛匹配') : ''}
            </Button>
            <Button
              size="small"
              color="inherit"
              startIcon={<RestartAltIcon fontSize="small" />}
              onClick={onReset}
              sx={{ ml: 'auto', height: 36, color: 'text.secondary' }}
            >
              {tr('重置筛选')}
            </Button>
          </Stack>
        </Box>
      </Collapse>

      {extraFilterCount > 0 && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
          aria-label={tr('已选筛选条件')}
        >
          {query.date && (
            <Chip
              size="small"
              label={`${tr('发布日期')}：${localize(searchOptionCatalog.releaseDates, query.date, locale) ?? query.date}`}
              onDelete={() => onUpdate({ date: '' })}
            />
          )}
          {query.duration && (
            <Chip
              size="small"
              label={`${tr('时长')}：${localize(searchOptionCatalog.durations, query.duration, locale) ?? query.duration}`}
              onDelete={() => onUpdate({ duration: '' })}
            />
          )}
          {query.type && (
            <Chip size="small" label={tr('类型：作者')} onDelete={() => onUpdate({ type: '' })} />
          )}
          {query.tags.map((tag) => (
            <Chip
              key={tag}
              size="small"
              label={localizeTag(tag, locale)}
              aria-label={tr('移除标签 {0}', localizeTag(tag, locale))}
              onDelete={() => onUpdate({ tags: query.tags.filter((value) => value !== tag) })}
            />
          ))}
          {query.broad && (
            <Chip size="small" label={tr('广泛匹配')} onDelete={() => onUpdate({ broad: false })} />
          )}
        </Stack>
      )}
    </Stack>
  );
}
