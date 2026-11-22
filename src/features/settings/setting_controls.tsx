import { useEffect, useState, type ReactNode } from 'react';
import { Box, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { useI18n } from '../../app/i18n';

export function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700, px: 0.5 }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export function SettingRow({
  icon,
  title,
  description,
  control,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  control?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        ...(onClick && {
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }),
      }}
    >
      {icon && (
        <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
      )}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body1" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      {control && <Box sx={{ flexShrink: 0 }}>{control}</Box>}
    </Paper>
  );
}

export function SwitchRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingRow
      icon={icon}
      title={title}
      description={description}
      control={<Switch checked={checked} onChange={(_, value) => onChange(value)} />}
    />
  );
}

export function SelectRow<T extends string | number>({
  icon,
  title,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  value: T;
  options: [T, string][];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <SettingRow
      icon={icon}
      title={title}
      description={description}
      control={
        <TextField
          select
          size="small"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value;
            onChange((typeof value === 'number' ? Number(raw) : raw) as T);
          }}
          sx={{ minWidth: 150 }}
        >
          {options.map(([optionValue, label]) => (
            <MenuItem key={String(optionValue)} value={optionValue}>
              {label}
            </MenuItem>
          ))}
        </TextField>
      }
    />
  );
}

export function NumberRow({
  icon,
  title,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <SettingRow
      icon={icon}
      title={title}
      description={description}
      control={
        <TextField
          type="number"
          size="small"
          value={value}
          slotProps={{ htmlInput: { min, max, step } }}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))}
          sx={{ width: 110 }}
        />
      }
    />
  );
}

export function StringListSetting({
  label,
  values,
  onSave,
}: {
  label: string;
  values: string[];
  onSave: (values: string[]) => void;
}) {
  const tr = useI18n();
  const [draft, setDraft] = useState(values.join('\n'));
  useEffect(() => setDraft(values.join('\n')), [values]);

  function save() {
    onSave([
      ...new Set(
        draft
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ]);
  }

  return (
    <TextField
      label={label}
      multiline
      minRows={2}
      value={draft}
      helperText={tr('每行一项，离开输入框时保存')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
    />
  );
}
