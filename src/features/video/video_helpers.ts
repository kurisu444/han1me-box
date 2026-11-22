import type { AppSettings } from '../../core/settings';
import { meetsMinimumVideoViews } from '../../core/video_view_count';
import {
  parseVideoDuration,
  type Comment,
  type VideoCard,
  type VideoDetail,
  type VideoSource,
} from '../../domain/models/video';
import type { WatchProgress } from '../../domain/models/library';

export function homeVideoVisible(
  video: VideoCard,
  settings: AppSettings,
  subscribed = new Set<string>(),
): boolean {
  if (settings.exemptSubscribedAuthors && subscribed.has(video.artist?.toLowerCase() ?? '')) {
    return true;
  }
  return (
    relatedVideoVisible(video, settings) &&
    (parseVideoDuration(video.duration) ?? 0) >= settings.minimumVideoDurationSeconds &&
    meetsMinimumVideoViews(video.views, settings.minimumVideoViews)
  );
}

export function relatedVideoVisible(video: VideoCard, settings: AppSettings): boolean {
  return (
    !settings.blockedVideoTitleKeywords.some((keyword) =>
      video.title.toLowerCase().includes(keyword.toLowerCase()),
    ) &&
    !settings.blockedAuthors.some((author) =>
      (video.artist ?? '').toLowerCase().includes(author.toLowerCase()),
    )
  );
}

export function preferredSource(sources: VideoSource[], quality: number): VideoSource | undefined {
  const distance = (source: VideoSource) =>
    Math.abs(Number(/\d+/.exec(source.quality)?.[0] ?? 720) - quality);
  return sources.reduce<VideoSource | undefined>(
    (best, source) => (!best || distance(source) < distance(best) ? source : best),
    undefined,
  );
}

export function resumePosition(progress?: WatchProgress): number {
  return progress && progress.positionMs > 0 && progress.positionMs < progress.durationMs - 3000
    ? progress.positionMs / 1000
    : 0;
}

export function downloadSource(sources: VideoSource[], preferred: number): VideoSource | undefined {
  const quality = (source: VideoSource) => Number(/\d+/.exec(source.quality)?.[0] ?? 0);
  return sources.reduce<VideoSource | undefined>((best, item) => {
    if (!best) {
      return item;
    }
    const difference = Math.abs(quality(item) - preferred) - Math.abs(quality(best) - preferred);
    return difference < 0 || (difference === 0 && quality(item) < quality(best)) ? item : best;
  }, undefined);
}

export function nextEpisode(video: VideoDetail): VideoCard | undefined {
  const index = video.playlist.findIndex((episode) => episode.id === video.id);
  return index >= 0 && index + 1 < video.playlist.length
    ? video.playlist[index + 1]
    : video.playlist.find((episode) => episode.id !== video.id);
}

export type CommentSort = 'latest' | 'earliest' | 'mostReplies' | 'mostLikes' | 'mostDislikes';
export function visibleComments(
  comments: Comment[],
  settings: AppSettings,
  sort: CommentSort,
): Comment[] {
  const visible = comments.filter(
    (comment) =>
      !settings.blockedCommentKeywords.some((keyword) =>
        comment.content.toLowerCase().includes(keyword.toLowerCase()),
      ) &&
      !settings.blockedCommentUsers.some((user) =>
        comment.username.toLowerCase().includes(user.toLowerCase()),
      ),
  );
  const compareId = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
  return visible.sort((left, right) => {
    switch (sort) {
      case 'latest':
        return compareId(right.id, left.id);
      case 'earliest':
        return compareId(left.id, right.id);
      case 'mostReplies':
        return (right.replyCount ?? 0) - (left.replyCount ?? 0);
      case 'mostLikes':
        return (right.likesSum ?? 0) - (left.likesSum ?? 0);
      case 'mostDislikes':
        return (
          (right.likesCount ?? 0) -
          (right.likesSum ?? 0) -
          ((left.likesCount ?? 0) - (left.likesSum ?? 0))
        );
      default:
        return 0;
    }
  });
}
