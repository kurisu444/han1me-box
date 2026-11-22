export interface ComicCard {
  id: string;
  title: string;
  coverUrl: string;
}

export function comicCardFromJson(card: Partial<ComicCard>): ComicCard {
  return { id: card.id ?? '', title: card.title ?? '', coverUrl: card.coverUrl ?? '' };
}
export interface ComicHome {
  trending: ComicCard[];
  latest: ComicCard[];
}
export interface ComicSearchResult {
  items: ComicCard[];
  page: number;
  totalPages: number;
}
export interface ComicTag {
  type: string;
  name: string;
  path: string;
}
export interface ComicDetail extends ComicCard {
  pageCount: number;
  tags: ComicTag[];
  imageUrls: string[];
  artist?: string;
  uploadTime?: string;
  description?: string;
}

export interface ComicCacheEntry extends ComicCard {
  archivePath: string;
  pageCount: number;
  category: string;
}
