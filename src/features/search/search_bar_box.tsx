import { useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  ClickAwayListener,
  Fade,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../../app/i18n';
import { localize, localizeTag, searchOptionCatalog } from '../../data/search_option_catalog';
import type { SearchQuery } from '../../domain/models/search_query';
import {
  clearSearchHistory,
  loadSearchHistory,
  removeSearchHistory,
  searchRouteUrl,
} from './search_controller';

export function historySummary(query: SearchQuery, locale: string): string {
  const catalog = searchOptionCatalog;
  return (
    [
      query.genre && (localize(catalog.genres, query.genre, locale) ?? query.genre),
      query.sort && (localize(catalog.sorts, query.sort, locale) ?? query.sort),
      query.date && (localize(catalog.releaseDates, query.date, locale) ?? query.date),
      query.duration && (localize(catalog.durations, query.duration, locale) ?? query.duration),
      ...query.tags.map((tag) => localizeTag(tag, locale)),
      query.type && '作者',
    ]
      .filter(Boolean)
      .join(' · ') || '全部内容'
  );
}

export function SearchBarBox({
  value,
  locale,
  height = 42,
  fontSize = 14,
  maxItems,
  allowEmptySubmit = true,
  onChange,
  onClear,
  onSubmit,
  onSelectHistory,
  onFocusChange,
}: {
  value: string;
  locale: string;
  height?: number;
  fontSize?: number;
  maxItems?: number;
  allowEmptySubmit?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
  onSubmit: (event: SyntheticEvent) => void;
  onSelectHistory: (query: SearchQuery) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const tr = useI18n();
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const history = useQuery({
    queryKey: ['search-history'],
    queryFn: loadSearchHistory,
    enabled: focused,
  });
  const historyItems = maxItems ? (history.data?.slice(0, maxItems) ?? []) : (history.data ?? []);

  function updateFocus(next: boolean) {
    setFocused(next);
    onFocusChange?.(next);
  }

  function close() {
    updateFocus(false);
    inputRef.current?.blur();
  }

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (!allowEmptySubmit && !value.trim()) {
      updateFocus(true);
      inputRef.current?.focus();
      return;
    }
    updateFocus(false);
    onSubmit(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close();
    }
  }

  function handleClear() {
    if (onClear) {
      onClear();
    } else {
      onChange('');
      inputRef.current?.focus();
    }
  }

  function selectItem(item: SearchQuery) {
    updateFocus(false);
    onSelectHistory(item);
  }

  async function deleteItem(item: SearchQuery) {
    await removeSearchHistory(item);
    void history.refetch();
  }

  async function clearAll() {
    await clearSearchHistory();
    void history.refetch();
  }

  return (
    <ClickAwayListener mouseEvent="onMouseDown" onClickAway={close}>
      <Box sx={{ position: 'relative', width: '100%' }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            pl: height >= 40 ? 2.25 : 1.75,
            pr: 0.6,
            height,
            borderRadius: '999px',
            bgcolor:
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            outline: focused ? '1.5px solid' : '1px solid transparent',
            outlineColor: focused ? 'primary.main' : 'transparent',
            transition: 'outline-color 0.15s ease',
          }}
        >
          <InputBase
            inputRef={inputRef}
            value={value}
            onFocus={() => updateFocus(true)}
            onClick={() => updateFocus(true)}
            onKeyDown={handleKeyDown}
            onChange={(event) => onChange(event.target.value)}
            placeholder={tr('搜索视频、作者、标签…')}
            inputProps={{ 'aria-label': tr('搜索关键词') }}
            sx={{ flexGrow: 1, fontSize }}
          />
          {value && (
            <IconButton
              size="small"
              aria-label={tr('清除搜索关键词')}
              onClick={handleClear}
              sx={{ color: 'text.secondary', p: 0.4 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <Tooltip title={tr('搜索')}>
            <IconButton type="submit" size="small" aria-label={tr('搜索')}>
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Fade in={focused} unmountOnExit timeout={150}>
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              zIndex: 20,
              p: 2,
              borderRadius: '12px',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}
            >
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
                {tr('搜索历史')}
              </Typography>
              {historyItems.length > 0 && (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => void clearAll()}
                  sx={{ minWidth: 'auto', px: 0.75, py: 0.1, fontSize: 12, opacity: 0.75 }}
                >
                  {tr('清空')}
                </Button>
              )}
            </Stack>
            {historyItems.length > 0 ? (
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {historyItems.map((item) => (
                  <Chip
                    key={searchRouteUrl(item)}
                    clickable
                    size="small"
                    label={item.text || historySummary(item, locale)}
                    onClick={() => selectItem(item)}
                    onDelete={() => void deleteItem(item)}
                    sx={{ borderRadius: '6px', maxWidth: 220 }}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {tr('暂无搜索历史')}
              </Typography>
            )}
          </Paper>
        </Fade>
      </Box>
    </ClickAwayListener>
  );
}
