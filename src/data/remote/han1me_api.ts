import { siteEndpointUrl, siteHomeUrl, rewriteMediaUrl } from '../../core/site_url';
import { log } from '../../core/logging/app_log';
import {
  parseVideoDuration,
  type HomeFeed,
  type HomeSection,
  type VideoCard,
  type VideoDetail,
  type VideoSource,
  type VideoTag,
  type Comment,
  type CommentPage,
} from '../../domain/models/video';
import * as http from './han1me_http_client';
import { searchQueryToUri, type SearchQuery } from '../../domain/models/search_query';

export interface SearchResult {
  items: VideoCard[];
  page: number;
  totalPages: number;
}

const resolvedOrigins = new Map<string, string>();
export const resolvedOrigin = (url: string) =>
  resolvedOrigins.get(new URL(url).origin) ?? new URL(url).origin;
export function rememberOrigin(requested: string, resolved: string) {
  resolvedOrigins.set(new URL(requested).origin, new URL(resolved).origin);
}

export function parseSearch(
  document: Document,
  baseUrl: string,
  page: number,
  type: string,
): SearchResult {
  const normal = document.querySelectorAll(
    '.content-padding-new div.horizontal-card, .content-padding div.horizontal-card',
  );
  let items = (
    normal.length
      ? Array.from(normal, (element) => card(element, baseUrl))
      : Array.from(document.querySelectorAll('.home-rows-videos-wrapper')).flatMap((wrapper) =>
          Array.from(wrapper.children, (element) => simplifiedCard(element, baseUrl)),
        )
  ).filter((video) => video.id);
  if (!items.length && type === 'artist') {
    items = Array.from(document.querySelectorAll('.search-artist-card'), (element) => {
      const title = text(element.querySelector('.search-artist-title')) ?? '';
      const href = element.querySelector('a.overlay')?.getAttribute('href') ?? '';
      return {
        id: '',
        title,
        coverUrl: absolute(
          baseUrl,
          element.querySelector('img[style*="object-fit"]')?.getAttribute('src'),
        ),
        artist: text(element.querySelector('.search-artist-count')),
        artistQuery: (queryValue(href, 'query') ?? title).trim(),
      };
    }).filter((artist) => artist.title && artist.coverUrl);
  }
  const pages = Array.from(
    document.querySelectorAll('ul.pagination li.page-item > a.page-link'),
    (element) => integer(text(element)) ?? 0,
  ).filter((value) => value > 0);
  const currentPage =
    integer(text(document.querySelector('ul.pagination li.page-item.active > span.page-link'))) ??
    page;
  return { items, page: currentPage, totalPages: pages.length ? Math.max(...pages) : page };
}

export async function search(baseUrl: string, query: SearchQuery): Promise<SearchResult> {
  const encoded = searchQueryToUri({ ...query, text: query.text.trim() }).split('?')[1];
  const endpoint = siteEndpointUrl(baseUrl, 'search');
  const url = `${endpoint}?page=${query.page}${encoded ? `&${encoded}` : ''}`;
  const fetched = await documentWithBody(url);
  return parseSearch(fetched.document, fetched.url, query.page, query.type);
}

export class CloudflareChallengeException extends Error {
  constructor(public readonly url: string) {
    super('Cloudflare browser verification is required');
    this.name = 'CloudflareChallengeException';
    log('cloudflare challenge', { url });
  }
}

export function isCloudflareResponse(response: Han1meHttpResponse): boolean {
  return (
    response.statusCode === 403 &&
    ((response.headers['cf-mitigated'] ?? response.headers['CF-Mitigated'])?.toLowerCase() ===
      'challenge' ||
      ['cf-chl-', 'challenge-form', 'Just a moment', 'Attention Required'].some((marker) =>
        response.body.includes(marker),
      ))
  );
}

export function checkResponse(response: Han1meHttpResponse, url: string): void {
  if (isCloudflareResponse(response)) {
    throw new CloudflareChallengeException(url);
  }
  if (response.statusCode >= 400) {
    throw new Error(`Request failed: HTTP ${response.statusCode}`);
  }
}

function parseDocument(body: string): Document {
  return new DOMParser().parseFromString(body, 'text/html');
}

export async function documentWithBody(url: string, referer?: string) {
  const response = await http.get(url, referer ? { Referer: referer } : undefined);
  checkResponse(response, url);
  if (new URL(url).origin !== new URL(response.url).origin) {
    rememberOrigin(url, response.url);
  }
  return { document: parseDocument(response.body), body: response.body, url: response.url };
}

export function absolute(baseUrl: string, path?: string | null): string {
  return path ? rewriteMediaUrl(new URL(path, baseUrl).href) : '';
}

export function text(element?: Element | null): string | undefined {
  return element?.textContent?.trim();
}

function directText(element?: Element | null): string {
  return Array.from(element?.childNodes ?? [])
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function statText(element?: Element | null): string | undefined {
  return element ? directText(element) || text(element) : undefined;
}

export function uploadTime(element: Element): string | undefined {
  return (
    text(element.querySelector('.subtitle-time, .meta-stats span, .subtitle span[class*="time"]'))
      ?.replace(/[•\u00a0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || undefined
  );
}

export function queryValue(href: string, key: string): string | undefined {
  return URL.parse(href, 'https://site.invalid')?.searchParams.get(key) ?? undefined;
}

function card(element: Element, baseUrl: string): VideoCard {
  const link = element.querySelector('a.video-link[href*="watch"], a[href*="watch?v="]');
  const href = link?.getAttribute('href') ?? element.getAttribute('data-href') ?? '';
  const image = element.querySelector('img.main-thumb, img');
  const stats = element.querySelectorAll('.stats-container .stat-item');
  return {
    id: queryValue(href, 'v') ?? '',
    title:
      text(
        element.querySelector(
          '.title, .video-title, .home-rows-videos-title, .owl-home-rows-title',
        ),
      ) ??
      image?.getAttribute('alt')?.trim() ??
      '',
    coverUrl: absolute(baseUrl, image?.getAttribute('src')),
    duration: text(element.querySelector('.duration')),
    views: statText(stats[1]),
    rating: statText(stats[0]),
    artist: text(element.querySelector('.subtitle a, .meta-author a')),
    uploadTime: uploadTime(element),
  };
}

function simplifiedCard(element: Element, baseUrl: string): VideoCard {
  const href =
    element.getAttribute('href') ??
    element.getAttribute('data-href') ??
    element.querySelector('a')?.getAttribute('href') ??
    element.parentElement?.getAttribute('href') ??
    element.parentElement?.getAttribute('data-href') ??
    '';
  const image = element.querySelector('img');
  const content = element.querySelector('.home-rows-videos-div, .video-card-inner') ?? element;
  const stats = content.querySelectorAll('.stats-container .stat-item');
  return {
    id:
      queryValue(href, 'v') ??
      element.getAttribute('data-id') ??
      element.querySelector('[data-id]')?.getAttribute('data-id') ??
      '',
    title:
      text(element.querySelector('.home-rows-videos-title, .owl-home-rows-title')) ??
      text(element.parentElement?.querySelector('.home-rows-videos-title, .owl-home-rows-title')) ??
      image?.getAttribute('alt')?.trim() ??
      '',
    coverUrl: absolute(baseUrl, image?.getAttribute('src')),
    duration: text(content.querySelector('.duration')),
    views: statText(stats[1]),
    rating: statText(stats[0]),
    artist: text(content.querySelector('.subtitle a, .meta-author a')),
    uploadTime: uploadTime(content),
  };
}

function uniqueCards(cards: VideoCard[]): VideoCard[] {
  const seen = new Set<string>();
  return cards.filter((video) => {
    if (!video.id || seen.has(video.id)) {
      return false;
    }
    seen.add(video.id);
    return true;
  });
}

export function parseHome(document: Document, baseUrl: string): HomeFeed {
  const sections: HomeSection[] = [];
  for (const anchor of document.querySelectorAll('#home-rows-wrapper > a.horizontal-row-title')) {
    const row = anchor.nextElementSibling?.querySelector(
      '.home-rows-videos-wrapper.horizontal-row',
    );
    if (!row) {
      continue;
    }
    const videos = Array.from(row.querySelectorAll('div.horizontal-card'), (element) =>
      card(element, baseUrl),
    ).filter((video) => video.id);
    if (!videos.length) {
      continue;
    }
    sections.push({
      title: directText(anchor.querySelector('h3')),
      moreUrl: anchor.getAttribute('href') ?? '',
      videos,
      isFeatured: false,
    });
  }
  const banner = document.querySelector('#home-banner-wrapper');
  const title = text(banner?.querySelector('h1'));
  const meta = text(banner?.querySelector('h4'))?.split('•');
  const bannerImages = banner?.previousElementSibling?.querySelectorAll('img');
  const bannerImage =
    bannerImages?.[1] ??
    bannerImages?.[0] ??
    document.querySelector('div[style*="aspect-ratio"] img');
  const coverUrl = absolute(baseUrl, bannerImage?.getAttribute('src'));
  return {
    sections,
    featured: title
      ? {
          id: /thumbnail\/(\d+)/.exec(coverUrl)?.[1] ?? '',
          title,
          coverUrl,
          artist: meta?.[0]?.trim(),
          views: meta?.[1]?.trim(),
        }
      : undefined,
  };
}

export async function home(baseUrl: string): Promise<HomeFeed> {
  const fetched = await documentWithBody(siteHomeUrl(baseUrl));
  return parseHome(fetched.document, fetched.url);
}

function extractSources(document: Document, baseUrl: string, body: string): VideoSource[] {
  const sources = Array.from(document.querySelectorAll('video#player source'), (source) => ({
    quality: source.getAttribute('size') ?? 'Default',
    url: absolute(baseUrl, source.getAttribute('src')),
    type: source.getAttribute('type') ?? undefined,
  })).filter((source) => source.url);
  if (sources.length) {
    return sources;
  }
  const preload = absolute(
    baseUrl,
    document.querySelector('link[rel="preload"][as="video"]')?.getAttribute('href'),
  );
  if (preload) {
    return [{ quality: 'Default', url: preload }];
  }
  const patterns = [
    /const\s+source\s*=\s*['"]([^'"]+)['"]/g,
    /["']?(?:file|src)["']?\s*:\s*['"]([^'"]+)['"]/g,
    /sources\s*:\s*\[\s*['"]([^'"]+)['"]/g,
    /https?:\/\/[^"'<>\s\\]*?\.(?:m3u8|mp4)(?:\?[^"'<>\s\\]*?)?(?=["'<>\s\\]|$)/g,
  ];
  const urls = new Set<string>();
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) {
      urls.add(absolute(baseUrl, match[1] ?? match[0]));
    }
  }
  const hls = /\.m3u8(?:\?|$)/i;
  return [
    ...Array.from(urls).filter((url) => hls.test(url)),
    ...Array.from(urls).filter((url) => !hls.test(url)),
  ]
    .slice(0, 8)
    .map((url) => ({ quality: 'Default', url }));
}

function durationSeconds(document: Document, body: string): number | undefined {
  const meta =
    document.querySelector('meta[property="og:video:duration"]')?.getAttribute('content') ?? '';
  if (/^\d+$/.test(meta) && Number(meta) > 0) {
    return Number(meta);
  }
  const iso =
    document.querySelector('meta[itemprop="duration"]')?.getAttribute('content') ??
    /["']duration["']\s*:\s*["']([^"']+)["']/.exec(body)?.[1];
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso?.trim() ?? '');
  if (match) {
    const total =
      Number(match[1] ?? 0) * 86400 +
      Number(match[2] ?? 0) * 3600 +
      Number(match[3] ?? 0) * 60 +
      Number(match[4] ?? 0);
    if (total > 0) {
      return total;
    }
  }
  for (const selector of [
    '#video-duration',
    '.video-duration',
    '.video-title .duration',
    '.video-description-panel .duration',
  ]) {
    const seconds = parseVideoDuration(text(document.querySelector(selector)));
    if (seconds !== null) {
      return seconds;
    }
  }
}

function formatDuration(seconds?: number): string | undefined {
  if (seconds === undefined || seconds <= 0) {
    return undefined;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

export function parseVideo(
  document: Document,
  baseUrl: string,
  id: string,
  body: string,
): VideoDetail {
  const rawTitle = (
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
    text(document.querySelector('title')) ??
    ''
  ).trim();
  const title = ['- Hanime1.me', '- H動漫/裏番', '- Javchu.com'].some((suffix) =>
    rawTitle.includes(suffix),
  )
    ? rawTitle.split(' - ')[0].trim()
    : rawTitle;
  const panel = document.querySelector('div.video-description-panel');
  const uploaderRow = Array.from(panel?.children ?? []).find((element) =>
    element.getAttribute('style')?.includes('display: flex'),
  );
  const captionTitle = Array.from(panel?.children ?? [])
    .filter(
      (element) =>
        element !== uploaderRow &&
        !element.classList.contains('hidden-xs') &&
        !element.classList.contains('video-caption-text'),
    )
    .map((element) => text(element)?.replace(/\s+/g, ' '))
    .find(Boolean);
  const tags: VideoTag[] = [];
  for (const tag of document.querySelectorAll('.video-tags-wrapper .single-video-tag a')) {
    const href = tag.getAttribute('href')?.trim() ?? '';
    if (!href) {
      continue;
    }
    let visible = true;
    for (
      let element: Element | null = tag;
      element && !element.classList.contains('video-tags-wrapper');
      element = element.parentElement
    ) {
      if (
        element.hasAttribute('data-target') ||
        element.hasAttribute('hidden') ||
        element.classList.contains('hidden') ||
        element.getAttribute('style')?.replaceAll(' ', '').includes('display:none')
      ) {
        visible = false;
      }
    }
    if (!visible) {
      continue;
    }
    const label = text(tag) ?? '';
    const count = /\((\d+)\)/.exec(label)?.[1];
    const name =
      queryValue(href, 'tags[]') ??
      queryValue(href, 'tag') ??
      label.replace(/\s*\(\d+\)\s*$/, '').trim();
    if (name && !tags.some((existing) => existing.name === name)) {
      tags.push({ name, count: count === undefined ? undefined : Number(count), href });
    }
  }
  const artistNameNode = document.querySelector('#video-artist-name');
  const artistImage =
    document.querySelector('#video-user-avatar + img') ??
    document.querySelector('#video-user-avatar') ??
    panel?.querySelector('a[href*="/user/"] img');
  const genre =
    artistNameNode?.parentElement?.querySelector('a[href*="genre"]') ??
    document.querySelector(
      [
        '.video-description-panel a[href*="genre"]',
        '.video-details a[href*="genre"]',
        '#video-detail a[href*="genre"]',
      ].join(', '),
    );
  const viewsLine = text(panel?.querySelector('div.hidden-xs')) ?? '';
  const count = text(document.querySelector('#tab-comments-count'))?.replace(/\D/g, '');
  const playlist = uniqueCards(
    Array.from(document.querySelectorAll('#playlist-scroll .playlist-hover-wrap'), (element) =>
      card(element, baseUrl),
    ),
  );
  return {
    id,
    title: title || 'Untitled',
    coverUrl: absolute(
      baseUrl,
      document.querySelector('video#player')?.getAttribute('poster') ??
        document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    ),
    duration: formatDuration(durationSeconds(document, body)),
    artist:
      text(artistNameNode) ||
      text(panel?.querySelector('a[href*="/user/"]')?.nextElementSibling?.querySelector('span')) ||
      undefined,
    artistId:
      document
        .querySelector('#video-subscribe-form input[name="subscribe-artist-id"]')
        ?.getAttribute('value') || undefined,
    artistAvatarUrl: absolute(baseUrl, artistImage?.getAttribute('src')),
    uploader: text(uploaderRow?.querySelector('a[href*="/user/"] span')) || undefined,
    uploaderAvatarUrl: absolute(baseUrl, uploaderRow?.querySelector('img')?.getAttribute('src')),
    genre: text(genre) || undefined,
    views: /(?:观看次数|觀看次數)\s*[:：]?\s*([^\s&]+(?:次)?)/.exec(viewsLine)?.[1]?.trim(),
    rating: playlist.find((item) => item.id === id)?.rating,
    uploadDate: /\d{4}-\d{2}-\d{2}/.exec(viewsLine)?.[0],
    captionTitle,
    description: text(panel?.querySelector('.video-caption-text')) || undefined,
    downloadUrl: absolute(baseUrl, document.querySelector('#downloadBtn')?.getAttribute('href')),
    csrfToken:
      document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ??
      document.querySelector('input[name="_token"]')?.getAttribute('value') ??
      undefined,
    currentUserId:
      document.querySelector('input[name="like-user-id"]')?.getAttribute('value') ?? undefined,
    subscriptionUserId:
      document
        .querySelector('#video-subscribe-form input[name="subscribe-user-id"]')
        ?.getAttribute('value') ?? undefined,
    commentCount: count ? Number(count) : undefined,
    sources: extractSources(document, baseUrl, body),
    tags,
    playlist,
    related: uniqueCards(
      Array.from(
        document.querySelectorAll(
          '#related-tabcontent .horizontal-card, #related-tabcontent .related-video-margin-bottom',
        ),
        (element) =>
          element.classList.contains('related-video-margin-bottom')
            ? simplifiedCard(element.parentElement ?? element, baseUrl)
            : card(element, baseUrl),
      ),
    ),
  };
}

export async function video(baseUrl: string, id: string): Promise<VideoDetail> {
  const fetched = await documentWithBody(
    siteEndpointUrl(baseUrl, `watch?v=${encodeURIComponent(id)}`),
    siteHomeUrl(baseUrl),
  );
  return parseVideo(fetched.document, fetched.url, id, fetched.body);
}

export async function related(baseUrl: string, id: string): Promise<VideoCard[]> {
  return (await video(baseUrl, id)).related;
}

function javaStringHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (31 * hash + value.charCodeAt(index)) | 0;
  }
  return hash;
}

function integer(value?: string | null): number | undefined {
  return value != null && /^-?\d+$/.test(value.trim()) ? Number(value) : undefined;
}

function commentUsername(field?: Element | null): string {
  const anchor = field?.querySelector('a');
  if (!anchor) {
    return '';
  }
  const clone = anchor.cloneNode(true) as Element;
  for (const span of clone.querySelectorAll('span')) {
    span.remove();
  }
  return text(clone) ?? '';
}

function commentFields(
  body: Element,
  post: Element,
  baseUrl: string,
): Omit<Comment, 'id' | 'hasMoreReplies'> {
  const fields = body.querySelectorAll('.comment-index-text');
  return {
    username: commentUsername(fields[0]),
    content: text(fields[1]) ?? '',
    avatarUrl: absolute(baseUrl, body.querySelector('img')?.getAttribute('src')) || undefined,
    timeAgo: text(fields[0]?.querySelector('span')) || undefined,
    foreignId: post.querySelector('#foreign_id')?.getAttribute('value') ?? undefined,
    likeUserId:
      post.querySelector('input[name="comment-like-user-id"]')?.getAttribute('value') ?? undefined,
    likesCount: integer(
      post.querySelector('input[name="comment-likes-count"]')?.getAttribute('value'),
    ),
    likesSum: integer(post.querySelector('input[name="comment-likes-sum"]')?.getAttribute('value')),
    liked: post.querySelector('input[name="like-comment-status"]')?.getAttribute('value') === '1',
    disliked:
      post.querySelector('input[name="unlike-comment-status"]')?.getAttribute('value') === '1',
    reportableId:
      body.querySelector('span.report-btn')?.getAttribute('data-reportable-id') ?? undefined,
    reportableType:
      body.querySelector('span.report-btn')?.getAttribute('data-reportable-type') ?? undefined,
  };
}

function parseCommentBlock(wrapper: Element, baseUrl: string): Comment | undefined {
  if (wrapper.querySelectorAll('.comment-index-text').length < 2) {
    return undefined;
  }
  const fields = commentFields(wrapper, wrapper, baseUrl);
  if (!fields.username || !fields.content) {
    return undefined;
  }
  const replyText = Array.from(
    wrapper.querySelectorAll('div.load-replies-btn'),
    (element) => element.textContent,
  ).join(' ');
  const dataCommentId = wrapper.getAttribute('data-comment-id')?.trim();
  const replyWrapperId = wrapper
    .querySelector('div[id^="reply-section-wrapper"]')
    ?.id.split('-')
    .at(-1);
  const resolvedId = dataCommentId || replyWrapperId;
  const id = resolvedId || `${fields.username}_${javaStringHash(fields.content)}`;
  const hasReplyButton = wrapper.querySelector('div[class^="load-replies-btn"]') !== null;
  return {
    ...fields,
    id,
    likeCount: text(wrapper.querySelectorAll('#comment-like-form-wrapper span[style]')[1]),
    replyCount: integer(/\d+/.exec(replyText)?.[0]),
    hasMoreReplies: hasReplyButton && Boolean(resolvedId),
  };
}

export function parseComments(document: Document, baseUrl: string): CommentPage {
  const modernBlocks = Array.from(document.querySelectorAll('#comment-start .comment-item-block'));
  const fragmentBlocks =
    modernBlocks.length > 0
      ? modernBlocks
      : Array.from(document.querySelectorAll('.comment-item-block'));

  const comments: Comment[] = [];
  if (fragmentBlocks.length > 0) {
    for (const block of fragmentBlocks) {
      const parsed = parseCommentBlock(block, baseUrl);
      if (parsed) {
        comments.push(parsed);
      }
    }
  } else {
    // 兼容旧版结构：每 4 个兄弟节点为一条评论。
    const children = Array.from(document.querySelector('#comment-start')?.children ?? []);
    for (let index = 0; index < children.length; index += 4) {
      const wrapper = document.createElement('div');
      wrapper.append(...children.slice(index, index + 4).map((element) => element.cloneNode(true)));
      const parsed = parseCommentBlock(wrapper, baseUrl);
      if (parsed) {
        comments.push(parsed);
      }
    }
  }

  const sentinel = document.querySelector('#comment-scroll-sentinel');
  const hasMore = sentinel?.getAttribute('data-has-more') === '1';
  const rawNextOffset = sentinel?.getAttribute('data-next-offset');
  const nextOffset =
    rawNextOffset != null && /^\d+$/.test(rawNextOffset) ? Number(rawNextOffset) : undefined;

  return {
    comments,
    csrfToken: document.querySelector('input[name="_token"]')?.getAttribute('value') ?? undefined,
    currentUserId:
      document.querySelector('input[name="comment-user-id"]')?.getAttribute('value') ?? undefined,
    hasMore,
    nextOffset,
  };
}

const ajaxHeaders = {
  'X-Requested-With': 'XMLHttpRequest',
  Accept: 'application/json, text/javascript, */*; q=0.01',
};

export async function comments(
  baseUrl: string,
  id: string,
  type = 'video',
  offset?: number,
): Promise<CommentPage> {
  const params = new URLSearchParams({ type, id });
  if (offset != null) {
    params.set('offset', String(offset));
  }
  const url = `${siteEndpointUrl(baseUrl, 'loadComment')}?${params}`;
  const referer = siteEndpointUrl(baseUrl, `watch?v=${encodeURIComponent(id)}`);
  const response = await http.get(url, { ...ajaxHeaders, Referer: referer });
  checkResponse(response, referer);
  // 首屏返回 { comments: html }，后续 offset 翻页返回 { items_html, has_more, next_offset }。
  let body = response.body;
  try {
    const decoded = JSON.parse(body);
    if (typeof decoded?.items_html === 'string') {
      const page = parseComments(parseDocument(decoded.items_html), response.url);
      return {
        ...page,
        hasMore: Boolean(decoded.has_more),
        nextOffset:
          typeof decoded.next_offset === 'number' && decoded.next_offset >= 0
            ? decoded.next_offset
            : undefined,
      };
    }
    if (typeof decoded?.comments === 'string') {
      body = decoded.comments;
    }
  } catch {}
  return parseComments(parseDocument(body), response.url);
}

export async function replies(baseUrl: string, id: string): Promise<CommentPage> {
  const url = `${siteEndpointUrl(baseUrl, 'loadReplies')}?${new URLSearchParams({ id })}`;
  const referer = siteEndpointUrl(baseUrl, '');
  const response = await http.get(url, { ...ajaxHeaders, Referer: referer });
  checkResponse(response, url);
  let body = response.body;
  try {
    const decoded = JSON.parse(body);
    if (typeof decoded?.replies === 'string') {
      body = decoded.replies;
    }
  } catch {}
  const document = parseDocument(body);
  const children = Array.from(document.querySelector('div[id^="reply-start"]')?.children ?? []);
  const comments: Comment[] = [];
  for (let index = 0; index + 1 < children.length; index += 2) {
    const body = children[index];
    const post = children[index + 1];
    if (body.querySelectorAll('.comment-index-text').length < 2) {
      continue;
    }
    comments.push({
      ...commentFields(body, post, response.url),
      id: '',
      hasMoreReplies: false,
      likeCount: text(post.querySelectorAll('span[style]')[1]),
    });
  }
  return { comments };
}
