import {
  type ComicCard,
  type ComicHome,
  type ComicSearchResult,
  type ComicDetail,
  type ComicTag,
} from '../../domain/models/comic';
import { documentWithBody, text } from './han1me_api';
import { queryClient } from '../han1me_repository';
import { queryOptions } from '@tanstack/react-query';
import { readComicHome, writeComicHome } from '../local/home_cache';

export const baseUrl = 'https://hanimeone.me';
const absolute = (path?: string | null) => (path ? new URL(path, baseUrl).href : '');
function cards(section: Element): ComicCard[] {
  return Array.from(section.querySelectorAll('a[href*="/comic/"]'), (anchor) => {
    const image = anchor.querySelector('img');
    return {
      id: /\/comic\/(\d+)/.exec(anchor.getAttribute('href') ?? '')?.[1] ?? '',
      title: text(anchor.querySelector('.comic-rows-videos-title')) ?? '',
      coverUrl: absolute(
        image?.getAttribute('data-srcset') ??
          image?.getAttribute('data-src') ??
          image?.getAttribute('src'),
      ),
    };
  }).filter((item) => item.id && item.title);
}
export async function home(): Promise<ComicHome> {
  const { document } = await documentWithBody(`${baseUrl}/comics`);
  const sections = [...document.querySelectorAll('.comic-rows-wrapper')];
  return {
    trending: sections
      .filter((section) => text(section.querySelector('h3'))?.includes('發燒'))
      .flatMap(cards),
    latest: sections
      .filter((section) => text(section.querySelector('h3'))?.includes('最新'))
      .flatMap(cards),
  };
}
export async function browse(path: string, page: number): Promise<ComicSearchResult> {
  const url = new URL(path, baseUrl);
  url.search = new URLSearchParams({ page: String(page) }).toString();
  const { document } = await documentWithBody(url.href);
  const numbers = [...document.querySelectorAll('.pagination .page-link')]
    .map((item) => Number(text(item)))
    .filter((value) => value > 0);
  const current = Number(text(document.querySelector('.pagination .active .page-link'))) || page;
  return {
    items: [...document.querySelectorAll('.comic-rows-wrapper')].flatMap(cards),
    page: current,
    totalPages: numbers.length ? Math.max(...numbers) : current,
  };
}
export async function detail(id: string): Promise<ComicDetail> {
  const [info, reader] = await Promise.all([
    documentWithBody(`${baseUrl}/comic/${id}`),
    documentWithBody(`${baseUrl}/comic/${id}/1`),
  ]);
  const doc = info.document,
    page = reader.document;
  const image = page.querySelector('#current-page-image');
  const count =
    Number(page.querySelector('.comic-show-content-nav')?.getAttribute('data-pages')) || 1;
  const prefix = image?.getAttribute('data-prefix') ?? '';
  const fallback = image?.getAttribute('data-extension') ?? 'jpg';
  const script =
    [...page.querySelectorAll('script')].find((script) =>
      script.textContent?.includes('window.extensions'),
    )?.textContent ?? '';
  const match = /extensions\.innerHTML\s*=\s*'([^']+)'/.exec(script);
  const extensions: string[] = match ? JSON.parse(match[1].replaceAll('&quot;', '"')) : [];
  const types: Record<string, string> = {
    artists: '作者',
    tags: '標籤',
    languages: '語言',
    categories: '分類',
    groups: '社團',
    characters: '角色',
    parodies: '同人',
  };
  const tags: ComicTag[] = [
    ...doc.querySelectorAll('.comics-metadata-margin-top h5 a[href*="hanimeone.me/"]'),
  ]
    .map((link) => {
      const path = link.getAttribute('href') ?? '';
      return {
        name: text(link) ?? '',
        path,
        type: types[new URL(path, baseUrl).pathname.split('/')[1]],
      };
    })
    .filter((tag) => tag.name && tag.type);
  const title =
    text(doc.querySelector('h3.title')) ??
    page
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content')
      ?.replace(/^第\d+頁\s*-\s*/, '') ??
    '';
  return {
    id,
    title,
    coverUrl: absolute(
      doc.querySelector('.col-md-4 img')?.getAttribute('data-srcset') ?? image?.getAttribute('src'),
    ),
    pageCount: count,
    tags,
    imageUrls: Array.from({ length: count }, (_, index) => {
      const ext = extensions[index] ?? fallback;
      return `${prefix}${index + 1}.${ext === 'w' ? 'webp' : ext === 'j' ? 'jpg' : ext}`;
    }),
    artist: tags.find((tag) => tag.type === '作者')?.name ?? /^\[([^\]]+)]/.exec(title)?.[1],
    uploadTime: [...doc.querySelectorAll('.comics-metadata-margin-top h5')]
      .map((node) => text(node) ?? '')
      .find((label) => label.startsWith('上傳'))
      ?.replace(/^上傳：?/, '')
      .trim(),
    description:
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined,
  };
}

export const feed = (path: string, page: number) =>
  queryOptions({
    queryKey: ['comics', 'feed', path, path ? page : 1],
    queryFn: async ({ queryKey }) => {
      if (path) return browse(path, page);
      const cached = await readComicHome();
      if (cached) queryClient.setQueryData(queryKey, cached);
      try {
        const feed = await home();
        await writeComicHome(feed);
        return feed;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    },
  });
export const detailQuery = (id: string) =>
  queryOptions({ queryKey: ['comics', 'detail', id], queryFn: () => detail(id) });
