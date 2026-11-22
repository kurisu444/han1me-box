import { useI18n } from '../../app/i18n';
import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { canonicalTag, labelFor, searchOptionCatalog } from '../../data/search_option_catalog';
import type { SearchQuery } from '../../domain/models/search_query';
export function SearchTagDialog({
  query,
  locale,
  onApply,
  onClose,
}: {
  query: SearchQuery;
  locale: string;
  onApply: (tags: string[], broad: boolean) => void;
  onClose: () => void;
}) {
  const tr = useI18n();
  const [selected, setSelected] = useState([...new Set(query.tags.map(canonicalTag))]);
  const [broad, setBroad] = useState(query.broad);
  const [filter, setFilter] = useState('');

  const groups = Object.entries(searchOptionCatalog.tags)
    .map(([name, group]) => ({
      name,
      options: group.options.filter(
        (option) =>
          option.searchKey &&
          Object.values(option.labels).some((label) =>
            label.toLowerCase().includes(filter.toLowerCase()),
          ),
      ),
    }))
    .filter((group) => group.options.length);
  const labels: Record<string, string> = {
    video_attributes: '影片属性',
    character_relationships: '人物关系',
    characteristics: '角色设定',
    appearance_and_figure: '外貌身材',
    story_location: '情境场所',
    story_plot: '故事剧情',
    sex_positions: '性交体位',
  };

  function toggleTag(tag: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, tag] : current.filter((value) => value !== tag),
    );
  }

  function apply() {
    onApply([...selected].sort(), broad);
    onClose();
  }

  function clearSelection() {
    setSelected([]);
    setBroad(false);
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="tags-title">
      <DialogTitle id="tags-title">{tr('选择标签')}</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          label={tr('筛选标签')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: filter && (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={tr('清除标签筛选')}
                    onClick={() => setFilter('')}
                    edge="end"
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Box
          sx={{
            my: 2,
          }}
        >
          {groups.map(({ name, options }) => (
            <FormControl
              component="fieldset"
              key={name}
              fullWidth
              sx={{
                my: 1.5,
              }}
            >
              <FormLabel component="legend">{tr(labels[name] ?? name)}</FormLabel>
              <FormGroup row>
                {options.map((option) => (
                  <FormControlLabel
                    key={option.searchKey}
                    label={labelFor(option, locale)}
                    control={
                      <Checkbox
                        checked={selected.includes(option.searchKey!)}
                        onChange={(_event, checked) => toggleTag(option.searchKey!, checked)}
                      />
                    }
                  />
                ))}
              </FormGroup>
            </FormControl>
          ))}
        </Box>
        <FormControlLabel
          label={tr('广泛匹配')}
          control={<Checkbox checked={broad} onChange={(_event, checked) => setBroad(checked)} />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={clearSelection}>{tr('清空')}</Button>
        <Button onClick={onClose}>{tr('取消')}</Button>
        <Button variant="contained" onClick={apply}>
          {tr('应用')}
          {selected.length}
          {tr('个标签')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
