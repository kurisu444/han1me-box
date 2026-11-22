export interface VideoCard {
  id: string;
  title: string;
  coverUrl: string;
  duration?: string;
  views?: string;
  rating?: string;
  artist?: string;
  uploadTime?: string;
  artistQuery?: string;
}

export interface HomeSection {
  title: string;
  videos: VideoCard[];
  moreUrl?: string;
  isFeatured: boolean;
}

export interface HomeFeed {
  featured?: VideoCard;
  sections: HomeSection[];
}

export interface PreviewItem {
  id: string;
  title: string;
  coverUrl: string;
  videoTitle?: string;
  brand?: string;
  releaseDate?: string;
  description?: string;
  tags: string[];
  previewImages: string[];
}

export interface PreviewFeed {
  title: string;
  description: string;
  coverUrl?: string;
  items: PreviewItem[];
}

export interface VideoTag {
  name: string;
  count?: number;
  href?: string;
}

export interface VideoSource {
  quality: string;
  url: string;
  type?: string;
}

/** 返回秒数，供原生 video 使用；无效或非正时长返回 null。 */
export function parseVideoDuration(value?: string | null): number | null {
  const parts = value?.trim().split(':') ?? [];
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  let seconds = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }
    seconds = seconds * 60 + Number(trimmed);
  }
  return seconds <= 0 ? null : seconds;
}

export interface VideoDetail {
  id: string;
  title: string;
  coverUrl?: string;
  duration?: string;
  artist?: string;
  artistId?: string;
  artistAvatarUrl?: string;
  uploader?: string;
  uploaderAvatarUrl?: string;
  genre?: string;
  views?: string;
  rating?: string;
  uploadDate?: string;
  captionTitle?: string;
  description?: string;
  downloadUrl?: string;
  csrfToken?: string;
  currentUserId?: string;
  subscriptionUserId?: string;
  commentCount?: number;
  tags: VideoTag[];
  sources: VideoSource[];
  playlist: VideoCard[];
  related: VideoCard[];
}

export interface Comment {
  id: string;
  username: string;
  content: string;
  avatarUrl?: string;
  timeAgo?: string;
  likeCount?: string;
  replyCount?: number;
  hasMoreReplies: boolean;
  foreignId?: string;
  likeUserId?: string;
  likesCount?: number;
  likesSum?: number;
  liked: boolean;
  disliked: boolean;
  reportableId?: string;
  reportableType?: string;
}

export interface CommentPage {
  comments: Comment[];
  totalCount?: string;
  csrfToken?: string;
  currentUserId?: string;
}

export interface VideoTranslation {
  title: string;
  captionTitle?: string;
  description?: string;
}
