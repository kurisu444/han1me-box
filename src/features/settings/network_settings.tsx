import { useState } from 'react';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { Alert, Button, Paper, Stack, TextField } from '@mui/material';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { normalizeMirrorUrl, resolvedBaseUrl } from '../../core/settings';
import { hanimeSiteHosts, siteEndpointUrl, siteHomeUrl } from '../../core/site_url';
import { get } from '../../data/remote/han1me_http_client';
import { SelectRow, SettingRow, SettingSection, SwitchRow } from './setting_controls';

export interface MirrorProbeResult {
  kind: 'success' | 'httpError' | 'challenge' | 'parseFailure' | 'partialSuccess' | 'failure';
  statusCode?: number;
  homeUrl?: string;
  apiBase?: string;
  error?: string;
}

const siteOptions: [string, string][] = [...hanimeSiteHosts].map((host) => [
  `https://${host}`,
  host,
]);

export function NetworkSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const [mirror, setMirror] = useState(settings.customMirrorSite);
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [mirrorResult, setMirrorResult] = useState('');

  function changeBaseUrl(value: string) {
    void save({
      baseUrl: value,
      useCustomMirrorSite: false,
      customMirrorSite: '',
    });
    setMirror('');
  }

  function saveMirror() {
    const value = normalizeMirrorUrl(mirror);
    if (value || !mirror.trim()) {
      void save({ customMirrorSite: value });
    }
  }

  async function verify() {
    setVerifying(true);
    try {
      await window.electron.session.verify(resolvedBaseUrl(settings));
    } finally {
      setVerifying(false);
    }
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

  return (
    <Stack spacing={3}>
      <SettingSection title={tr('站点连接')}>
        <SelectRow
          icon={<LanguageOutlinedIcon />}
          title={tr('主站')}
          value={settings.baseUrl}
          options={siteOptions}
          onChange={changeBaseUrl}
        />
        <SettingRow
          icon={<VerifiedUserOutlinedIcon />}
          title={tr('网站验证')}
          description={resolvedBaseUrl(settings)}
          control={
            <Button variant="outlined" size="small" onClick={verify} disabled={verifying}>
              {tr('网站验证')}
            </Button>
          }
        />
      </SettingSection>
      <SettingSection title={tr('自定义镜像')}>
        <SwitchRow
          title={tr('使用自定义镜像')}
          checked={settings.useCustomMirrorSite}
          onChange={(checked) => void save({ useCustomMirrorSite: checked })}
        />
        <SwitchRow
          title={tr('保留镜像路径')}
          checked={settings.appendCustomMirrorPath}
          onChange={(checked) => void save({ appendCustomMirrorPath: checked })}
        />
        <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
          <Stack spacing={1.5}>
            <TextField
              label={tr('自定义镜像地址')}
              value={mirror}
              onChange={(event) => setMirror(event.target.value)}
              onBlur={saveMirror}
              error={!!mirror && !normalizeMirrorUrl(mirror)}
              helperText={tr('HTTPS 地址，不含查询参数')}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={testConnection} disabled={testing}>
                {tr(testing ? '正在测试…' : '测试镜像连接')}
              </Button>
            </Stack>
            {mirrorResult && <Alert severity="info">{mirrorResult}</Alert>}
          </Stack>
        </Paper>
      </SettingSection>
    </Stack>
  );
}

async function testMirror(homeUrl: string, appendPath: boolean): Promise<MirrorProbeResult> {
  const base = appendPath ? homeUrl : new URL(homeUrl).origin;
  try {
    const home = await get(siteHomeUrl(homeUrl));
    if (home.body.includes('cf-chl-') || home.body.includes('Just a moment')) {
      return { kind: 'challenge' };
    }
    if (home.statusCode >= 400) {
      return { kind: 'httpError', statusCode: home.statusCode, homeUrl: home.url };
    }
    if (!home.body.includes('home-rows-wrapper')) {
      return { kind: 'parseFailure' };
    }
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
