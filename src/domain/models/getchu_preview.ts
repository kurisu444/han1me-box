export interface GetchuPreviewItem {
  id: string;
  title: string;
  detailUrl: string;
  brand?: string;
  coverUrl?: string;
  price?: string;
}
export interface GetchuPreviewGroup {
  releaseDate: string;
  items: GetchuPreviewItem[];
}
export interface GetchuPreviewFeed {
  month: string;
  groups: GetchuPreviewGroup[];
}
export interface GetchuPreviewSection {
  title: string;
  body: string;
}
export interface GetchuPreviewDetail {
  id: string;
  title: string;
  productUrl: string;
  videoUrls: string[];
  sections: GetchuPreviewSection[];
  sampleImages: string[];
  seriesItems: GetchuPreviewItem[];
  brand?: string;
  coverUrl?: string;
  description?: string;
  releaseDate?: string;
  price?: string;
}
