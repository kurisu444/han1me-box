import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import type { AppSettings } from '../../core/settings';
import { NumberRow, SelectRow, SettingRow, SettingSection, SwitchRow } from './setting_controls';

export function PlaybackSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const navigate = useNavigate();

  return (
    <Stack spacing={3}>
      <SettingSection title={tr('画质与画面')}>
        <SelectRow<number>
          title={tr('默认清晰度')}
          value={settings.preferredQuality}
          options={[
            [480, '480p'],
            [720, '720p'],
            [1080, '1080p'],
          ]}
          onChange={(preferredQuality) => void save({ preferredQuality })}
        />
        <SelectRow<AppSettings['videoAspectRatio']>
          title={tr('画面比例')}
          value={settings.videoAspectRatio}
          options={[
            ['auto', tr('自动')],
            ['crop', tr('裁剪')],
            ['stretch', tr('拉伸')],
            ['ratio4x3', '4:3'],
          ]}
          onChange={(videoAspectRatio) => void save({ videoAspectRatio })}
        />
      </SettingSection>
      <SettingSection title={tr('播放行为')}>
        <SwitchRow
          title={tr('断点续播')}
          checked={settings.resumePlayback}
          onChange={(resumePlayback) => void save({ resumePlayback })}
        />
        <SwitchRow
          title={tr('打开自动播放')}
          checked={settings.autoPlayOnOpen}
          onChange={(autoPlayOnOpen) => void save({ autoPlayOnOpen })}
        />
        <SwitchRow
          title={tr('自动播放下一集')}
          checked={settings.autoPlayNext}
          onChange={(autoPlayNext) => void save({ autoPlayNext })}
        />
        <SwitchRow
          title={tr('循环播放')}
          checked={settings.loopPlayback}
          onChange={(loopPlayback) => void save({ loopPlayback })}
        />
        <SwitchRow
          title={tr('无痕播放')}
          checked={settings.incognitoPlayback}
          onChange={(incognitoPlayback) => void save({ incognitoPlayback })}
        />
        <SwitchRow
          title={tr('自动画中画')}
          checked={settings.autoPictureInPicture}
          onChange={(autoPictureInPicture) => void save({ autoPictureInPicture })}
        />
      </SettingSection>
      <SettingSection title={tr('倍速与快进')}>
        <NumberRow
          title={tr('默认倍速')}
          value={settings.defaultPlaybackSpeed}
          min={0.25}
          max={3}
          step={0.25}
          onChange={(defaultPlaybackSpeed) => void save({ defaultPlaybackSpeed })}
        />
        <NumberRow
          title={tr('长按倍速')}
          value={settings.longPressPlaybackSpeed}
          min={1}
          max={3}
          step={0.25}
          onChange={(longPressPlaybackSpeed) => void save({ longPressPlaybackSpeed })}
        />
        <NumberRow
          title={tr('快进秒数')}
          value={settings.skipSeconds}
          min={1}
          max={3600}
          step={1}
          onChange={(skipSeconds) => void save({ skipSeconds })}
        />
      </SettingSection>
      <SettingSection title={tr('互动与关键帧')}>
        <SwitchRow
          title={tr('显示评论')}
          checked={settings.commentsEnabled}
          onChange={(commentsEnabled) => void save({ commentsEnabled })}
        />
        <SwitchRow
          title={tr('启用关键帧')}
          checked={settings.keyframesEnabled}
          onChange={(keyframesEnabled) => void save({ keyframesEnabled })}
        />
        <SettingRow
          title={tr('管理关键帧')}
          control={<ChevronRightIcon color="action" />}
          onClick={() => navigate('/settings/keyframes')}
        />
      </SettingSection>
    </Stack>
  );
}
