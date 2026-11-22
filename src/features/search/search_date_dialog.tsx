import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { labelFor, searchOptionCatalog } from '../../data/search_option_catalog';
import { useI18n } from '../../app/i18n';

export function SearchDateDialog({
  current,
  locale,
  onApply,
  onClose,
}: {
  current: string;
  locale: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const tr = useI18n();
  const [mode, setMode] = useState(
    searchOptionCatalog.releaseDates.options.some((option) => option.searchKey === current) ||
      !current
      ? 'range'
      : 'month',
  );
  const [range, setRange] = useState(mode === 'range' ? current : '');
  const [year, setYear] = useState(
    mode === 'month' ? current.split(' ').slice(0, 2).join(' ') : '',
  );
  const [month, setMonth] = useState(
    mode === 'month' ? current.split(' ').slice(2, 4).join(' ') : '',
  );

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1989 }, (_, index) => `${thisYear - index} 年`);

  function apply() {
    onApply(mode === 'range' ? range : [year, month].filter(Boolean).join(' '));
    onClose();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{tr('发布日期')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Tabs value={mode} onChange={(_, value) => setMode(value)}>
            <Tab value="range" label={tr('时间范围')} />
            <Tab value="month" label={tr('指定年月')} />
          </Tabs>
          {mode === 'range' ? (
            <TextField
              select
              label={tr('发布日期')}
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              {searchOptionCatalog.releaseDates.options.map((option) => (
                <MenuItem key={option.searchKey ?? ''} value={option.searchKey ?? ''}>
                  {option.searchKey ? labelFor(option, locale) : tr('全部')}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label={tr('年份')}
                value={year}
                fullWidth
                onChange={(event) => setYear(event.target.value)}
              >
                {['', ...years].map((value) => (
                  <MenuItem key={value} value={value}>
                    {value || tr('所有年份')}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={tr('月份')}
                value={month}
                fullWidth
                onChange={(event) => setMonth(event.target.value)}
              >
                {['', ...Array.from({ length: 12 }, (_, index) => `${index + 1} 月`)].map(
                  (value) => (
                    <MenuItem key={value} value={value}>
                      {value || tr('所有月份')}
                    </MenuItem>
                  ),
                )}
              </TextField>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tr('取消')}</Button>
        <Button onClick={apply}>{tr('应用')}</Button>
      </DialogActions>
    </Dialog>
  );
}
