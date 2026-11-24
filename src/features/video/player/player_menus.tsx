import { useState, type MouseEvent, type RefObject } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../../../app/i18n';
import { useSettings, useSaveSettings } from '../../../app/settings_context';
import type { AppSettings } from '../../../core/settings';
import type { VideoDetail } from '../../../domain/models/video';
import * as keyframes from '../../../data/local/keyframe_repository';
import { useConfirmation } from '../../shared/use_confirmation';
import type { NoticeMessage } from '../../shared/notice_toast';

export const aspectLabels: Record<AppSettings['videoAspectRatio'], string> = {
  auto: '自动',
  crop: '裁剪',
  stretch: '拉伸',
  ratio4x3: '4:3',
};

export function usePlayerMenus(
  video: VideoDetail,
  player: RefObject<HTMLVideoElement | null>,
  changeSource: (url: string) => void,
  setSpeed: (value: number) => void,
) {
  const tr = useI18n();
  const saveSettings = useSaveSettings();
  const confirmation = useConfirmation();
  const frames = useQuery({
    queryKey: ['keyframes', video.id],
    queryFn: () => keyframes.load(video.id),
  });

  const [framesOpen, setFramesOpen] = useState(false);
  const [frameNotice, setFrameNotice] = useState<NoticeMessage | null>(null);
  const [qualityAnchor, setQualityAnchor] = useState<HTMLElement | null>(null);
  const [speedAnchor, setSpeedAnchor] = useState<HTMLElement | null>(null);
  const [aspectAnchor, setAspectAnchor] = useState<HTMLElement | null>(null);

  function selectSpeed(value: number) {
    setSpeedAnchor(null);
    setSpeed(value);
    if (player.current) {
      player.current.playbackRate = value;
    }
  }

  function selectAspect(value: AppSettings['videoAspectRatio']) {
    setAspectAnchor(null);
    void saveSettings({ videoAspectRatio: value });
  }

  async function addKeyframe() {
    const element = player.current;
    if (!element) {
      return;
    }
    if (!element.paused) {
      setFrameNotice({ id: Date.now(), text: tr('请先暂停播放再添加关键帧') });
      return;
    }
    const position = Math.round(element.currentTime * 1000);
    if (
      !(await confirmation.confirm(tr('将 {0} 秒添加为关键帧？', (position / 1000).toFixed(1))))
    ) {
      return;
    }
    const added = await keyframes.add(video.id, position, video.title);
    setFrameNotice({
      id: Date.now(),
      text: added ? tr('关键帧已添加') : tr('与已有关键帧相隔不足 10 秒'),
    });
    void frames.refetch();
  }

  async function removeKeyframe(position: number) {
    await keyframes.remove(video.id, position);
    void frames.refetch();
  }

  function jumpToKeyframe(position: number) {
    if (player.current) {
      player.current.currentTime = position / 1000;
    }
    setFramesOpen(false);
  }

  function openQualityMenu(event: MouseEvent<HTMLElement>) {
    setQualityAnchor(event.currentTarget);
  }

  function openSpeedMenu(event: MouseEvent<HTMLElement>) {
    setSpeedAnchor(event.currentTarget);
  }

  function openAspectMenu(event: MouseEvent<HTMLElement>) {
    setAspectAnchor(event.currentTarget);
  }

  function selectQuality(url: string) {
    setQualityAnchor(null);
    changeSource(url);
  }
  return {
    frames,
    framesOpen,
    setFramesOpen,
    frameNotice,
    setFrameNotice,
    qualityAnchor,
    setQualityAnchor,
    speedAnchor,
    setSpeedAnchor,
    aspectAnchor,
    setAspectAnchor,
    selectSpeed,
    selectAspect,
    addKeyframe,
    removeKeyframe,
    jumpToKeyframe,
    openQualityMenu,
    openSpeedMenu,
    openAspectMenu,
    selectQuality,
    confirmation: confirmation.dialog,
  };
}

export function PlayerMenus({
  video,
  sourceUrl,
  speed,
  menu,
}: {
  video: VideoDetail;
  sourceUrl: string;
  speed: number;
  menu: ReturnType<typeof usePlayerMenus>;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const {
    frames,
    framesOpen,
    setFramesOpen,
    qualityAnchor,
    setQualityAnchor,
    speedAnchor,
    setSpeedAnchor,
    aspectAnchor,
    setAspectAnchor,
    selectSpeed,
    selectAspect,
    removeKeyframe,
    jumpToKeyframe,
    selectQuality,
    confirmation,
  } = menu;
  const speedOptions = [...new Set([0.5, 0.75, 1, 1.25, 1.5, 2, 3, speed])].sort((a, b) => a - b);
  return (
    <>
      <Menu
        anchorEl={qualityAnchor}
        open={Boolean(qualityAnchor)}
        onClose={() => setQualityAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {video.sources.map((item, index) => (
          <MenuItem
            key={`${item.quality}-${item.url}`}
            selected={item.url === sourceUrl}
            onClick={() => selectQuality(item.url)}
          >
            {item.quality === 'Default' ? tr('默认 {0}', index + 1) : item.quality}
            {/\.m3u8(?:\?|$)/i.test(item.url) ? ' · HLS' : ''}
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={speedAnchor}
        open={Boolean(speedAnchor)}
        onClose={() => setSpeedAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {speedOptions.map((value) => (
          <MenuItem key={value} selected={value === speed} onClick={() => selectSpeed(value)}>
            {value}×
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={aspectAnchor}
        open={Boolean(aspectAnchor)}
        onClose={() => setAspectAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {(['auto', 'crop', 'stretch', 'ratio4x3'] as const).map((value) => (
          <MenuItem
            key={value}
            selected={value === settings.videoAspectRatio}
            onClick={() => selectAspect(value)}
          >
            {tr(aspectLabels[value])}
          </MenuItem>
        ))}
      </Menu>
      <Dialog open={framesOpen} onClose={() => setFramesOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{tr('关键帧')}</DialogTitle>
        <DialogContent>
          {frames.data?.length ? (
            <List dense>
              {frames.data.map((position) => (
                <ListItem
                  key={position}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" onClick={() => jumpToKeyframe(position)}>
                        {tr('跳转')}
                      </Button>
                      <Button size="small" color="error" onClick={() => removeKeyframe(position)}>
                        {tr('删除')}
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemText primary={tr('{0} 秒', (position / 1000).toFixed(1))} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {tr('暂无关键帧')}
            </Typography>
          )}
        </DialogContent>
      </Dialog>

      {confirmation}
    </>
  );
}
