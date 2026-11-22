export interface SearchQuery {
  text: string;
  genre: string;
  sort: string;
  date: string;
  duration: string;
  tags: string[];
  broad: boolean;
  type: string;
  page: number;
}

export function createSearchQuery(values: Partial<SearchQuery> = {}): SearchQuery {
  return {
    text: '',
    genre: '',
    sort: '',
    date: '',
    duration: '',
    tags: [],
    broad: false,
    type: '',
    page: 1,
    ...values,
  };
}

export function searchQueryFromUri(value?: string | null): SearchQuery {
  if (value == null) {
    return createSearchQuery();
  }
  // 基址仅用于解析相对路径，不发起网络请求。
  const uri = URL.parse(value, 'https://search.invalid');
  if (!uri) {
    return createSearchQuery();
  }
  const parameters = uri.searchParams;
  return createSearchQuery({
    text: parameters.get('query') ?? '',
    genre: parameters.get('genre') ?? '',
    sort: parameters.get('sort') ?? '',
    date: parameters.get('date') ?? '',
    duration: parameters.get('duration') ?? '',
    tags: parameters.getAll('tags[]'),
    broad: ['on', 'true', '1'].includes(parameters.get('broad') ?? ''),
    type: parameters.get('type') ?? '',
  });
}

export function searchQueryToUri(query: SearchQuery): string {
  const parameters = new URLSearchParams();
  const add = (key: string, value: string) => {
    if (value.length > 0) {
      parameters.set(key, value);
    }
  };

  add('query', query.text);
  add('genre', query.genre);
  add('sort', query.sort);
  add('date', query.date);
  add('duration', query.duration);
  add('type', query.type);
  for (const tag of query.tags) {
    parameters.append('tags[]', tag);
  }
  if (query.broad) {
    parameters.set('broad', 'on');
  }
  // 搜索 URL 编码 * 并保留 ~，保持站点查询格式。
  return `/search?${parameters.toString().replace(/\*/g, '%2A').replace(/%7E/g, '~')}`;
}

// 页码仅用于运行时分页，不存入搜索记录，也不参与条件比较。
export function searchQueryToJson({ page, ...query }: SearchQuery): Omit<SearchQuery, 'page'> {
  return query;
}

export function searchQueryFromJson(query: Partial<Omit<SearchQuery, 'page'>>): SearchQuery {
  return createSearchQuery({
    text: query.text ?? '',
    genre: query.genre ?? '',
    sort: query.sort ?? '',
    date: query.date ?? '',
    duration: query.duration ?? '',
    tags: (query.tags ?? []).filter((tag) => typeof tag === 'string'),
    broad: query.broad === true,
    type: query.type ?? '',
  });
}

export function hasSearchCriteria(query: SearchQuery): boolean {
  return Boolean(
    query.text ||
    query.genre ||
    query.sort ||
    query.date ||
    query.duration ||
    query.tags.length ||
    query.type,
  );
}

export function searchQueriesEqual(left: SearchQuery, right: SearchQuery): boolean {
  return (
    left.text === right.text &&
    left.genre === right.genre &&
    left.sort === right.sort &&
    left.date === right.date &&
    left.duration === right.duration &&
    left.broad === right.broad &&
    left.type === right.type &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index])
  );
}
