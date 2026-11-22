import { useI18n } from '../../app/i18n';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { loadSearchHistory, removeSearchHistory } from './search_controller';
import { localize, localizeTag, searchOptionCatalog } from '../../data/search_option_catalog';
import { type SearchQuery } from '../../domain/models/search_query';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '../shared/request_error';

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
export function SearchHistorySheet({
  locale,
  onSelect,
  onClose,
}: {
  locale: string;
  onSelect: (query: SearchQuery) => void;
  onClose: () => void;
}) {
  const tr = useI18n();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['search-history'],
    queryFn: loadSearchHistory,
  });

  async function remove(query: SearchQuery) {
    await removeSearchHistory(query);
    refetch();
  }

  function selectQuery(query: SearchQuery) {
    onSelect(query);
    onClose();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="history-title">
      <DialogTitle id="history-title">{tr('搜索历史')}</DialogTitle>
      <DialogContent dividers>
        {isPending && <LoadingState label={tr('正在读取历史…')} />}
        {(error || data?.length === 0) && (
          <Typography
            color="text.secondary"
            sx={{
              py: 3,
            }}
          >
            {tr('暂无搜索历史。')}
          </Typography>
        )}
        <List disablePadding>
          {data?.map((query, index) => (
            <ListItem
              key={index}
              disablePadding
              divider
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label={tr('删除搜索记录 {0}', query.text || historySummary(query, locale))}
                  onClick={() => void remove(query)}
                >
                  <DeleteOutlinedIcon />
                </IconButton>
              }
            >
              <ListItemButton
                onClick={() => selectQuery(query)}
                sx={{
                  pr: 7,
                }}
              >
                <ListItemText
                  primary={query.text || historySummary(query, locale).split(' · ')[0]}
                  secondary={historySummary(query, locale)}
                  sx={{
                    overflowWrap: 'anywhere',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          {tr('关闭')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
