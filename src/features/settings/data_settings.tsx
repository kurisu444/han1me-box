import { useState } from 'react';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import { Alert, Button, Paper, Stack, TextField } from '@mui/material';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { appSettingsFromJson, type AppSettings } from '../../core/settings';
import { readJsonStore, writeJsonStore } from '../../data/local/json_store';
import * as library from '../../data/local/library_repository';
import * as watch from '../../data/local/watch_repository';
import * as sync from '../../data/local/webdav_sync_service';
import type { DownloadState } from '../../domain/models/download';
import { NumberRow, SelectRow, SettingRow, SettingSection, SwitchRow } from './setting_controls';

export function DataSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [downloadPath, setDownloadPath] = useState(settings.downloadPath);

  async function browse() {
    const selected = await window.electron.chooseDirectory(downloadPath);
    if (selected) {
      setDownloadPath(selected);
      await save({ downloadPath: selected });
    }
  }

  async function saveDownloadPath() {
    const value = await window.electron.normalizeDownloadPath(downloadPath);
    setDownloadPath(value);
    await save({ downloadPath: value });
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice(tr('操作完成'));
    } catch (error) {
      setNotice(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function synchronize() {
    if (!settings.webDavEnabled) {
      setNotice(tr('WebDAV 未开启'));
      return;
    }
    await run(async () => {
      await watch.replaceWatchState(
        await sync.syncWatchState(settings, await watch.readWatchState()),
      );
      if (settings.webDavFavoriteSync) {
        await library.replaceFavorites(
          await sync.syncFavorites(settings, (await library.loadLibrary()).favorites),
        );
      }
    });
  }

  function setWebDavEnabled(value: boolean) {
    void save({
      webDavEnabled: value,
      webDavHistorySync: value ? settings.webDavHistorySync : false,
      webDavFavoriteSync: value ? settings.webDavFavoriteSync : false,
    });
  }

  return (
    <Stack spacing={3}>
      <SettingSection title={tr('下载')}>
        <SelectRow<number>
          title={tr('下载清晰度')}
          value={settings.downloadQuality}
          options={[
            [1080, '1080p'],
            [720, '720p'],
            [480, '480p'],
          ]}
          onChange={(downloadQuality) => void save({ downloadQuality })}
        />
        <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: '12px' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              label={tr('下载目录（留空使用默认目录）')}
              value={downloadPath}
              onChange={(event) => setDownloadPath(event.target.value)}
              onBlur={saveDownloadPath}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<FolderOpenOutlinedIcon />}
              onClick={browse}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {tr('选择文件夹')}
            </Button>
          </Stack>
        </Paper>
        <NumberRow
          title={tr('并发下载')}
          description="1–5"
          value={settings.concurrentDownloads}
          min={1}
          max={5}
          step={1}
          onChange={(concurrentDownloads) => void save({ concurrentDownloads })}
        />
        <NumberRow
          title={tr('下载限速')}
          description={tr('MB/s（0 为不限速）')}
          value={settings.downloadSpeedLimitMbps}
          min={0}
          max={20}
          step={1}
          onChange={(downloadSpeedLimitMbps) => void save({ downloadSpeedLimitMbps })}
        />
      </SettingSection>

      <SettingSection title={tr('本地备份')}>
        <SettingRow
          title={tr('导出 ZIP 数据备份')}
          description={tr('打包设置、观看历史、收藏、下载记录与关键帧')}
          control={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => run(() => exportBackup(settings))}
            >
              {tr('导出')}
            </Button>
          }
        />
        <SettingRow
          title={tr('导入 ZIP 数据备份')}
          description={tr('从备份文件恢复本地数据')}
          control={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => run(() => importBackup(settings, save))}
            >
              {tr('导入')}
            </Button>
          }
        />
      </SettingSection>

      <SettingSection title="WebDAV">
        <SwitchRow
          title={tr('开启 WebDAV')}
          checked={settings.webDavEnabled}
          onChange={setWebDavEnabled}
        />
        {settings.webDavEnabled && (
          <>
            <SwitchRow
              title={tr('同步历史')}
              checked={settings.webDavHistorySync}
              onChange={(webDavHistorySync) => void save({ webDavHistorySync })}
            />
            <SwitchRow
              title={tr('同步收藏')}
              checked={settings.webDavFavoriteSync}
              onChange={(webDavFavoriteSync) => void save({ webDavFavoriteSync })}
            />
            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label={tr('WebDAV 地址')}
                  value={settings.webDavUrl}
                  onChange={(event) => void save({ webDavUrl: event.target.value })}
                />
                <Stack direction="row" spacing={1.5}>
                  <TextField
                    fullWidth
                    size="small"
                    label={tr('用户名')}
                    value={settings.webDavUsername}
                    onChange={(event) => void save({ webDavUsername: event.target.value })}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    label={tr('密码')}
                    value={settings.webDavPassword}
                    onChange={(event) => void save({ webDavPassword: event.target.value })}
                  />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SyncIcon />}
                    disabled={busy}
                    onClick={synchronize}
                  >
                    {tr('立即同步')}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </>
        )}
      </SettingSection>

      {notice && <Alert severity="info">{notice}</Alert>}
    </Stack>
  );
}

export interface BackupBundle {
  settings: Partial<AppSettings>;
  watch: Partial<watch.WatchState>;
  library: Parameters<typeof library.libraryState>[0];
  downloads: DownloadState;
  keyframes: Record<string, unknown>;
  check_ins: Record<string, unknown>;
}

async function exportBackup(settings: AppSettings) {
  const [local, history, downloadState, keyframes, primary, legacy] = await Promise.all([
    library.loadLibrary(),
    watch.readWatchState(),
    window.electron.downloads.state(),
    readJsonStore('keyframes.json'),
    readJsonStore<Record<string, unknown>>('check_ins.json'),
    readJsonStore('checkin_store.json'),
  ]);
  return window.electron.backup.export({
    settings,
    watch: history,
    library: library.libraryToJson(local),
    downloads: downloadState,
    keyframes,
    check_ins: Object.keys(primary).length ? primary : legacy,
  });
}

async function importBackup(current: AppSettings, save: (settings: AppSettings) => Promise<void>) {
  const bundle = await window.electron.backup.import();
  if (!bundle) {
    return false;
  }
  await save({ ...appSettingsFromJson(bundle.settings), downloadPath: current.downloadPath });
  await watch.replaceWatchState(watch.watchState(bundle.watch));
  await library.replaceLibrary(library.libraryState(bundle.library));
  await window.electron.downloads.replace(bundle.downloads);
  await writeJsonStore('keyframes.json', bundle.keyframes);
  await writeJsonStore('check_ins.json', bundle.check_ins);
  return true;
}
