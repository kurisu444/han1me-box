import { Paper, Stack } from '@mui/material';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { NumberRow, SettingSection, StringListSetting, SwitchRow } from './setting_controls';

export function ContentSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();

  return (
    <Stack spacing={3}>
      <SettingSection title={tr('推荐过滤')}>
        <NumberRow
          title={tr('最短视频秒数')}
          value={settings.minimumVideoDurationSeconds}
          min={0}
          max={86400}
          step={1}
          onChange={(minimumVideoDurationSeconds) => void save({ minimumVideoDurationSeconds })}
        />
        <NumberRow
          title={tr('最低播放量（万）')}
          value={settings.minimumVideoViews}
          min={0}
          max={1000000000}
          step={1}
          onChange={(minimumVideoViews) => void save({ minimumVideoViews })}
        />
        <SwitchRow
          title={tr('豁免已订阅作者')}
          checked={settings.exemptSubscribedAuthors}
          onChange={(exemptSubscribedAuthors) => void save({ exemptSubscribedAuthors })}
        />
        <SwitchRow
          title={tr('过滤相关推荐')}
          checked={settings.applyRecommendationFiltersToRelated}
          onChange={(applyRecommendationFiltersToRelated) =>
            void save({ applyRecommendationFiltersToRelated })
          }
        />
        <SwitchRow
          title={tr('过滤搜索结果')}
          checked={settings.applyRecommendationFiltersToSearch}
          onChange={(applyRecommendationFiltersToSearch) =>
            void save({ applyRecommendationFiltersToSearch })
          }
        />
      </SettingSection>
      <SettingSection title={tr('屏蔽名单')}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
          <Stack spacing={2}>
            <StringListSetting
              label={tr('屏蔽标题关键词')}
              values={settings.blockedVideoTitleKeywords}
              onSave={(blockedVideoTitleKeywords) => void save({ blockedVideoTitleKeywords })}
            />
            <StringListSetting
              label={tr('屏蔽作者')}
              values={settings.blockedAuthors}
              onSave={(blockedAuthors) => void save({ blockedAuthors })}
            />
            <StringListSetting
              label={tr('屏蔽评论关键词')}
              values={settings.blockedCommentKeywords}
              onSave={(blockedCommentKeywords) => void save({ blockedCommentKeywords })}
            />
            <StringListSetting
              label={tr('屏蔽评论用户')}
              values={settings.blockedCommentUsers}
              onSave={(blockedCommentUsers) => void save({ blockedCommentUsers })}
            />
          </Stack>
        </Paper>
      </SettingSection>
    </Stack>
  );
}
