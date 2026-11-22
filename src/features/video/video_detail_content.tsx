import { useI18n } from '../../app/i18n';
import { useAccount } from '../account/account_controller';
import { resolvedBaseUrl } from '../../core/settings';
import { siteEndpointUrl } from '../../core/site_url';
import { localizeTag, searchLocale } from '../../data/search_option_catalog';
import { useState } from 'react';
import { Button, Alert, Avatar, Box, Chip, Link, Paper, Stack, Typography } from '@mui/material';
import { translateVideo } from '../../data/remote/google_translate_api';
import type { VideoTranslation, VideoDetail } from '../../domain/models/video';
import { useSettings } from '../../app/settings_context';
import { Link as RouterLink } from 'react-router-dom';

export function VideoDetailContent({
  video: original,
  onRefresh,
  onTitleChanged,
}: {
  video: VideoDetail;
  onRefresh?: () => void;
  onTitleChanged?: (title: string) => void;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const account = useAccount();
  const [translation, setTranslation] = useState<VideoTranslation>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const video = translation
    ? {
        ...original,
        ...translation,
      }
    : original;

  function tagLabel(tag: VideoDetail['tags'][number]) {
    const name = localizeTag(tag.name, searchLocale(settings.language, navigator.language));
    return tag.count === undefined ? name : `${name} (${tag.count})`;
  }

  function tagUrl(tag: VideoDetail['tags'][number]) {
    const query = tag.href
      ? new URL(tag.href, resolvedBaseUrl(settings)).search
      : '?' + new URLSearchParams({ 'tags[]': tag.name });
    return `/search${query}`;
  }

  async function editTags(mode: 'add' | 'remove') {
    await window.electron.session.tags(
      siteEndpointUrl(resolvedBaseUrl(settings), 'watch?v=' + encodeURIComponent(original.id)),
      mode,
    );
    try {
      const cookies = await window.electron.session.cookies(resolvedBaseUrl(settings));
      if (cookies) {
        await account.saveCookie(cookies);
      }
    } catch {}
    onRefresh?.();
  }

  async function translate() {
    setBusy(true);
    setError('');
    try {
      const language =
        settings.language === 'english'
          ? 'en'
          : settings.language === 'traditionalChinese'
            ? 'zh-TW'
            : settings.language === 'system'
              ? /^zh-(?:tw|hant)/i.test(navigator.language)
                ? 'zh-TW'
                : /^zh/i.test(navigator.language)
                  ? 'zh-CN'
                  : 'en'
              : 'zh-CN';
      const result = await translateVideo(original, language);
      setTranslation(result);
      onTitleChanged?.(result.title);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box component="section">
      <Button onClick={translate} disabled={busy}>
        {busy ? tr('翻译中…') : tr('翻译标题与简介')}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {video.artist && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'center',
            py: 2,
          }}
        >
          <Avatar src={video.artistAvatarUrl} alt={video.artist} />
          <Box>
            <Link
              component={RouterLink}
              to={`/search?${new URLSearchParams({
                query: video.artist,
              })}`}
              sx={{
                fontWeight: 600,
              }}
            >
              {video.artist}
            </Link>
            <Typography variant="body2" color="text.secondary">
              {tr('制作方')}
            </Typography>
          </Box>
        </Stack>
      )}
      {(video.captionTitle || video.description || video.uploader) && (
        <Paper
          onClick={() => setExpanded(!expanded)}
          variant="outlined"
          sx={{
            p: 2.5,
            my: 2,
          }}
        >
          {video.uploader && (
            <Typography variant="body2" color="text.secondary">
              {tr('上传者：')}
              {video.uploader}
            </Typography>
          )}
          {video.captionTitle && (
            <Typography
              component="h3"
              variant="subtitle1"
              sx={{
                my: 1,
              }}
            >
              {video.captionTitle}
            </Typography>
          )}
          {video.description && (
            <Typography
              sx={{
                whiteSpace: 'pre-wrap',
                display: '-webkit-box',
                WebkitLineClamp: expanded ? 'unset' : 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                lineHeight: 1.8,
              }}
            >
              {video.description}
            </Typography>
          )}
        </Paper>
      )}
      {account.account && (video.csrfToken ?? account.account.csrfToken) && (
        <Stack direction="row">
          <Button onClick={() => editTags('add')}>{tr('添加标签')}</Button>
          <Button onClick={() => editTags('remove')}>{tr('移除标签')}</Button>
        </Stack>
      )}
      {video.tags.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          aria-label={tr('视频标签')}
          sx={{
            flexWrap: 'wrap',
            my: 2,
          }}
        >
          {video.tags.map((tag) => (
            <Chip
              component={RouterLink}
              to={tagUrl(tag)}
              key={tag.name}
              clickable
              label={tagLabel(tag)}
            />
          ))}
        </Stack>
      )}
      {!video.description && !video.captionTitle && (
        <Typography color="text.secondary">{tr('暂无简介。')}</Typography>
      )}
    </Box>
  );
}
