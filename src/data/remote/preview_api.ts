import { siteEndpointUrl } from '../../core/site_url';
import { documentWithBody, absolute, text, queryValue } from './han1me_api';
import type { PreviewFeed, PreviewItem } from '../../domain/models/video';
function documentTitle(document: Document, fallback: string) {
  const raw =
    document.querySelector('meta[name="title"]')?.getAttribute('content')?.trim() ??
    text(document.querySelector('title')) ??
    '';
  const parts = raw
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.includes(fallback)) return fallback;
  return parts.length > 1 && parts[1] !== 'Hanime1.me' ? parts[1] : fallback;
}
async function upcoming(base: string): Promise<PreviewFeed> {
  const { document } = await documentWithBody(
    `${siteEndpointUrl(base, 'search')}?${new URLSearchParams({ genre: '新番預告' })}`,
  );
  const items: PreviewItem[] = [];
  for (const anchor of document.querySelectorAll('#home-rows-wrapper a[href*="watch?v="]')) {
    const card =
      anchor.querySelector('.home-rows-videos-div, .video-card-inner, .horizontal-card') ?? anchor;
    const item = {
      id: queryValue(anchor.getAttribute('href') ?? '', 'v') ?? '',
      title: text(card.querySelector('.home-rows-videos-title, .title')) ?? '',
      coverUrl: absolute(base, card.querySelector('img')?.getAttribute('src')),
      tags: [],
      previewImages: [],
    };
    if (item.id && item.title && !items.some((existing) => existing.id === item.id))
      items.push(item);
  }
  return {
    title: documentTitle(document, '新番預告'),
    description: '',
    coverUrl: items[0]?.coverUrl,
    items,
  };
}
export async function previews(base: string, month: string): Promise<PreviewFeed> {
  const now = new Date();
  const current = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (month >= current) return upcoming(base);
  try {
    const { document } = await documentWithBody(siteEndpointUrl(base, `previews/${month}`));
    const header = document.querySelector('.preview-top-content');
    const items = Array.from(document.querySelectorAll('.content-padding > div.row[id]'), (row) => {
      const content = row.querySelector('.preview-info-content-padding');
      return {
        id: row.id,
        title: text(row.querySelector('h4, h3')) ?? '',
        coverUrl: absolute(
          base,
          row.querySelector('.preview-info-cover > img')?.getAttribute('src'),
        ),
        videoTitle: text(content?.querySelector('h4')),
        brand: text(content?.querySelector('h5 a')),
        releaseDate: text(content?.querySelectorAll('h5')[1]),
        description: text(content?.querySelector('h5.caption')),
        tags: Array.from(
          content?.querySelectorAll('.single-video-tag > a') ?? [],
          (node) => text(node) ?? '',
        ).filter(Boolean),
        previewImages: Array.from(
          content?.querySelectorAll('img.preview-image-modal-trigger') ?? [],
          (node) => absolute(base, node.getAttribute('src')),
        ).filter(Boolean),
      };
    }).filter((item) => item.title && item.coverUrl);
    if (items.length)
      return {
        title: text(header?.querySelector('h1')) ?? `${month} previews`,
        description: text(header?.querySelector('p')) ?? '',
        coverUrl: absolute(
          base,
          document.querySelector('#player-div-wrapper > img')?.getAttribute('src'),
        ),
        items,
      };
  } catch {}
  return upcoming(base);
}
