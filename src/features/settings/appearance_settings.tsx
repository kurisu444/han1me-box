import { useState } from 'react';
import ContrastOutlinedIcon from '@mui/icons-material/ContrastOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import { Box, Chip, Paper, Slider, Stack, TextField, Typography } from '@mui/material';
import { themeColors } from '../../app/app_theme';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import type { AppLanguage, AppThemeColor, AppThemeMode } from '../../core/settings';
import { LayoutSettings } from './layout_settings';
import { SelectRow, SettingSection, SwitchRow } from './setting_controls';

const colorEntries = Object.entries(themeColors) as [Exclude<AppThemeColor, 'custom'>, string][];

export function AppearanceSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const [customColor, setCustomColor] = useState(settings.customThemeColor);

  function saveColor() {
    const value = customColor.trim().replace('#', '').toUpperCase();
    if (/^[0-9A-F]{6}$/.test(value)) {
      void save({ themeColor: 'custom', customThemeColor: value });
    }
  }

  return (
    <Stack spacing={3}>
      <SettingSection title={tr('外观')}>
        <SelectRow<AppThemeMode>
          icon={<ContrastOutlinedIcon />}
          title={tr('主题')}
          value={settings.themeMode}
          options={[
            ['system', tr('跟随系统')],
            ['light', tr('浅色')],
            ['dark', tr('深色')],
          ]}
          onChange={(themeMode) => void save({ themeMode })}
        />
        <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: '12px' }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <PaletteOutlinedIcon sx={{ color: 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {tr('主题色')}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {colorEntries.map(([key, hex]) => {
                const selected = settings.themeColor === key;
                return (
                  <Box
                    key={key}
                    component="button"
                    type="button"
                    aria-label={key}
                    onClick={() => void save({ themeColor: key })}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: hex,
                      border: '2px solid',
                      borderColor: selected ? 'text.primary' : 'transparent',
                      outline: selected ? '2px solid' : 'none',
                      outlineColor: hex,
                      outlineOffset: 1,
                      cursor: 'pointer',
                      p: 0,
                    }}
                  />
                );
              })}
              <Chip
                label={tr('自定义')}
                size="small"
                variant={settings.themeColor === 'custom' ? 'filled' : 'outlined'}
                color={settings.themeColor === 'custom' ? 'primary' : 'default'}
                onClick={() => void save({ themeColor: 'custom' })}
              />
            </Stack>
            {settings.themeColor === 'custom' && (
              <TextField
                label={tr('自定义主题色')}
                size="small"
                value={customColor}
                onChange={(event) => setCustomColor(event.target.value)}
                onBlur={saveColor}
                error={!/^#?[0-9a-f]{6}$/i.test(customColor)}
                helperText="62539F"
                sx={{ maxWidth: 220 }}
              />
            )}
          </Stack>
        </Paper>
        <SelectRow<AppLanguage>
          icon={<TranslateOutlinedIcon />}
          title={tr('语言')}
          value={settings.language}
          options={[
            ['system', tr('跟随系统')],
            ['simplifiedChinese', '简体中文'],
            ['traditionalChinese', '繁體中文'],
            ['english', 'English'],
          ]}
          onChange={(language) => void save({ language })}
        />
      </SettingSection>
      <SettingSection title={tr('显示')}>
        <SwitchRow
          icon={<ContrastOutlinedIcon />}
          title={tr('纯黑模式')}
          description={tr('深色主题下使用纯黑背景')}
          checked={settings.amoledMode}
          onChange={(amoledMode) => void save({ amoledMode })}
        />
        <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: '12px' }}>
          <Stack spacing={1}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {tr('字体缩放')}
              </Typography>
              <Chip
                label={`${Math.round(settings.textScale * 100)}%`}
                size="small"
                variant="outlined"
              />
            </Stack>
            <Slider
              value={settings.textScale}
              min={0.8}
              max={1.4}
              step={0.05}
              onChange={(_, value) =>
                void save({ textScale: Array.isArray(value) ? value[0] : value })
              }
            />
          </Stack>
        </Paper>
      </SettingSection>
    </Stack>
  );
}

export function InterfaceLayoutSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();

  return (
    <Stack spacing={3}>
      <SettingSection title={tr('常规')}>
        <SwitchRow
          title={tr('关闭时最小化到托盘')}
          description={tr('关闭主窗口时隐藏到系统托盘，保持后台下载')}
          checked={settings.minimizeToTray}
          onChange={(minimizeToTray) => void save({ minimizeToTray })}
        />
      </SettingSection>
      <SettingSection title={tr('首页与导航')}>
        <SwitchRow
          title={tr('首页焦点图')}
          checked={settings.showHomeFeatured}
          onChange={(showHomeFeatured) => void save({ showHomeFeatured })}
        />
        <SwitchRow
          title={tr('搜索竖版海报卡片')}
          description={tr('在搜索页筛选里番或泡面番时，使用 3:4 竖版海报展示')}
          checked={settings.useCompactSearchCards}
          onChange={(useCompactSearchCards) => void save({ useCompactSearchCards })}
        />
      </SettingSection>
      <SettingSection title={tr('分区与标签排序')}>
        <LayoutSettings />
      </SettingSection>
    </Stack>
  );
}
