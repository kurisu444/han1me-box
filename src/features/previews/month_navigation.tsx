import { Button, Stack, TextField } from '@mui/material';
import { useI18n } from '../../app/i18n';

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
  const max = future ? `${new Date().getFullYear() + 2}-12` : currentMonth();

  return (
    <Stack direction="row" spacing={1}>
      <Button onClick={() => onChange(offsetMonth(month, -1))}>{tr('上个月')}</Button>
      <TextField
        type="month"
        label={tr('月份')}
        value={month}
        onChange={(event) => onChange(previewMonth(event.target.value))}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: '1990-01', max } }}
      />
      <Button disabled={!future && month >= max} onClick={() => onChange(offsetMonth(month, 1))}>
        {tr('下个月')}
      </Button>
    </Stack>
  );
}
