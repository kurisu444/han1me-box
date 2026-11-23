import { useEffect, useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FolderOffOutlinedIcon from '@mui/icons-material/FolderOffOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import { queryClient, video as videoQuery } from '../../data/han1me_repository';
import {
  localMediaUrl,
  type DownloadGroupSort,
  type DownloadState,
  type DownloadTask,
} from '../../domain/models/download';
import type { VideoDetail, VideoSource } from '../../domain/models/video';
import { BatchManageBar } from '../library/library_video_grid';
import { NoticeToast, type NoticeMessage } from '../shared/notice_toast';
import { LoadingState } from '../shared/request_error';
import { useConfirmation } from '../shared/use_confirmation';
import { VideoGrid } from '../shared/video_card';
import { ActiveDownloadRow, CachedVideoCard, formatBytes } from './cache_cards';

const iconBtnSx = {
  width: 32,
  height: 32,
  borderRadius: '8px',
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  '&:hover': { color: 'text.primary', borderColor: 'text.secondary', bgcolor: 'action.hover' },
};

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '999px', bgcolor: 'primary.main' }} />
      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
        {count}
      </Typography>
    </Stack>
  );
}

export function CachePage() {
  const tr = useI18n();
  const confirmation = useConfirmation();
  const settings = useSettings();
  const [state, setState] = useState<DownloadState>();
  const [error, setError] = useState<Error>();
  const [group, setGroup] = useState('default');
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupTargetIds, setGroupTargetIds] = useState<string[]>([]);
  const [taskGroups, setTaskGroups] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; task: DownloadTask } | null>(null);
  const [groupMenu, setGroupMenu] = useState<{
    left: number;
    top: number;
    id: string;
    name: string;
    sort: DownloadGroupSort;
  } | null>(null);

  useEffect(() => {
    void window.electron.downloads.state().then(setState, setError);
    return window.electron.downloads.onChange(setState);
  }, []);

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }
  if (!state) {
    return <LoadingState label={tr('正在加载缓存…')} />;
  }

  const current = state.groups.find((item) => item.id === group);
  const customGroups = state.groups.filter((item) => item.id !== 'default');
  const allTasks = state.tasks;
  const tasks = allTasks
    .filter((task) => group === 'default' || task.groupIds.includes(group))
    .sort((a, b) =>
      current?.sort === 'name'
        ? a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        : current?.sort === 'recentlyUpdated'
          ? b.updatedAt - a.updatedAt
          : 0,
    );
  const activeTasks = tasks.filter((task) => task.status !== 'completed');
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const pinnedCompleted = completedTasks.filter((task) => task.pinned);
  const otherCompleted = completedTasks.filter((task) => !task.pinned);
  const totalBytes = completedTasks.reduce(
    (sum, task) => sum + (task.totalBytes > 0 ? task.totalBytes : task.downloadedBytes),
    0,
  );
  const allSelected = tasks.length > 0 && selected.length === tasks.length;

  function selectGroup(_event: unknown, value: string) {
    setGroup(value);
    setManaging(false);
    setSelected([]);
  }

  function toggle(id: string) {
    setSelected((value) =>
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );
  }

  function openTaskGroups(targetIds: string[]) {
    setMenu(null);
    const targets = allTasks.filter((task) => targetIds.includes(task.id));
    setGroupTargetIds(targetIds);
    setTaskGroups(
      customGroups
        .filter((item) => targets.every((task) => task.groupIds.includes(item.id)))
        .map((item) => item.id),
    );
    setGroupsOpen(true);
  }

  async function openCachedVideo(task: DownloadTask) {
    setMenu(null);
    if (!task.localVideoPath || !(await window.electron.fileExists(task.localVideoPath))) {
      setNotice({ id: Date.now(), text: tr('本地视频文件不存在') });
      return;
    }
    const localVideo: VideoDetail = {
      id: task.videoCode,
      title: task.title,
      coverUrl: task.coverUrl,
      sources: [{ quality: task.quality, url: localMediaUrl(task.localVideoPath) }],
      tags: [],
      playlist: [],
      related: [],
    };
    await window.electron.player.open({ id: task.videoCode, localVideo });
  }

  function createGroup() {
    setEditingId('');
    setName('');
    setEditing(true);
  }

  function editGroup(target: { id: string; name: string } | undefined = current) {
    setGroupMenu(null);
    if (!target) {
      return;
    }
    setEditingId(target.id);
    setName(target.name);
    setEditing(true);
  }

  async function saveGroup() {
    if (!name.trim()) {
      return;
    }
    const targetSort = editingId
      ? (state?.groups.find((item) => item.id === editingId)?.sort ?? 'defaultOrder')
      : 'defaultOrder';
    await window.electron.downloads.updateGroup(editingId, name.trim(), targetSort);
    setEditing(false);
  }

  async function changeGroupSort(nextSort: DownloadGroupSort) {
    if (!current) {
      return;
    }
    await window.electron.downloads.updateGroup(current.id, current.name, nextSort);
  }

  async function removeGroup(targetId = group) {
    setGroupMenu(null);
    if (!(await confirmation.confirm(tr('删除此分组？下载文件会保留。')))) {
      return;
    }
    await window.electron.downloads.deleteGroup(targetId);
    if (targetId === group) {
      setGroup('default');
      setManaging(false);
      setSelected([]);
    }
  }

  function openGroupContextMenu(
    event: MouseEvent,
    item: { id: string; name: string; sort: DownloadGroupSort },
  ) {
    if (item.id === 'default') {
      return;
    }
    event.preventDefault();
    setGroupMenu({
      left: event.clientX,
      top: event.clientY,
      id: item.id,
      name: item.name,
      sort: item.sort,
    });
  }

  async function deleteSelected() {
    if (!(await confirmation.confirm(tr('删除所选的 {0} 项下载及文件？', selected.length)))) {
      return;
    }
    await window.electron.downloads.deleteTasks(selected);
    setSelected([]);
  }

  async function deleteTask(task: DownloadTask) {
    setMenu(null);
    if (!(await confirmation.confirm(tr('删除下载「{0}」及本地文件？', task.title)))) {
      return;
    }
    await window.electron.downloads.deleteTasks([task.id]);
  }

  async function pinIds(ids: string[]) {
    setMenu(null);
    await window.electron.downloads.togglePinned(ids);
    if (managing) {
      setSelected([]);
    }
  }

  async function saveTaskGroups() {
    await window.electron.downloads.setTaskGroups(groupTargetIds, taskGroups);
    setGroupsOpen(false);
    setSelected([]);
  }

  function toggleGroupOption(id: string) {
    setTaskGroups((value) =>
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 1 }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'baseline', minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
            {tr('下载缓存')}
          </Typography>
          {tasks.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
              {[tr('共 {0} 部', tasks.length), totalBytes > 0 ? formatBytes(totalBytes) : '']
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<AddRoundedIcon sx={{ fontSize: 17 }} />}
            onClick={createGroup}
            sx={{
              height: 32,
              px: 1.5,
              borderRadius: '8px',
              borderColor: 'divider',
              color: 'text.secondary',
              fontSize: 13,
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            {tr('新建分组')}
          </Button>
          <Tooltip title={tr('导出已完成的下载')}>
            <span>
              <IconButton
                size="small"
                aria-label={tr('导出已完成的下载')}
                disabled={!completedTasks.length}
                onClick={() => void window.electron.downloads.exportCompleted()}
                sx={iconBtnSx}
              >
                <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs value={group} onChange={selectGroup} variant="scrollable" sx={{ minWidth: 0 }}>
          {state.groups.map((item) => (
            <Tab
              key={item.id}
              value={item.id}
              onContextMenu={(event) => openGroupContextMenu(event, item)}
              label={
                item.id === 'default' && ['Default', 'Cached'].includes(item.name)
                  ? tr('已缓存')
                  : item.name
              }
            />
          ))}
        </Tabs>

        {tasks.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center' }}>
            {managing && (
              <>
                <Tooltip title={tr('切换置顶')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={tr('切换置顶')}
                      disabled={selected.length === 0}
                      onClick={() => void pinIds(selected)}
                      sx={iconBtnSx}
                    >
                      <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                {customGroups.length > 0 && (
                  <Tooltip title={tr('设置分组')}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={tr('设置分组')}
                        disabled={selected.length === 0}
                        onClick={() => openTaskGroups(selected)}
                        sx={iconBtnSx}
                      >
                        <DriveFileMoveOutlinedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </>
            )}
            <BatchManageBar
              managing={managing}
              selectedCount={selected.length}
              allSelected={allSelected}
              onToggleManaging={() => {
                setManaging((open) => !open);
                setSelected([]);
              }}
              onToggleAll={() => setSelected(allSelected ? [] : tasks.map((task) => task.id))}
              onRemove={deleteSelected}
            />
            {current && (
              <TextField
                select
                size="small"
                aria-label={tr('排序')}
                value={current.sort}
                onChange={(event) => void changeGroupSort(event.target.value as DownloadGroupSort)}
                sx={{
                  minWidth: 108,
                  '& .MuiInputBase-root': { height: 32, fontSize: 13, borderRadius: '8px' },
                }}
              >
                <MenuItem value="defaultOrder" sx={{ fontSize: 13 }}>
                  {tr('默认顺序')}
                </MenuItem>
                <MenuItem value="recentlyUpdated" sx={{ fontSize: 13 }}>
                  {tr('最近更新')}
                </MenuItem>
                <MenuItem value="name" sx={{ fontSize: 13 }}>
                  {tr('名称')}
                </MenuItem>
              </TextField>
            )}
          </Stack>
        )}
      </Stack>

      {group !== 'default' && current && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 15, fontWeight: 700 }}>
              {current.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
              {tr('共 {0} 部', tasks.length)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
            <Tooltip title={tr('编辑分组')}>
              <IconButton
                size="small"
                aria-label={tr('编辑分组')}
                onClick={() => editGroup(current)}
                sx={iconBtnSx}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={tr('删除分组')}>
              <IconButton
                size="small"
                aria-label={tr('删除分组')}
                onClick={() => void removeGroup(current.id)}
                sx={{
                  ...iconBtnSx,
                  color: 'error.light',
                  borderColor: 'rgba(239, 83, 80, 0.35)',
                  '&:hover': {
                    color: 'error.light',
                    bgcolor: 'rgba(239, 83, 80, 0.14)',
                    borderColor: 'rgba(239, 83, 80, 0.55)',
                  },
                }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      )}

      {!tasks.length ? (
        <Stack spacing={1.25} sx={{ alignItems: 'center', py: 8, color: 'text.secondary' }}>
          <FolderOffOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {tr('暂无缓存')}
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={2.5}>
          {activeTasks.length > 0 && (
            <Stack spacing={1.25}>
              <SectionLabel label={tr('下载中')} count={activeTasks.length} />
              <Stack spacing={1}>
                {activeTasks.map((task) => (
                  <ActiveDownloadRow
                    key={task.id}
                    task={task}
                    managing={managing}
                    selected={selected.includes(task.id)}
                    onToggle={() => toggle(task.id)}
                    onRetry={() => void retryDownload(task, resolvedBaseUrl(settings))}
                    onDelete={() => void deleteTask(task)}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          {pinnedCompleted.length > 0 && (
            <Stack spacing={1.5}>
              <SectionLabel label={tr('置顶')} count={pinnedCompleted.length} />
              <VideoGrid>
                {pinnedCompleted.map((task) => (
                  <CachedVideoCard
                    key={task.id}
                    task={task}
                    managing={managing}
                    selected={selected.includes(task.id)}
                    onPlay={() => void openCachedVideo(task)}
                    onToggle={() => toggle(task.id)}
                    onOpenMenu={(anchor) => setMenu({ anchor, task })}
                  />
                ))}
              </VideoGrid>
            </Stack>
          )}

          {otherCompleted.length > 0 && (
            <Stack spacing={1.5}>
              {(pinnedCompleted.length > 0 || activeTasks.length > 0) && (
                <SectionLabel label={tr('全部')} count={otherCompleted.length} />
              )}
              <VideoGrid>
                {otherCompleted.map((task) => (
                  <CachedVideoCard
                    key={task.id}
                    task={task}
                    managing={managing}
                    selected={selected.includes(task.id)}
                    onPlay={() => void openCachedVideo(task)}
                    onToggle={() => toggle(task.id)}
                    onOpenMenu={(anchor) => setMenu({ anchor, task })}
                  />
                ))}
              </VideoGrid>
            </Stack>
          )}
        </Stack>
      )}

      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        slotProps={{
          paper: { sx: { borderRadius: '10px', border: '1px solid', borderColor: 'divider' } },
        }}
      >
        <MenuItem dense onClick={() => menu && void openCachedVideo(menu.task)}>
          <ListItemIcon>
            <PlayArrowRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('离线播放')}</ListItemText>
        </MenuItem>
        <MenuItem dense onClick={() => menu && void pinIds([menu.task.id])}>
          <ListItemIcon>
            <PushPinOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('切换置顶')}</ListItemText>
        </MenuItem>
        {customGroups.length > 0 && (
          <MenuItem dense onClick={() => menu && openTaskGroups([menu.task.id])}>
            <ListItemIcon>
              <DriveFileMoveOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{tr('设置分组')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          dense
          onClick={() => menu && void deleteTask(menu.task)}
          sx={{ color: 'error.light' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('删除')}</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        open={Boolean(groupMenu)}
        onClose={() => setGroupMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={groupMenu ? { top: groupMenu.top, left: groupMenu.left } : undefined}
        slotProps={{
          paper: { sx: { borderRadius: '10px', border: '1px solid', borderColor: 'divider' } },
        }}
      >
        <MenuItem dense onClick={() => groupMenu && editGroup(groupMenu)}>
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('编辑分组')}</ListItemText>
        </MenuItem>
        <MenuItem
          dense
          onClick={() => groupMenu && void removeGroup(groupMenu.id)}
          sx={{ color: 'error.light' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tr('删除分组')}</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={editing} onClose={() => setEditing(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingId ? tr('编辑下载分组') : tr('新建下载分组')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              autoFocus
              label={tr('名称')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(false)}>{tr('取消')}</Button>
          <Button variant="contained" disabled={!name.trim()} onClick={saveGroup}>
            {tr('保存')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={groupsOpen} onClose={() => setGroupsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{tr('设置分组')}</DialogTitle>
        <DialogContent>
          <Stack>
            {customGroups.map((item) => (
              <FormControlLabel
                key={item.id}
                label={item.name}
                control={
                  <Checkbox
                    checked={taskGroups.includes(item.id)}
                    onChange={() => toggleGroupOption(item.id)}
                  />
                }
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupsOpen(false)}>{tr('取消')}</Button>
          <Button variant="contained" onClick={saveTaskGroups}>
            {tr('保存')}
          </Button>
        </DialogActions>
      </Dialog>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      {confirmation.dialog}
    </Stack>
  );
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
