import { useI18n } from '../../app/i18n';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import * as repository from '../../data/local/keyframe_repository';
import { useQuery } from '@tanstack/react-query';
import { useConfirmation } from '../shared/use_confirmation';
import { LoadingState, RequestError } from '../shared/request_error';

export function KeyframesPage() {
  const tr = useI18n();
  const resource = useQuery({ queryKey: ['keyframe-videos'], queryFn: repository.loadVideos });
  const confirmation = useConfirmation();
  const [editing, setEditing] = useState<{
    video: repository.KeyframeVideo;
    position?: number;
  }>();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function edit(video: repository.KeyframeVideo, position?: number) {
    setEditing({
      video,
      position,
    });
    setValue(position === undefined ? video.title : String(position / 1000));
    setError('');
  }

  async function save() {
    const { video, position } = editing!;
    if (!value.trim()) return;
    if (position !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) return;
    const changed =
      position === undefined
        ? await repository.setTitle(video.id, value.trim())
        : await repository.updatePosition(video.id, position, Math.round(Number(value) * 1000));
    if (!changed) {
      setError(tr('时间无效，或与其他关键帧相隔不足 10 秒'));
      return;
    }
    setEditing(undefined);
    resource.refetch();
  }

  async function remove(id: string, position?: number) {
    if (position === undefined) {
      if (!(await confirmation.confirm(tr('删除此视频的全部关键帧？')))) return;
      await repository.deleteVideo(id);
    } else await repository.remove(id, position);
    resource.refetch();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('关键帧')}</Typography>
      {resource.isPending && <LoadingState label={tr('正在加载…')} />}
      {resource.error && <RequestError error={resource.error} onRetry={resource.refetch} />}
      {resource.data?.length === 0 && <Typography>{tr('暂无关键帧')}</Typography>}
      {resource.data?.map((video) => (
        <Paper
          key={video.id}
          sx={{
            p: 2,
          }}
        >
          <Button component={Link} to={`/video/${video.id}`}>
            {video.title}
          </Button>
          <Button onClick={() => edit(video)}>{tr('修改标题')}</Button>
          <Button onClick={() => remove(video.id)}>{tr('删除视频关键帧')}</Button>
          <List>
            {video.positions.map((position) => (
              <ListItem key={position}>
                <ListItemText primary={tr('{0} 秒', position / 1000)} />
                <Button onClick={() => edit(video, position)}>{tr('编辑时间')}</Button>
                <Button onClick={() => remove(video.id, position)}>{tr('删除')}</Button>
              </ListItem>
            ))}
          </List>
        </Paper>
      ))}
      <Dialog open={!!editing} onClose={() => setEditing(undefined)}>
        <DialogTitle>{tr('编辑关键帧')}</DialogTitle>
        <DialogContent>
          <TextField
            value={value}
            type={editing?.position === undefined ? 'text' : 'number'}
            label={editing?.position === undefined ? tr('标题') : tr('时间（秒）')}
            onChange={(event) => setValue(event.target.value)}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(undefined)}>{tr('取消')}</Button>
          <Button onClick={save}>{tr('保存')}</Button>
        </DialogActions>
      </Dialog>
      {confirmation.dialog}
    </Stack>
  );
}
