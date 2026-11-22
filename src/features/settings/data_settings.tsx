import { useI18n } from '../../app/i18n';
import { useState } from 'react';
import {
  Alert,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  MenuItem,
  Typography,
} from '@mui/material';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import * as sync from '../../data/local/webdav_sync_service';
import * as watch from '../../data/local/watch_repository';
import * as library from '../../data/local/library_repository';
import { appSettingsFromJson, type AppSettings } from '../../core/settings';
import { readJsonStore, writeJsonStore } from '../../data/local/json_store';

export function DataSettings() {
  const tr = useI18n();
  const settings = useSettings(),
    save = useSaveSettings();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
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
      if (settings.webDavFavoriteSync)
        await library.replaceFavorites(
          await sync.syncFavorites(settings, (await library.loadLibrary()).favorites),
        );
    });
  }

  function enabled(value: boolean) {
    void save({
      webDavEnabled: value,
      webDavHistorySync: value ? settings.webDavHistorySync : false,
      webDavFavoriteSync: value ? settings.webDavFavoriteSync : false,
    });
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h6">{tr('下载')}</Typography>
        <TextField
          select
          label={tr('下载清晰度')}
          value={settings.downloadQuality}
          onChange={(event) => save({ downloadQuality: Number(event.target.value) })}
        >
          {[1080, 720, 480].map((quality) => (
            <MenuItem key={quality} value={quality}>
              {quality}p
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={tr('下载目录（留空使用默认目录）')}
          value={downloadPath}
          onChange={(event) => setDownloadPath(event.target.value)}
          onBlur={saveDownloadPath}
        />
        <TextField
          type="number"
          label={tr('并发下载（1–5）')}
          value={settings.concurrentDownloads}
          onChange={(event) =>
            save({
              concurrentDownloads: Math.max(1, Math.min(5, Number(event.target.value))),
            })
          }
        />
        <TextField
          type="number"
          label={tr('限速 MB/s（0 为不限速）')}
          value={settings.downloadSpeedLimitMbps}
          onChange={(event) =>
            save({
              downloadSpeedLimitMbps: Math.max(0, Math.min(20, Number(event.target.value))),
            })
          }
        />
        <Button onClick={browse}>{tr('选择文件夹')}</Button>
        <Typography variant="h6">{tr('备份')}</Typography>
        <Button disabled={busy} onClick={() => run(() => exportBackup(settings))}>
          {tr('导出 ZIP 数据备份')}
        </Button>
        <Button disabled={busy} onClick={() => run(() => importBackup(settings, save))}>
          {tr('导入 ZIP 数据备份')}
        </Button>
        <Typography variant="h6">WebDAV</Typography>
        <FormControlLabel
          label={tr('开启 WebDAV')}
          control={
            <Switch checked={settings.webDavEnabled} onChange={(_, value) => enabled(value)} />
          }
        />
        <FormControlLabel
          label={tr('同步历史')}
          control={
            <Switch
              disabled={!settings.webDavEnabled}
              checked={settings.webDavHistorySync}
              onChange={(_, value) =>
                save({
                  webDavHistorySync: value,
                })
              }
            />
          }
        />
        <FormControlLabel
          label={tr('同步收藏')}
          control={
            <Switch
              disabled={!settings.webDavEnabled}
              checked={settings.webDavFavoriteSync}
              onChange={(_, value) =>
                save({
                  webDavFavoriteSync: value,
                })
              }
            />
          }
        />
        <TextField
          label={tr('WebDAV 地址')}
          value={settings.webDavUrl}
          onChange={(event) =>
            save({
              webDavUrl: event.target.value,
            })
          }
        />
        <TextField
          label={tr('用户名')}
          value={settings.webDavUsername}
          onChange={(event) =>
            save({
              webDavUsername: event.target.value,
            })
          }
        />
        <TextField
          type="password"
          label={tr('密码')}
          value={settings.webDavPassword}
          onChange={(event) =>
            save({
              webDavPassword: event.target.value,
            })
          }
        />
        <Button disabled={busy} onClick={synchronize}>
          {tr('立即同步')}
        </Button>
        {notice && <Alert severity="info">{notice}</Alert>}
      </Stack>
    </Paper>
  );
}

export interface BackupBundle {
  settings: Partial<AppSettings>;
  watch: Partial<watch.WatchState>;
  library: Parameters<typeof library.libraryState>[0];
  downloads: import('../../domain/models/download').DownloadState;
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
  if (!bundle) return false;
  await save({ ...appSettingsFromJson(bundle.settings), downloadPath: current.downloadPath });
  await watch.replaceWatchState(watch.watchState(bundle.watch));
  await library.replaceLibrary(library.libraryState(bundle.library));
  await window.electron.downloads.replace(bundle.downloads);
  await writeJsonStore('keyframes.json', bundle.keyframes);
  await writeJsonStore('check_ins.json', bundle.check_ins);
  return true;
}
