import { useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import TranslateIcon from '@mui/icons-material/Translate';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useI18n } from '../../../app/i18n';
import { useSettings } from '../../../app/settings_context';
import { resolvedBaseUrl } from '../../../core/settings';
import { translateVideo } from '../../../data/remote/google_translate_api';
import { localizeTag, searchLocale } from '../../../data/search_option_catalog';
import type { VideoCard, VideoDetail, VideoTranslation } from '../../../domain/models/video';
import { CompactVideoCard, VideoCover } from '../../shared/video_card';
import { AuthorSubscribeButton, VideoActions } from './video_actions';

export function VideoDetailContent({
  video: original,
  related,
  playlistTitle,
  onSelectEpisode,
  onTitleChanged,
}: {
  video: VideoDetail;
  related: VideoCard[];
  playlistTitle?: string;
  onSelectEpisode?: (id: string) => void;
  onTitleChanged?: (title?: string) => void;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const [translation, setTranslation] = useState<VideoTranslation>();
  const [showTranslated, setShowTranslated] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const video = translation && showTranslated ? { ...original, ...translation } : original;
  const hasDetails = Boolean(video.description || video.captionTitle || video.uploader);

  function tagLabel(tag: VideoDetail['tags'][number]) {
    const name = localizeTag(tag.name, searchLocale(settings.language, navigator.language));
    return tag.count === undefined ? name : `${name} (${tag.count})`;
  }

  function tagUrl(tag: VideoDetail['tags'][number]) {
    const query = tag.href
      ? new URL(tag.href, resolvedBaseUrl(settings)).search
      : `?${new URLSearchParams({ 'tags[]': tag.name })}`;
    return `/search${query}`;
  }

  async function handleTranslate() {
    if (translation) {
      const next = !showTranslated;
      setShowTranslated(next);
      onTitleChanged?.(next ? translation.title : undefined);
      return;
    }
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
      setShowTranslated(true);
      onTitleChanged?.(result.title);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  function selectEpisodeFromDialog(id: string) {
    setSeriesOpen(false);
    onSelectEpisode?.(id);
  }

  return (
    <Stack component="section" spacing={2}>
      {video.artist && (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', py: 0.25 }}>
          <Stack
            component={RouterLink}
            to={`/search?${new URLSearchParams({ query: video.artist })}`}
            direction="row"
            spacing={1.25}
            sx={{
              flex: 1,
              minWidth: 0,
              alignItems: 'center',
              textDecoration: 'none',
              color: 'text.primary',
              '&:hover .artist-name': { color: 'primary.main' },
            }}
          >
            <Avatar
              src={video.artistAvatarUrl}
              alt={video.artist}
              sx={{ width: 38, height: 38, flexShrink: 0 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                className="artist-name"
                noWrap
                sx={{
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  transition: 'color 0.15s ease',
                }}
              >
                {video.artist}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11.5 }}>
                {tr('制作方')}
              </Typography>
            </Box>
          </Stack>
          <AuthorSubscribeButton video={original} />
        </Stack>
      )}
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Typography
            component="h1"
            variant="subtitle1"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 700,
              lineHeight: 1.45,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {video.title}
          </Typography>
          <Button
            size="small"
            color="primary"
            endIcon={expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            onClick={() => setExpanded((value) => !value)}
            sx={{
              flexShrink: 0,
              minWidth: 'auto',
              px: 0.75,
              py: 0.25,
              fontSize: 12,
            }}
          >
            {tr(expanded ? '收起' : '展开')}
          </Button>
        </Stack>
        <Stack
          direction="row"
          spacing={1.25}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
            alignItems: 'center',
            mt: 1,
            color: 'text.secondary',
            '& svg': { fontSize: 14 },
          }}
        >
          {video.views && (
            <Stack direction="row" spacing={0.4} sx={{ alignItems: 'center' }}>
              <VisibilityOutlinedIcon />
              <Typography variant="caption">{video.views}</Typography>
            </Stack>
          )}
          {video.commentCount !== undefined && (
            <Stack direction="row" spacing={0.4} sx={{ alignItems: 'center' }}>
              <ChatBubbleOutlineOutlinedIcon />
              <Typography variant="caption">{video.commentCount}</Typography>
            </Stack>
          )}
          {video.uploadDate && (
            <Stack direction="row" spacing={0.4} sx={{ alignItems: 'center' }}>
              <CalendarTodayOutlinedIcon />
              <Typography variant="caption">{video.uploadDate}</Typography>
            </Stack>
          )}
          {video.genre && (
            <Stack direction="row" spacing={0.4} sx={{ alignItems: 'center' }}>
              <LocalOfferOutlinedIcon />
              <Typography variant="caption">{video.genre}</Typography>
            </Stack>
          )}
          {video.duration && (
            <Stack direction="row" spacing={0.4} sx={{ alignItems: 'center' }}>
              <AccessTimeIcon />
              <Typography variant="caption">{video.duration}</Typography>
            </Stack>
          )}
        </Stack>
        {expanded && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: '8px',
              bgcolor: 'action.hover',
            }}
          >
            {video.uploader && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                {tr('上传者：')}
                {video.uploader}
              </Typography>
            )}
            {video.captionTitle && (
              <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                {video.captionTitle}
              </Typography>
            )}
            {video.description ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.7,
                  fontSize: 12.5,
                }}
              >
                {video.description}
              </Typography>
            ) : (
              !hasDetails && (
                <Typography variant="body2" color="text.secondary">
                  {tr('暂无简介。')}
                </Typography>
              )
            )}
          </Box>
        )}
      </Box>
      <VideoActions video={original} />
      {video.tags.length > 0 && (
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          aria-label={tr('视频标签')}
          sx={{ flexWrap: 'wrap' }}
        >
          {video.tags.map((tag) => (
            <Chip
              key={tag.name}
              component={RouterLink}
              to={tagUrl(tag)}
              clickable
              size="small"
              label={tagLabel(tag)}
              sx={{
                height: 26,
                fontSize: 12,
                borderRadius: '6px',
              }}
            />
          ))}
        </Stack>
      )}
      {video.playlist.length > 0 && (
        <Box>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {playlistTitle || tr('系列影片')}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 0.75 }}
              >
                {video.playlist.length}
                {tr('集')}
              </Typography>
            </Typography>
            <Button
              size="small"
              onClick={() => setSeriesOpen(true)}
              sx={{ minWidth: 'auto', px: 0.75, py: 0.25, fontSize: 12 }}
            >
              {tr('查看更多')}
            </Button>
          </Stack>
          <Box
            sx={{
              display: 'flex',
              gap: 1.25,
              overflowX: 'auto',
              pb: 1,
            }}
          >
            {video.playlist.map((item) => {
              const selected = item.id === video.id;
              return (
                <Paper
                  key={item.id}
                  variant="outlined"
                  onClick={() => onSelectEpisode?.(item.id)}
                  sx={{
                    width: 126,
                    flexShrink: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderWidth: selected ? 2 : 1,
                    transition: 'border-color 0.15s ease',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <Box sx={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden' }}>
                    <VideoCover key={item.coverUrl} url={item.coverUrl} title={item.title} />
                    {item.duration && (
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          right: 4,
                          bottom: 4,
                          px: 0.5,
                          borderRadius: '4px',
                          bgcolor: 'rgba(0, 0, 0, 0.75)',
                          color: '#fff',
                          fontSize: 10,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.duration}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ p: 0.75 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        display: 'block',
                        fontWeight: selected ? 700 : 600,
                        color: selected ? 'primary.main' : 'text.primary',
                      }}
                    >
                      {item.title}
                    </Typography>
                    {(item.artist || item.views) && (
                      <Typography
                        variant="caption"
                        noWrap
                        color="text.secondary"
                        sx={{ display: 'block', fontSize: 10.5 }}
                      >
                        {item.artist || item.views}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}
      <Box>
        <Button
          size="small"
          startIcon={<TranslateIcon sx={{ fontSize: '16px !important' }} />}
          disabled={busy}
          onClick={handleTranslate}
          sx={{ px: 0.75, minWidth: 'auto', fontSize: 12.5 }}
        >
          {busy ? tr('翻译中…') : translation && showTranslated ? tr('显示原文') : tr('翻译')}
        </Button>
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </Box>
      <Divider />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
          {tr('相关推荐')}
        </Typography>
        <Stack spacing={1}>
          {related.length ? (
            related.map((item) => <CompactVideoCard key={item.id} video={item} />)
          ) : (
            <Typography variant="body2" color="text.secondary">
              {tr('暂无相关推荐。')}
            </Typography>
          )}
        </Stack>
      </Box>
      <Dialog open={seriesOpen} onClose={() => setSeriesOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          {playlistTitle || tr('系列影片')}（{video.playlist.length}
          {tr('集')}）
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ py: 0.5 }}>
            {video.playlist.map((item) => (
              <CompactVideoCard
                key={item.id}
                video={item}
                selected={item.id === video.id}
                onSelect={() => selectEpisodeFromDialog(item.id)}
              />
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
