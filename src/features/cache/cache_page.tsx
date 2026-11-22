import { useI18n } from '../../app/i18n';
import { useConfirmation } from '../shared/use_confirmation';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoCover } from '../shared/video_card';
import { LoadingState } from '../shared/request_error';
import {
  Box,
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { queryClient, video as videoQuery } from '../../data/han1me_repository';
import type { VideoDetail, VideoSource } from '../../domain/models/video';
import {
  localMediaUrl,
  type DownloadGroupSort,
  type DownloadState,
  type DownloadTask,
} from '../../domain/models/download';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';

export function CachePage() {
  const tr = useI18n();
  const confirmation = useConfirmation();
  const navigate = useNavigate();
  const [state, setState] = useState<DownloadState>();
  const [error, setError] = useState<Error>();
  const settings = useSettings();
  const [group, setGroup] = useState('default');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [sort, setSort] = useState<DownloadGroupSort>('defaultOrder');
  const [notice, setNotice] = useState('');
  const [allExpanded, setAllExpanded] = useState(true);
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [taskGroups, setTaskGroups] = useState<string[]>([]);
  useEffect(() => {
    void window.electron.downloads.state().then(setState, setError);
    return window.electron.downloads.onChange(setState);
  }, []);

  const current = state?.groups.find((item) => item.id === group);
  const tasks = (state?.tasks ?? [])
    .filter((task) => group === 'default' || task.groupIds.includes(group))
    .sort((a, b) =>
      current?.sort === 'name'
        ? a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        : current?.sort === 'recentlyUpdated'
          ? b.updatedAt - a.updatedAt
          : 0,
    );
  const pinned = tasks.filter((task) => task.pinned);

  function selectGroup(_event: unknown, value: string) {
    setGroup(value);
    setSelected([]);
    setAllExpanded(true);
    setPinnedExpanded(true);
  }

  function selectAll() {
    setSelected(
      tasks.length && tasks.every((task) => selected.includes(task.id))
        ? []
        : tasks.map((task) => task.id),
    );
  }

  function openTaskGroups() {
    const selectedTasks = state!.tasks.filter((task) => selected.includes(task.id));
    setTaskGroups(
      state!.groups
        .filter(
          (item) =>
            item.id !== 'default' && selectedTasks.every((task) => task.groupIds.includes(item.id)),
        )
        .map((item) => item.id),
    );
    setGroupsOpen(true);
  }

  async function openCachedVideo(task: DownloadTask) {
    if (!task.localVideoPath || !(await window.electron.fileExists(task.localVideoPath))) {
      setNotice(tr('本地视频文件不存在'));
      return;
    }
    const localVideo = {
      id: task.videoCode,
      title: task.title,
      coverUrl: task.coverUrl,
      sources: [{ quality: task.quality, url: localMediaUrl(task.localVideoPath) }],
      tags: [],
      playlist: [],
      related: [],
    };
    navigate(`/video/${encodeURIComponent(task.videoCode)}?home=/cache`, { state: { localVideo } });
  }

  function toggle(id: string) {
    setSelected((value) =>
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );
  }

  function createGroup() {
    setEditingId('');
    setName('');
    setSort('defaultOrder');
    setEditing(true);
  }

  function editGroup() {
    setEditingId(group);
    setName(current!.name);
    setSort(current!.sort);
    setEditing(true);
  }

  async function saveGroup() {
    if (!name.trim()) {
      return;
    }
    await window.electron.downloads.updateGroup(editingId, name, sort);
    setEditing(false);
  }

  async function deleteSelected() {
    if (!(await confirmation.confirm(tr('删除所选的 {0} 项下载及文件？', selected.length)))) {
      return;
    }
    await window.electron.downloads.deleteTasks(selected);
    setSelected([]);
  }

  async function deleteTask(task: DownloadTask) {
    if (!(await confirmation.confirm(tr('删除下载「{0}」及本地文件？', task.title)))) {
      return;
    }
    await window.electron.downloads.deleteTasks([task.id]);
  }

  async function pin() {
    await window.electron.downloads.togglePinned(selected);
    setSelected([]);
  }

  async function removeGroup() {
    if (!(await confirmation.confirm(tr('删除此分组？下载文件会保留。')))) {
      return;
    }
    await window.electron.downloads.deleteGroup(group);
    setGroup('default');
    setSelected([]);
  }

  async function saveTaskGroups() {
    await window.electron.downloads.setTaskGroups(selected, taskGroups);
    setGroupsOpen(false);
    setSelected([]);
  }

  function toggleGroup(id: string) {
    setTaskGroups((value) =>
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );
  }

  function renderTask(task: DownloadTask) {
    return (
      <Stack key={task.id} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Checkbox checked={selected.includes(task.id)} onChange={() => toggle(task.id)} />
        <Box sx={{ width: 150, aspectRatio: '16 / 9' }}>
          <VideoCover
            url={task.localCoverPath ? localMediaUrl(task.localCoverPath) : (task.coverUrl ?? '')}
            fallbackUrl={task.coverUrl}
            title={task.title}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography>
            {task.title} · {task.quality}
          </Typography>
          <Typography variant="caption">
            {[task.duration, task.views, task.rating, task.uploadTime].filter(Boolean).join(' · ')}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {
              {
                queued: tr('等待下载'),
                downloading: tr('下载中'),
                completed: tr('已完成'),
                failed: tr('失败'),
              }[task.status]
            }
            {task.status === 'downloading' &&
              ` · ${formatBytes(task.speedBytesPerSecond)}/s · ` +
                formatBytes(task.downloadedBytes) +
                (task.totalBytes > 0 ? ` / ${formatBytes(task.totalBytes)}` : '')}
          </Typography>
          {['queued', 'downloading'].includes(task.status) && (
            <LinearProgress
              variant={task.status === 'queued' ? 'indeterminate' : 'determinate'}
              value={task.progress * 100}
            />
          )}
        </Box>
        {task.status === 'completed' && (
          <>
            <Button onClick={() => openCachedVideo(task)}>{tr('离线播放')}</Button>
            {!selected.length && <Button onClick={() => deleteTask(task)}>{tr('删除')}</Button>}
          </>
        )}
        {task.status === 'failed' && (
          <Button onClick={() => retryDownload(task, resolvedBaseUrl(settings))}>
            {tr('重试')}
          </Button>
        )}
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }
  if (!state) {
    return <LoadingState label={tr('正在加载缓存…')} />;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('下载缓存')}</Typography>
      {notice && <Alert severity="warning">{notice}</Alert>}
      <Tabs value={group} onChange={selectGroup} variant="scrollable">
        {(state?.groups ?? []).map((item) => (
          <Tab
            key={item.id}
            value={item.id}
            label={
              item.id === 'default' && ['Default', 'Cached'].includes(item.name)
                ? tr('已缓存')
                : item.name
            }
          />
        ))}
      </Tabs>
      <Stack direction="row" spacing={1}>
        <Button onClick={createGroup}>{tr('新建分组')}</Button>
        <Button onClick={editGroup} disabled={!current}>
          {tr('编辑分组')}
        </Button>
        <Button onClick={() => window.electron.downloads.exportCompleted()}>
          {tr('导出已完成的下载')}
        </Button>
        <Button disabled={group === 'default'} onClick={removeGroup}>
          {tr('删除分组')}
        </Button>
        <Button disabled={!selected.length} onClick={deleteSelected}>
          {tr('删除所选')}
        </Button>
        <Button disabled={!selected.length} onClick={pin}>
          {tr('切换置顶')}
        </Button>
        <Button onClick={selectAll}>{tr('全选')}</Button>
        <Button disabled={!selected.length} onClick={() => setSelected([])}>
          {tr('取消选择')}
        </Button>
        <Button disabled={!selected.length} onClick={openTaskGroups}>
          {tr('设置分组')}
        </Button>
      </Stack>
      {!tasks.length && <Typography>{tr('暂无缓存')}</Typography>}
      {!!pinned.length && (
        <>
          <Button onClick={() => setPinnedExpanded(!pinnedExpanded)}>
            {tr('置顶')} ({pinned.length}) {pinnedExpanded ? '▾' : '▸'}
          </Button>
          {pinnedExpanded && pinned.map(renderTask)}
        </>
      )}
      <Button onClick={() => setAllExpanded(!allExpanded)}>
        {tr('全部')} ({tasks.length}) {allExpanded ? '▾' : '▸'}
      </Button>
      {allExpanded && tasks.map(renderTask)}
      <Dialog open={editing} onClose={() => setEditing(false)} fullWidth>
        <DialogTitle>{editingId ? tr('编辑下载分组') : tr('新建下载分组')}</DialogTitle>
        <DialogContent>
          <Stack
            spacing={2}
            sx={{
              pt: 1,
            }}
          >
            <TextField
              label={tr('名称')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              select
              label={tr('排序')}
              value={sort}
              onChange={(event) => setSort(event.target.value as DownloadGroupSort)}
            >
              <MenuItem value="defaultOrder">{tr('默认顺序')}</MenuItem>
              <MenuItem value="recentlyUpdated">{tr('最近更新')}</MenuItem>
              <MenuItem value="name">{tr('名称')}</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(false)}>{tr('取消')}</Button>
          <Button onClick={saveGroup}>{tr('保存')}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={groupsOpen} onClose={() => setGroupsOpen(false)}>
        <DialogTitle>{tr('设置分组')}</DialogTitle>
        <DialogContent>
          {state?.groups
            .filter((item) => item.id !== 'default')
            .map((item) => (
              <FormControlLabel
                key={item.id}
                label={item.name}
                control={
                  <Checkbox
                    checked={taskGroups.includes(item.id)}
                    onChange={() => toggleGroup(item.id)}
                  />
                }
              />
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={saveTaskGroups}>{tr('保存')}</Button>
        </DialogActions>
      </Dialog>
      {confirmation.dialog}
    </Stack>
  );
}

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function retryDownload(task: DownloadTask, baseUrl: string) {
  if (task.status !== 'failed') {
    return;
  }
  let detail: VideoDetail;
  let source: VideoSource | undefined;
  try {
    detail = await queryClient.fetchQuery(videoQuery(baseUrl, task.videoCode));
    source = detail.sources.find((item) => item.quality === task.quality) ?? detail.sources[0];
  } catch {
    if (!task.sourceUrl) {
      return;
    }
    detail = {
      id: task.videoCode,
      title: task.title,
      coverUrl: task.coverUrl,
      sources: [],
      tags: [],
      playlist: [],
      related: [],
    };
    source = { quality: task.quality, url: task.sourceUrl };
  }
  if (source) {
    await window.electron.downloads.retry(task.id, detail, source);
  }
}
