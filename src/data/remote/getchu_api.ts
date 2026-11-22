import * as http from './han1me_http_client';
import type {
  GetchuPreviewDetail,
  GetchuPreviewFeed,
  GetchuPreviewGroup,
  GetchuPreviewItem,
  GetchuPreviewSection,
} from '../../domain/models/getchu_preview';
const base = 'https://www.getchu.com/';
const clean = (value: string) =>
  value
    .replaceAll('\u00a0', ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
const text = (element: Element | null) => element?.textContent ?? '';
const absolute = (value?: string | null) =>
  value?.trim() ? new URL(value.trim(), base).href : undefined;
const withGc = (url: string) =>
  !url.startsWith(base) || url.includes('gc=gc')
    ? url
    : `${url}${url.includes('?') ? '&' : '?'}gc=gc`;
const nullable = (value?: string) => value?.trim() || undefined;
const getId = (value?: string | null) => /(?:id=|\/item\/)(\d+)/.exec(value ?? '')?.[1];
const htmlText = (value: string) =>
  clean(
    new DOMParser().parseFromString(value.replace(/<br\s*\/?>/gi, '\n'), 'text/html').body
      .textContent ?? '',
  );
async function page(url: string) {
  await window.electron.session.importCookies(base, 'getchu_adalt_flag=getchu.com; gc=gc');
  const response = await http.get(url, { Referer: base }, 'euc-jp');
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Getchu request failed: HTTP ${response.statusCode}`);
  }
  return {
    document: new DOMParser().parseFromString(response.body, 'text/html'),
    body: response.body.replaceAll('\\/', '/'),
  };
}
function previewItem(product: Element): GetchuPreviewItem | undefined {
  const link = product.querySelector(
    'td.dd > a[href*="/soft.phtml"], td.dd > a[href*="/item/"], ' +
      'a[href*="/soft.phtml"], a[href*="/item/"]',
  );
  const id = getId(link?.getAttribute('href'));
  if (!link || !id) {
    return;
  }
  const titleBrand = clean(text(link));
  const image = product.querySelector('img[src*="package"]');
  const cover = absolute(image?.getAttribute('src')?.replace('package_s.', 'package.'));
  return {
    id,
    title:
      titleBrand.replace(/\s*\([^()]+\)\s*$/, '').trim() || clean(image?.getAttribute('alt') ?? ''),
    brand: nullable(/\(([^()]*)\)\s*$/.exec(titleBrand)?.[1]),
    coverUrl: cover ? withGc(cover) : undefined,
    detailUrl: `${base}item/${id}/`,
    price: nullable(clean(text(product.querySelector('span.redb')))),
  };
}
function relatedItem(element: Element): GetchuPreviewItem | undefined {
  const link = element.querySelector('a[href]');
  const id = getId(link?.getAttribute('href'));
  if (!id || !link) {
    return;
  }
  const image = element.querySelector('img');
  const cover = absolute(image?.getAttribute('src'));
  return {
    id,
    title: clean(image?.getAttribute('alt')?.replaceAll('パッケージ画像', '') ?? text(link)),
    brand: nullable(
      clean(
        element.querySelector('.table-003-brand')?.textContent?.replace(/^\(|\)$/g, '') ??
          text(element.querySelector('.table-003-releasedate')),
      ),
    ),
    coverUrl: cover ? withGc(cover) : undefined,
    detailUrl: `${base}item/${id}/`,
    price: nullable(
      clean(text(element.querySelector('span.redb, span.gr_soft_carousel_price_num'))),
    ),
  };
}
export async function previews(month: string): Promise<GetchuPreviewFeed> {
  const query = new URLSearchParams({
    genre: 'anime_dvd',
    gage: 'adult',
    year: month.slice(0, 4),
    month: month.slice(4, 6),
    gc: 'gc',
  });
  const { document } = await page(`${base}all/month_title.html?${query}`);
  const groups: GetchuPreviewGroup[] = [];
  for (const header of document.querySelectorAll('div.category_anime_t2')) {
    let body = header.parentElement?.nextElementSibling;
    while (body && !body.classList.contains('category_anime_b')) {
      body = body.nextElementSibling;
    }
    if (!body) {
      continue;
    }
    const items = [...body.querySelectorAll('div.div_product')]
      .map(previewItem)
      .filter((item): item is GetchuPreviewItem => !!item);
    const unique = [...new Map(items.map((item) => [item.id, item])).values()];
    if (unique.length) {
      groups.push({
        releaseDate: clean(text(header).replaceAll('発売タイトル', '')),
        items: unique,
      });
    }
  }
  return { month, groups };
}
async function seriesItems(parentId: string): Promise<GetchuPreviewItem[]> {
  try {
    const data: Record<string, string> = {};
    for (const key of [
      'product_id_array',
      'sub_genre_array',
      'NA_sub_genre_array',
      'sub_genre_perfect_matching',
      'brand_id_array',
      'age',
      'stock_flag',
      'image_exist',
      'start_date',
      'end_date',
      'novelty_flag',
      'paging',
      'page_size',
      'javascript_id',
      'search_word',
      'lower_limit',
      'upper_limit',
      'add_query',
    ]) {
      data[key] = '';
    }
    Object.assign(data, {
      parent_id_array: parentId,
      genre: 'anime_dvd',
      sort_condition: 'release_date',
      sort_order: 'asc',
      limit_count: '30',
      limit_count_lower: '1',
      template_html: 'item-series/item-series.html',
      limitless: '1',
      image_size: 's',
    });
    const response = await http.request(
      `${base}util/GetchuSearch/GetchuSearchAjax.php`,
      'POST',
      data,
      { Referer: base },
      false,
      'euc-jp',
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return [];
    }
    return [
      ...new DOMParser()
        .parseFromString(response.body, 'text/html')
        .querySelectorAll('div.item-series-content, div[class*="item-series"], li.product-item'),
    ]
      .map(relatedItem)
      .filter((item): item is GetchuPreviewItem => !!item);
  } catch {
    return [];
  }
}
export async function detail(id: string): Promise<GetchuPreviewDetail> {
  const { document, body } = await page(`${base}item/${id}/?gc=gc`);
  let product:
    | {
        name?: unknown;
        image?: unknown;
        brand?: { name?: unknown };
        offers?: { price?: unknown; url?: unknown };
        description?: unknown;
      }
    | undefined;
  const candidates = [...document.querySelectorAll('script[type*="ld+json"]')].map(text);
  candidates.push(
    ...[
      ...body.matchAll(/<script[^>]*type=["'][^"']*ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi),
    ].map((match) => match[1]),
  );
  for (const value of candidates) {
    try {
      const decoded = JSON.parse(value);
      const list = Array.isArray(decoded?.['@graph']) ? decoded['@graph'] : [decoded];
      product = list.find((item: Record<string, unknown>) => item?.['@type'] === 'Product');
      if (product) {
        break;
      }
    } catch {}
  }
  const specs = new Map<string, string>();
  for (const row of document.querySelectorAll('#soft_table tr')) {
    const cells = [...row.children].filter((cell) => ['TD', 'TH'].includes(cell.tagName));
    if (cells.length >= 2) {
      specs.set(clean(text(cells[0])).replace(/[：:\s]+/g, ''), clean(text(cells[1])));
    }
  }
  for (const key of ['ブランド', '定価', '発売日']) {
    const match = new RegExp(
      `<td[^>]*>\\s*${key}[:：]?\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
      'i',
    ).exec(body);
    if (match && !specs.has(key)) {
      specs.set(key, htmlText(match[1]));
    }
  }
  const specification = (key: string) => [...specs].find(([name]) => name.includes(key))?.[1];
  const sections: GetchuPreviewSection[] = [];
  for (const [className, title] of Object.entries({
    tabletitle_1: '商品紹介',
    tabletitle_2: 'ストーリー',
    tabletitle_3: 'スタッフ',
  })) {
    const values: string[] = [];
    for (const heading of document.querySelectorAll(`h3.${className}`)) {
      let next = heading.nextElementSibling;
      let found: Element | undefined;
      while (next && next.tagName !== 'H3') {
        if (next.classList.contains('tablebody')) {
          found = next;
          break;
        }
        next = next.nextElementSibling;
      }
      if (!found) {
        const siblings = [...(heading.parentElement?.children ?? [])];
        next = siblings[siblings.indexOf(heading) + 1];
        while (next && next.tagName !== 'H3') {
          if (next.classList.contains('tablebody')) {
            found = next;
            break;
          }
          next = next.nextElementSibling;
        }
      }
      if (found && !found.querySelector('video, source')) {
        values.push(clean(text(found)));
      }
    }
    const regex = new RegExp(
      `<h3[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?</h3>\\s*` +
        `<div[^>]*class=["'][^"']*tablebody[^"']*["'][^>]*>([\\s\\S]*?)</div>`,
      'gi',
    );
    for (const match of body.matchAll(regex)) {
      if (!/<(?:video|source)\b/i.test(match[1])) {
        values.push(htmlText(match[1]));
      }
    }
    const value = values.filter(Boolean).sort((a, b) => b.length - a.length)[0];
    if (value) {
      sections.push({ title, body: value });
    }
  }
  const images: string[] =
    typeof product?.image === 'string'
      ? [product.image]
      : Array.isArray(product?.image)
        ? product.image.filter((item: unknown) => typeof item === 'string')
        : [];
  const meta = (name: string) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      document
        .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
        ?.getAttribute('content') ??
      new RegExp(
        `<meta[^>]*(?:property|name)=["']${escaped}["'][^>]*` + `content=["']([^"']+)["']`,
        'i',
      ).exec(body)?.[1] ??
      new RegExp(
        `<meta[^>]*content=["']([^"']+)["'][^>]*` + `(?:property|name)=["']${escaped}["']`,
        'i',
      ).exec(body)?.[1]
    );
  };
  const cover = absolute(
    images[0] ??
      meta('og:image') ??
      meta('twitter:image:src') ??
      document.querySelector('#soft_table img[src*="package"]')?.getAttribute('src') ??
      new RegExp(`href=["']([^"']*?/brandnew/${id}/[^"']*?package\\.jpg)["']`, 'i').exec(body)?.[1],
  );
  const samples = [...document.querySelectorAll('div.item-Samplecard a[href]')].map((node) =>
    absolute(node.getAttribute('href')),
  );
  samples.push(
    ...[
      ...body.matchAll(new RegExp(`["']([^"']*?/brandnew/${id}/c${id}sample\\d+\\.jpg)["']`, 'gi')),
    ].map((match) => absolute(match[1])),
    ...images.slice(1).map(absolute),
  );
  const videos = new Set<string>();
  function addVideo(value?: string | null) {
    const url = absolute(value?.replaceAll('&amp;', '&'));
    if (url && /\.(mp4|m3u8)($|\?)/i.test(url)) {
      videos.add(url);
    }
  }
  for (const node of document.querySelectorAll('video[src], video source[src], source[src]')) {
    addVideo(node.getAttribute('src'));
  }
  for (const block of body.matchAll(/<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/?>/gi)) {
    for (const source of block[0].matchAll(/(?:src|data-src)\s*=\s*["']([^"']+)["']/gi)) {
      addVideo(source[1]);
    }
  }
  for (const match of body.matchAll(/(?:https?:)?\/\/[^"'<>\s\\]+?\.mp4(?:\?[^"'<>\s\\]*)?/gi)) {
    addVideo(match[0]);
  }
  const inline = [
    ...document.querySelectorAll(
      'div.item-series-content, div[class*="item-series"], ' +
        'section.related-products li.product-item',
    ),
  ]
    .map(relatedItem)
    .filter((item): item is GetchuPreviewItem => !!item);
  const parentId = /["']parent_id_array["']\s*:\s*["']([^"']+)["']/i.exec(body)?.[1];
  const series = parentId ? await seriesItems(parentId) : [];
  const description = sections
    .filter((section) => /商品紹介|ストーリー/.test(section.title))
    .map((section) => section.body)
    .join('\n\n');
  const offer = product?.offers;
  return {
    id,
    title: clean(
      typeof product?.name === 'string'
        ? product.name
        : (document.querySelector('#soft-title')?.textContent ??
            meta('og:title') ??
            text(document.querySelector('title')).split(' | ')[0]),
    ),
    brand: nullable(
      clean(
        (typeof product?.brand?.name === 'string' ? product.brand.name : undefined) ??
          document.querySelector('#brandsite')?.textContent ??
          specification('ブランド') ??
          '',
      ),
    ),
    coverUrl: cover ? withGc(cover) : undefined,
    description:
      nullable(description) ??
      nullable(
        clean(
          typeof product?.description === 'string'
            ? product.description
            : (meta('description') ?? ''),
        ),
      ),
    releaseDate:
      /["']?_crelease_date["']?\s*:\s*["']?(\d{4}-\d{2}-\d{2})/.exec(body)?.[1] ??
      nullable(text(document.querySelector('a[href*="start_date"]'))) ??
      specification('発売日') ??
      /start_date=(\d{4}(?:\/|%2F)\d{2}(?:\/|%2F)\d{2})/i.exec(body)?.[1].replace(/%2F/gi, '/'),
    price:
      offer?.price != null
        ? `¥${offer.price}`
        : nullable(
            clean(document.querySelector('span.redb2')?.textContent ?? specification('価格') ?? ''),
          ),
    productUrl:
      absolute(typeof offer?.url === 'string' ? offer.url : undefined) ??
      `${base}item/${id}/?gc=gc`,
    videoUrls: [...videos],
    sections,
    sampleImages: [...new Set(samples.filter((url): url is string => !!url))].map(withGc),
    seriesItems: [
      ...new Map(
        [...inline, ...series].filter((item) => item.id !== id).map((item) => [item.id, item]),
      ).values(),
    ],
  };
}
