import { siteEndpointUrl, siteHomeUrl } from '../../core/site_url';
import type { Account } from '../../domain/models/account';
import {
  createPlaylist as playlistModel,
  type FollowingVideo,
  type Playlist,
  type PlaylistDetail,
  type SubscribedArtist,
} from '../../domain/models/library';
import type { Comment } from '../../domain/models/video';
import {
  CloudflareChallengeException,
  checkResponse,
  documentWithBody,
  absolute,
  text,
  statText,
  uploadTime,
  queryValue,
  isCloudflareResponse,
  resolvedOrigin as originFor,
  rememberOrigin,
} from './han1me_api';
import * as http from './han1me_http_client';
async function document(url: string) {
  const result = await documentWithBody(url);
  return result.document;
}
const latestCsrfTokens = new Map<string, string>();

const tokenFrom = (page: Document) =>
  page.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ??
  page.querySelector('input[name="_token"]')?.getAttribute('value') ??
  undefined;
async function csrfToken(baseUrl: string, fresh = false) {
  const url = new URL(siteHomeUrl(baseUrl));
  if (fresh) {
    url.searchParams.set('_', String(Date.now()));
  }
  const response = await http.get(url.href, { Referer: siteHomeUrl(baseUrl) });
  if (isCloudflareResponse(response)) {
    throw new CloudflareChallengeException(baseUrl);
  }
  if (response.statusCode >= 400) {
    return undefined;
  }
  rememberOrigin(url.href, response.url);
  const parsed =
    tokenFrom(new DOMParser().parseFromString(response.body, 'text/html'))?.trim() || undefined;
  if (parsed) {
    latestCsrfTokens.set(new URL(response.url).origin, parsed);
  }
  return parsed;
}
async function form(url: string, data: Record<string, string>, token: string) {
  let origin = originFor(url);
  let currentToken = latestCsrfTokens.get(origin) || token || (await csrfToken(origin)) || '';
  async function submit() {
    origin = originFor(origin);
    const target = new URL(url);
    const destination = new URL(origin);
    target.protocol = destination.protocol;
    target.host = destination.host;
    return http.request(
      target.href,
      'POST',
      { ...data, _token: currentToken },
      {
        'X-CSRF-TOKEN': currentToken,
        Referer: `${origin}/`,
        Origin: origin,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    );
  }
  let response = await submit();
  if (response.statusCode === 419) {
    currentToken = (await csrfToken(origin, true)) ?? token;
    response = await submit();
  }
  checkResponse(response, url);
  if (new URL(response.url).pathname === '/login') {
    throw new Error('Authentication expired');
  }
}
export async function account(base: string): Promise<Account> {
  const home = await document(siteHomeUrl(base));
  const id =
    /\/user\/(\d+)/.exec(
      home.querySelector('#user-modal-trigger')?.getAttribute('href') ?? '',
    )?.[1] ?? /\d+/.exec(text(home.querySelector('.profile-sub-stats-id')) ?? '')?.[0];
  if (!id) {
    throw new Error('Account profile is unavailable');
  }
  const edit = await document(siteEndpointUrl(base, `user/${id}/edit`));
  const numbers =
    (text(home.querySelector('.profile-sub-stats-new-line')) ?? '').match(/\d+/g)?.map(Number) ??
    [];
  const avatar =
    edit.querySelector('img#playlist-avatar') ??
    home.querySelector('#user-modal-dp-wrapper img, .profile-avatar-wrapper img');
  return {
    cookie: await window.electron.session.cookies(base),
    id,
    name:
      edit.querySelector('input[name="name"]')?.getAttribute('value')?.trim() ??
      text(home.querySelector('#user-modal-name, .profile-display-name')),
    email: edit.querySelector('input[name="email"]')?.getAttribute('value')?.trim(),
    avatarUrl: absolute(base, avatar?.getAttribute('src')),
    csrfToken: tokenFrom(edit),
    joinedLabel: text(home.querySelector('#user-modal-created')),
    subscriberCount: numbers[0],
    videoCount: numbers[1],
  };
}
export const updateProfile = (
  base: string,
  id: string,
  token: string,
  name: string,
  email: string,
) =>
  form(
    siteEndpointUrl(base, `user/${id}`),
    { _method: 'patch', type: 'profile', name, email },
    token,
  );
export const updatePassword = (
  base: string,
  id: string,
  token: string,
  old: string,
  password: string,
  confirmation: string,
) =>
  form(
    siteEndpointUrl(base, `user/${id}`),
    {
      _method: 'patch',
      type: 'password',
      password_old: old,
      password_new: password,
      password_new_confirm: confirmation,
    },
    token,
  );
export const setFavorite = (
  base: string,
  token: string,
  userId: string,
  videoId: string,
  enabled: boolean,
) =>
  form(
    siteEndpointUrl(base, 'like'),
    {
      'like-foreign-id': videoId,
      'like-status': enabled ? '' : '1',
      'like-user-id': userId,
      'like-is-positive': '1',
    },
    token,
  );
export const saveToPlaylist = (
  base: string,
  token: string,
  listId: string,
  videoId: string,
  checked: boolean,
) =>
  form(
    siteEndpointUrl(base, 'save'),
    { input_id: listId, video_id: videoId, is_checked: String(checked), user_id: '' },
    token,
  );
export const setSubscription = (
  base: string,
  token: string,
  userId: string,
  artistId: string,
  enabled: boolean,
) =>
  form(
    siteEndpointUrl(base, 'subscribe'),
    {
      'subscribe-user-id': userId,
      'subscribe-artist-id': artistId,
      'subscribe-status': enabled ? '' : '1',
    },
    token,
  );
export const createPlaylist = (
  base: string,
  token: string,
  videoId: string,
  title: string,
  description: string,
) =>
  form(
    siteEndpointUrl(base, 'createPlaylist'),
    {
      'create-playlist-video-id': videoId,
      'playlist-title': title,
      'playlist-description': description,
    },
    token,
  );
export const updatePlaylist = (
  base: string,
  token: string,
  id: string,
  title: string,
  description: string,
  remove = false,
) =>
  form(
    siteEndpointUrl(base, `playlist/${id}`),
    {
      _method: 'PUT',
      'playlist-title': title,
      'playlist-description': description,
      ...(remove ? { 'playlist-delete': 'on' } : {}),
    },
    token,
  );
export const deletePlaylist = (base: string, token: string, id: string) =>
  updatePlaylist(base, token, id, '', '', true);
export async function removePlaylistItem(base: string, token: string, id: string) {
  const origin = originFor(base);
  let currentToken = latestCsrfTokens.get(origin) || token || (await csrfToken(origin)) || '';
  const submit = () =>
    http.request(
      `${origin}/playlist/items/${id}`,
      'DELETE',
      {},
      { 'X-CSRF-TOKEN': currentToken, Accept: 'application/json', Referer: `${origin}/` },
      true,
    );
  let response = await submit();
  if (response.statusCode === 419) {
    currentToken = (await csrfToken(origin, true)) ?? currentToken;
    response = await submit();
  }
  checkResponse(response, base);
  if (JSON.parse(response.body)?.success !== true) {
    throw new Error('Playlist item removal failed');
  }
}
export async function deleteHistory(base: string, token: string, id: string) {
  const origin = originFor(base);
  let currentToken = latestCsrfTokens.get(origin) || token || (await csrfToken(origin)) || '';
  const submit = () =>
    http.request(
      `${origin}/user/tab-item/${id}`,
      'DELETE',
      { tab: 'histories' },
      { 'X-CSRF-TOKEN': currentToken, Referer: `${origin}/` },
    );
  let response = await submit();
  if (response.statusCode === 419) {
    currentToken = (await csrfToken(origin, true)) ?? currentToken;
    response = await submit();
  }
  checkResponse(response, base);
  const body = JSON.parse(response.body);
  if (body && typeof body === 'object' && body.success !== true) {
    throw new Error('History deletion failed');
  }
}
export const postComment = (
  base: string,
  token: string,
  userId: string,
  type: string,
  targetId: string,
  content: string,
) =>
  form(
    siteEndpointUrl(base, 'createComment'),
    {
      'comment-user-id': userId,
      'comment-type': type,
      'comment-foreign-id': targetId,
      'comment-text': content,
      'comment-count': '1',
      'comment-is-political': '0',
    },
    token,
  );
export const replyComment = (base: string, token: string, id: string, content: string) =>
  form(
    siteEndpointUrl(base, 'replyComment'),
    { 'reply-comment-id': id, 'reply-comment-text': content },
    token,
  );
export const voteComment = (base: string, token: string, comment: Comment, positive: boolean) =>
  form(
    siteEndpointUrl(base, 'commentLike'),
    {
      foreign_type: comment.id ? 'comment' : 'reply',
      foreign_id: comment.foreignId ?? '',
      is_positive: positive ? '1' : '0',
      'comment-like-user-id': comment.likeUserId ?? '',
      'comment-likes-count': String(comment.likesCount ?? 0),
      'comment-likes-sum': String(comment.likesSum ?? 0),
      'like-comment-status': comment.liked ? '1' : '0',
      'unlike-comment-status': comment.disliked ? '1' : '0',
    },
    token,
  );
export const reportComment = (
  base: string,
  token: string,
  id: string,
  comment: Comment,
  reason: string,
) =>
  form(
    siteEndpointUrl(base, `user/${id}/report`),
    {
      'redirect-url': '',
      'reportable-id': comment.reportableId ?? comment.foreignId ?? '',
      'reportable-type': comment.reportableType ?? (comment.id ? 'comment' : 'reply'),
      reason,
    },
    token,
  );

export function parseLibraryVideos(
  base: string,
  page: Document,
  kind: 'library' | 'playlist' | 'subscription' = 'library',
): FollowingVideo[] {
  const selector =
    kind === 'playlist'
      ? '.playlist-video-list > div.user-tab-item-wrapper'
      : kind === 'subscription'
        ? '.content-padding-new div[class^="video-item-container"]'
        : 'div[class^="user-tab-item-wrapper"]';
  return Array.from(page.querySelectorAll(selector), (card) => {
    const link =
      kind === 'library'
        ? card.querySelector('a')?.getAttribute('href')
        : kind === 'subscription'
          ? card.querySelector('a[class^="video-link"]')?.getAttribute('href')
          : (card.querySelector('a[href*="watch"]')?.getAttribute('href') ??
            card.querySelector('[data-href]')?.getAttribute('data-href'));
    const image = card.querySelector(
      kind === 'playlist'
        ? 'img.main-thumb'
        : kind === 'subscription'
          ? 'img[class^="main-thumb"]'
          : 'img',
    );
    return {
      videoCode: queryValue(link ?? '', 'v') ?? '',
      title:
        kind === 'subscription'
          ? (card.getAttribute('title')?.trim() ?? '')
          : kind === 'playlist'
            ? (text(card.querySelector('.video-title')) ?? '')
            : (text(card.querySelector('.title, .video-title')) ??
              image?.getAttribute('alt')?.trim() ??
              ''),
      coverUrl: absolute(base, image?.getAttribute('src')),
      artistName: text(
        card.querySelector(
          kind === 'playlist'
            ? '.meta-author a'
            : kind === 'subscription'
              ? '.subtitle a'
              : '.subtitle a, .meta-author a',
        ),
      ),
      duration: text(card.querySelector('.duration')),
      views: statText(card.querySelectorAll('.stats-container .stat-item')[1]),
      rating: statText(card.querySelector('.stats-container .stat-item')),
      uploadTime: uploadTime(card),
      addedAt: 0,
      playlistItemId: kind === 'playlist' ? /playlist-item-(\d+)/.exec(card.id)?.[1] : undefined,
    };
  }).filter((item) => item.videoCode && item.title);
}
export function parsePlaylists(base: string, page: Document): Playlist[] {
  return Array.from(
    page.querySelectorAll('.user-tab-item-wrapper, .playlist-item-wrapper, .playlist-card'),
    (element) =>
      playlistModel({
        id:
          queryValue(
            element
              .querySelector('a.video-link, a[href*="playlist?list="]')
              ?.getAttribute('href') ?? '',
            'list',
          ) ?? '',
        title: text(element.querySelector('.title, .playlist-title')) ?? '',
        count: Number(
          /\d+/.exec(text(element.querySelector('.stat-item, .playlist-count')) ?? '')?.[0] ?? 0,
        ),
        coverUrl: absolute(base, element.querySelector('img.main-thumb, img')?.getAttribute('src')),
      }),
  ).filter((item) => item.id && item.title);
}
function pageCount(page: Document) {
  return Math.max(
    1,
    ...Array.from(page.querySelectorAll('ul.pagination a.page-link[href]'), (link) =>
      /^\d+$/.test(queryValue(link.getAttribute('href') ?? '', 'page') ?? '')
        ? Number(queryValue(link.getAttribute('href') ?? '', 'page'))
        : 1,
    ),
  );
}
async function paged<T>(
  url: (number: number) => string,
  first: Document,
  parse: (page: Document) => T[],
  id: (item: T) => string,
) {
  const items = parse(first);
  const seen = new Set(items.map(id));
  for (let number = 2; number <= Math.min(20, pageCount(first)); number++) {
    try {
      const fresh = parse(await document(url(number))).filter((item) => {
        const key = id(item);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      if (!fresh.length) {
        break;
      }
      items.push(...fresh);
    } catch (error) {
      if (error instanceof CloudflareChallengeException) {
        throw error;
      }
      break;
    }
  }
  return items;
}
export interface LibraryVideoPage {
  items: FollowingVideo[];
  page: number;
  totalPages: number;
  csrfToken?: string;
}

export interface LibraryPlaylistPage {
  items: Playlist[];
  page: number;
  totalPages: number;
  csrfToken?: string;
}

export interface LibrarySubscriptionPage {
  items: FollowingVideo[];
  artists: SubscribedArtist[];
  page: number;
  totalPages: number;
  csrfToken?: string;
}

function parseSubscriptionArtists(base: string, page: Document): SubscribedArtist[] {
  return Array.from(
    page.querySelectorAll('.subscriptions-nav .subscriptions-artist-card'),
    (card) => {
      const name = text(card.querySelector('.card-mobile-title')) ?? '';
      const images = card.querySelectorAll('img');
      return {
        id: name,
        name,
        avatarUrl: absolute(base, (images[1] ?? images[0])?.getAttribute('src')),
        addedAt: 0,
      };
    },
  ).filter((artist) => artist.name);
}

export async function watchLaterPage(
  base: string,
  userId: string,
  page = 1,
): Promise<LibraryVideoPage> {
  const doc = await document(siteEndpointUrl(base, `user/${userId}/saves?page=${page}`));
  return {
    items: parseLibraryVideos(base, doc),
    page,
    totalPages: pageCount(doc),
    csrfToken: tokenFrom(doc),
  };
}

export async function favoritesPage(
  base: string,
  userId: string,
  page = 1,
): Promise<LibraryVideoPage> {
  const doc = await document(siteEndpointUrl(base, `user/${userId}/likes?page=${page}`));
  return {
    items: parseLibraryVideos(base, doc),
    page,
    totalPages: pageCount(doc),
    csrfToken: tokenFrom(doc),
  };
}

export async function historyPage(
  base: string,
  userId: string,
  page = 1,
): Promise<LibraryVideoPage> {
  const doc = await document(
    siteEndpointUrl(base, `user/${userId}/histories?sort=latest&page=${page}`),
  );
  return {
    items: parseLibraryVideos(base, doc),
    page,
    totalPages: pageCount(doc),
    csrfToken: tokenFrom(doc),
  };
}

export async function playlistsPage(
  base: string,
  userId: string,
  page = 1,
): Promise<LibraryPlaylistPage> {
  const doc = await document(siteEndpointUrl(base, `user/${userId}/playlists?page=${page}`));
  return {
    items: parsePlaylists(base, doc),
    page,
    totalPages: pageCount(doc),
    csrfToken: tokenFrom(doc),
  };
}

export async function subscriptionsPage(base: string, page = 1): Promise<LibrarySubscriptionPage> {
  const doc = await document(siteEndpointUrl(base, `subscriptions?page=${page}`));
  return {
    items: parseLibraryVideos(base, doc, 'subscription'),
    artists: parseSubscriptionArtists(base, doc),
    page,
    totalPages: pageCount(doc),
    csrfToken: tokenFrom(doc),
  };
}

export async function playlist(base: string, id: string, sort: string): Promise<PlaylistDetail> {
  const url = (number: number) =>
    siteEndpointUrl(
      base,
      `playlist?list=${encodeURIComponent(id)}&sort=${encodeURIComponent(sort)}&page=${number}`,
    );
  const page = await document(url(1));
  return {
    playlist: playlistModel({
      id,
      title: text(page.querySelector('.playlist-title')) ?? '',
      count: Number(text(page.querySelector('#sidebar-video-count')) ?? 0),
      coverUrl: absolute(base, page.querySelector('.playlist-main-thumbnail')?.getAttribute('src')),
    }),
    author: text(page.querySelector('.playlist-author-info a')),
    description: text(page.querySelector('.playlist-description')),
    viewCount:
      Number(
        /(?:觀看次數|观看次数)\s*[:：]\s*(\d+)/.exec(
          text(page.querySelector('.playlist-stats')) ?? '',
        )?.[1],
      ) || undefined,
    videos: await paged(
      url,
      page,
      (doc) => parseLibraryVideos(base, doc, 'playlist'),
      (item) => item.playlistItemId ?? item.videoCode,
    ),
  };
}
