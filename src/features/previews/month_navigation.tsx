import { useState } from 'react';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Box, Button, IconButton, Popover, Stack, Typography } from '@mui/material';
import { useI18n } from '../../app/i18n';

const MIN_YEAR = 1990;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function previewMonth(value: string | null) {
  const match = /^(\d{4})-?(\d{2})$/.exec(value ?? '');
  return match && Number(match[2]) >= 1 && Number(match[2]) <= 12
    ? `${match[1]}-${match[2]}`
    : currentMonth();
}

export function offsetMonth(value: string, amount: number) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthNavigation({
  month,
  onChange,
  future = false,
}: {
  month: string;
  onChange(value: string): void;
  future?: boolean;
}) {
  const tr = useI18n();
  const now = currentMonth();
  const max = future ? `${new Date().getFullYear() + 2}-12` : now;
  const maxYear = Number(max.slice(0, 4));
  const [year, monthNum] = month.split('-').map(Number);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pickerYear, setPickerYear] = useState(year);

  function select(value: string) {
    onChange(value);
    setAnchor(null);
  }

  return (
    <>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 46,
          px: 1,
          borderRadius: '12px',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <IconButton
          size="small"
          title={tr('上个月')}
          aria-label={tr('上个月')}
          disabled={month <= `${MIN_YEAR}-01`}
          onClick={() => onChange(offsetMonth(month, -1))}
        >
          <ChevronLeftRoundedIcon fontSize="small" />
        </IconButton>

        <Button
          color="inherit"
          startIcon={<CalendarMonthRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
          onClick={(event) => {
            setPickerYear(year);
            setAnchor(event.currentTarget);
          }}
          sx={{ px: 2, py: 0.6, borderRadius: '8px', fontSize: 14, fontWeight: 600 }}
        >
          {tr('{0} 年 {1} 月', year, monthNum)}
        </Button>

        <IconButton
          size="small"
          title={tr('下个月')}
          aria-label={tr('下个月')}
          disabled={!future && month >= max}
          onClick={() => onChange(offsetMonth(month, 1))}
        >
          <ChevronRightRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 1.5,
              width: 268,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'divider',
            },
          },
        }}
      >
        <Stack spacing={1.25}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton
              size="small"
              disabled={pickerYear <= MIN_YEAR}
              onClick={() => setPickerYear((y) => Math.max(MIN_YEAR, y - 1))}
            >
              <ChevronLeftRoundedIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{pickerYear}</Typography>
            <IconButton
              size="small"
              disabled={pickerYear >= maxYear}
              onClick={() => setPickerYear((y) => Math.min(maxYear, y + 1))}
            >
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
            {MONTHS.map((m) => {
              const candidate = `${pickerYear}-${String(m).padStart(2, '0')}`;
              const active = candidate === month;
              return (
                <Button
                  key={m}
                  size="small"
                  variant={active ? 'contained' : 'text'}
                  color={active ? 'primary' : 'inherit'}
                  disabled={candidate > max || candidate < `${MIN_YEAR}-01`}
                  onClick={() => select(candidate)}
                  sx={{ borderRadius: '8px', py: 0.6, minWidth: 0, fontSize: 12.5 }}
                >
                  {tr('{0}月', m)}
                </Button>
              );
            })}
          </Box>

          {month !== now && (
            <Button
              size="small"
              onClick={() => select(now)}
              sx={{ borderRadius: '8px', fontSize: 12.5 }}
            >
              {tr('回到本月')}
            </Button>
          )}
        </Stack>
      </Popover>
    </>
  );
}
