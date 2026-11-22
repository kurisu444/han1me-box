import { QueryClient, queryOptions } from '@tanstack/react-query';
import type { SearchQuery } from '../domain/models/search_query';
import { readHomeCache, writeHomeCache } from './local/home_cache';
import * as accountApi from './remote/account_api';
import * as api from './remote/han1me_api';
import * as previewApi from './remote/preview_api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: 'always',
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
    },
  },
});

export const home = (baseUrl: string, accountId?: string, preferCache = false) =>
  queryOptions({
    queryKey: ['han1me', 'home', baseUrl, accountId],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async ({ queryKey }) => {
      const cached = await readHomeCache(baseUrl, accountId);
      if (cached) {
        if (preferCache) {
          return cached;
        }
        queryClient.setQueryData(queryKey, cached);
      }
      const feed = await api.home(baseUrl);
      await writeHomeCache(baseUrl, accountId, feed);
      return feed;
    },
  });

export const search = (baseUrl: string, query: SearchQuery) =>
  queryOptions({
    queryKey: ['han1me', 'search', baseUrl, query],
    queryFn: () => api.search(baseUrl, query),
  });

export const video = (baseUrl: string, id: string) =>
  queryOptions({
    queryKey: ['han1me', 'video', baseUrl, id],
    queryFn: () => api.video(baseUrl, id),
  });

export const comments = (baseUrl: string, id: string, type = 'video', accountId?: string) =>
  queryOptions({
    queryKey: ['han1me', 'comments', baseUrl, type, id, accountId],
    queryFn: () => api.comments(baseUrl, id, type),
    staleTime: 600000,
    gcTime: 600000,
  });

export const replies = (baseUrl: string, id: string) =>
  queryOptions({
    queryKey: ['han1me', 'replies', baseUrl, id],
    queryFn: () => api.replies(baseUrl, id),
  });

export function clearRequests() {
  queryClient.removeQueries({ queryKey: ['han1me'] });
}

export const account = (baseUrl: string) =>
  queryOptions({
    queryKey: ['han1me', 'account', baseUrl],
    queryFn: () => accountApi.account(baseUrl),
  });

export const previews = (baseUrl: string, month: string) =>
  queryOptions({
    queryKey: ['han1me', 'previews', baseUrl, month],
    queryFn: () => previewApi.previews(baseUrl, month),
  });

export const playlist = (baseUrl: string, id: string, sort: string) =>
  queryOptions({
    queryKey: ['han1me', 'playlist', baseUrl, id, sort],
    queryFn: () => accountApi.playlist(baseUrl, id, sort),
  });
