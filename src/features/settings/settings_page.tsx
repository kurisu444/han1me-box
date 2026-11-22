import { useI18n } from '../../app/i18n';
import { Link } from 'react-router-dom';
import { LayoutSettings } from './layout_settings';
import { DataSettings } from './data_settings';
import { themeColors } from '../../app/app_theme';
import { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { normalizeMirrorUrl, resolvedBaseUrl, type AppSettings } from '../../core/settings';
import { hanimeSiteHosts, siteEndpointUrl, siteHomeUrl } from '../../core/site_url';
import { get } from '../../data/remote/han1me_http_client';

type Key = keyof AppSettings;
const switches: [Key, string][] = [
  ['showHomeFeatured', '首页焦点图'],
  ['useHomeCategoryTabs', '首页分类标签'],
  ['expandHomeVideoCards', '首页展开网格'],
  ['resumePlayback', '断点续播'],
  ['autoPlayOnOpen', '打开自动播放'],
  ['autoPlayNext', '自动播放下一集'],
  ['loopPlayback', '循环播放'],
  ['incognitoPlayback', '无痕播放'],
  ['autoPictureInPicture', '自动画中画'],
  ['useCustomMirrorSite', '使用自定义镜像'],
  ['appendCustomMirrorPath', '保留镜像路径'],
  ['commentsEnabled', '显示评论'],
  ['keyframesEnabled', '启用关键帧'],
  ['amoledMode', '纯黑模式'],
  ['useHorizontalSearchCards', '横向视频卡片'],
  ['useCompactSearchCards', '紧凑搜索卡片'],
  ['useNavigationDrawer', '导航抽屉'],
  ['useLiquidGlassBottomBar', '液态玻璃底栏'],
  ['hideActionsOnScroll', '滚动时隐藏视频操作栏'],
  ['exemptSubscribedAuthors', '豁免已订阅作者'],
  ['applyRecommendationFiltersToRelated', '过滤相关推荐'],
  ['applyRecommendationFiltersToSearch', '过滤搜索结果'],
];
const lists: [Key, string][] = [
  ['blockedCommentKeywords', '屏蔽评论关键词'],
  ['blockedCommentUsers', '屏蔽评论用户'],
  ['blockedVideoTitleKeywords', '屏蔽标题关键词'],
  ['blockedAuthors', '屏蔽作者'],
];
const numeric: [Key, string, number, number, number][] = [
  ['textScale', '字体缩放', 0.8, 1.4, 0.05],
  ['longPressPlaybackSpeed', '长按倍速', 1, 3, 0.25],
  ['defaultPlaybackSpeed', '默认倍速', 0.25, 3, 0.25],
  ['skipSeconds', '快进秒数', 1, 3600, 1],
  ['minimumVideoDurationSeconds', '最短视频秒数', 0, 86400, 1],
  ['minimumVideoViews', '最低播放量（万）', 0, 1000000000, 1],
];
const options: [Key, string, [string | number, string][]][] = [
  ['themeColor', '主题色', [...Object.keys(themeColors), 'custom'].map((key) => [key, key])],
  [
    'themeMode',
    '主题',
    [
      ['system', '跟随系统'],
      ['light', '浅色'],
      ['dark', '深色'],
    ],
  ],
  [
    'language',
    '语言',
    [
      ['system', '跟随系统'],
      ['simplifiedChinese', '简体中文'],
      ['traditionalChinese', '繁體中文'],
      ['english', 'English'],
    ],
  ],
  ['preferredQuality', '默认清晰度', [480, 720, 1080].map((value) => [value, `${value}p`])],
  [
    'videoAspectRatio',
    '画面比例',
    [
      ['auto', '自动'],
      ['crop', '裁剪'],
      ['stretch', '拉伸'],
      ['ratio4x3', '4:3'],
    ],
  ],
  ['baseUrl', '主站', [...hanimeSiteHosts].map((host) => [`https://${host}`, host])],
];
export function SettingsPage() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const [mirror, setMirror] = useState(settings.customMirrorSite);
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [mirrorResult, setMirrorResult] = useState('');
  const [customColor, setCustomColor] = useState(settings.customThemeColor);

  function saveColor() {
    const value = customColor.trim().replace('#', '').toUpperCase();
    if (/^[0-9A-F]{6}$/.test(value)) void save({ themeColor: 'custom', customThemeColor: value });
  }

  function setComicMode(_event: unknown, value: boolean) {
    void save({
      comicMode: value,
      baseUrl: value ? 'https://hanimeone.me' : settings.videoBaseUrl,
      videoBaseUrl: value ? settings.baseUrl : settings.videoBaseUrl,
    });
  }

  async function testConnection() {
    const url = normalizeMirrorUrl(mirror);
    if (!url) {
      setMirrorResult(tr('请输入有效的 HTTPS 镜像地址'));
      return;
    }
    setTesting(true);
    const result = await testMirror(url, settings.appendCustomMirrorPath);
    const labels = {
      success: '连接成功',
      httpError: 'HTTP 请求失败',
      challenge: '网站需要浏览器验证',
      parseFailure: '无法解析首页',
      partialSuccess: '首页可用，搜索请求失败',
      failure: '连接失败',
    };
    setMirrorResult(
      [tr(labels[result.kind]), result.statusCode, result.homeUrl, result.apiBase, result.error]
        .filter(Boolean)
        .join(' · '),
    );
    setTesting(false);
  }

  function set(key: Key, value: unknown) {
    if (key === 'baseUrl') {
      void save({
        baseUrl: String(value),
        videoBaseUrl: settings.comicMode ? settings.videoBaseUrl : String(value),
        useCustomMirrorSite: false,
        customMirrorSite: '',
      });
      setMirror('');
      return;
    }
    void save({
      [key]: value,
    });
  }

  function saveMirror() {
    const value = normalizeMirrorUrl(mirror);
    if (value || !mirror.trim())
      void save({
        customMirrorSite: value,
      });
  }

  async function verify() {
    setVerifying(true);
    try {
      await window.electron.session.verify(resolvedBaseUrl(settings));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Stack
      spacing={3}
      sx={{
        maxWidth: 850,
        mx: 'auto',
      }}
    >
      <Typography variant="h4">{tr('设置')}</Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
        }}
      >
        <Stack spacing={2}>
          {options.map(([key, label, values]) => (
            <TextField
              key={key}
              select
              label={tr(label)}
              value={settings[key]}
              disabled={key === 'baseUrl' && settings.comicMode}
              onChange={(event) =>
                set(
                  key,
                  typeof settings[key] === 'number'
                    ? Number(event.target.value)
                    : event.target.value,
                )
              }
            >
              {values.map(([value, text]) => (
                <MenuItem key={value} value={value}>
                  {tr(text)}
                </MenuItem>
              ))}
            </TextField>
          ))}
          {numeric.map(([key, label, min, max, step]) => (
            <TextField
              key={key}
              type="number"
              label={tr(label)}
              value={settings[key]}
              slotProps={{
                htmlInput: {
                  min,
                  max,
                  step,
                },
              }}
              onChange={(event) =>
                set(key, Math.max(min, Math.min(max, Number(event.target.value))))
              }
            />
          ))}
          {switches.map(([key, label]) => (
            <FormControlLabel
              key={key}
              label={tr(label)}
              control={
                <Switch
                  checked={settings[key] as boolean}
                  onChange={(_, checked) => set(key, checked)}
                />
              }
            />
          ))}
          <FormControlLabel
            label={tr('漫画模式')}
            control={<Switch checked={settings.comicMode} onChange={setComicMode} />}
          />
          {settings.themeColor === 'custom' && (
            <TextField
              label={tr('自定义主题色')}
              value={customColor}
              onChange={(event) => setCustomColor(event.target.value)}
              onBlur={saveColor}
              error={!/^#?[0-9a-f]{6}$/i.test(customColor)}
              helperText="62539F"
            />
          )}
          <TextField
            label={tr('自定义镜像地址')}
            value={mirror}
            onChange={(event) => setMirror(event.target.value)}
            onBlur={saveMirror}
            error={!!mirror && !normalizeMirrorUrl(mirror)}
            helperText={tr('HTTPS 地址，不含查询参数')}
          />
          <Button onClick={verify} disabled={verifying}>
            {tr('网站验证')}
          </Button>
        </Stack>
      </Paper>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6">{tr('过滤与布局')}</Typography>
          {lists.map(([key, label]) => (
            <StringListSetting
              key={key}
              label={tr(label)}
              values={settings[key] as string[]}
              onSave={(values) => set(key, values)}
            />
          ))}
          <LayoutSettings />
        </Stack>
      </Paper>
      <Button component={Link} to="/settings/keyframes">
        {tr('管理关键帧')}
      </Button>
      <Button onClick={testConnection} disabled={testing}>
        {tr(testing ? '正在测试…' : '测试镜像连接')}
      </Button>
      {mirrorResult && <Alert severity="info">{mirrorResult}</Alert>}
      <DataSettings />
      <Button component={Link} to="/settings/logs">
        {tr('诊断日志')}
      </Button>
      <Button component={Link} to="/settings/about">
        {tr('关于')}
      </Button>
    </Stack>
  );
}

export interface MirrorProbeResult {
  kind: 'success' | 'httpError' | 'challenge' | 'parseFailure' | 'partialSuccess' | 'failure';
  statusCode?: number;
  homeUrl?: string;
  apiBase?: string;
  error?: string;
}

async function testMirror(homeUrl: string, appendPath: boolean): Promise<MirrorProbeResult> {
  const base = appendPath ? homeUrl : new URL(homeUrl).origin;
  try {
    const home = await get(siteHomeUrl(homeUrl));
    if (home.body.includes('cf-chl-') || home.body.includes('Just a moment'))
      return { kind: 'challenge' };
    if (home.statusCode >= 400)
      return { kind: 'httpError', statusCode: home.statusCode, homeUrl: home.url };
    if (!home.body.includes('home-rows-wrapper')) return { kind: 'parseFailure' };
    const search = await get(siteEndpointUrl(base, 'search'));
    return {
      kind: search.statusCode >= 400 ? 'partialSuccess' : 'success',
      statusCode: search.statusCode,
      homeUrl: home.url,
      apiBase: base,
    };
  } catch (error) {
    return { kind: 'failure', error: String(error) };
  }
}

function StringListSetting({
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
      value={draft}
      helperText={tr('每行一项，离开输入框时保存')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
    />
  );
}
