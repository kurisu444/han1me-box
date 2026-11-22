import { cardGridSx } from '../shared/video_card';
import { useMemo, useEffect, useRef, useState } from 'react';
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { useSettings } from '../../app/settings_context';
import { useI18n } from '../../app/i18n';
import { useConfirmation } from '../shared/use_confirmation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  Alert,
  Tabs,
  Tab,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as api from '../../data/remote/comic_api';
import * as store from '../../data/local/comic_store';
import type { ComicCard, ComicDetail } from '../../domain/models/comic';
import { useQuery } from '@tanstack/react-query';
import { LoadingState, RequestError } from '../shared/request_error';

function ComicGrid({ items }: { items: ComicCard[] }) {
  return (
    <Box sx={cardGridSx}>
      {items.map((item) => (
        <Card key={item.id}>
          <CardActionArea component={Link} to={`/comics/${item.id}`}>
            <CardMedia
              component="img"
              image={item.coverUrl}
              alt={item.title}
              sx={{
                aspectRatio: '3/4',
                objectFit: 'cover',
              }}
            />
            <CardContent>
              <Typography>{item.title}</Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
export function ComicsPage({
  initialTab = 'home',
  libraryOnly = false,
}: {
  initialTab?: string;
  libraryOnly?: boolean;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const { path, page } = useMemo(
    () => ({
      path: params.get('path') ?? '',
      page: Number(params.get('page')) || 1,
    }),
    [params],
  );
  const [tab, setTab] = useState(initialTab);
  const resource = useQuery({
    ...api.feed(path, page),
    enabled: tab === 'home',
  });
  const saved = useQuery({ queryKey: ['comic-library'], queryFn: store.loadLibrary });
  const [filter, setFilter] = useState('');

  const basePath = path.replace(/\/popular(?:-today|-week)?$/, '');
  const data = resource.data;

  function chooseFilter(value: string) {
    setParams({
      path: basePath + value,
    });
    setFilter('');
  }

  function changePage(_event: unknown, page: number) {
    setParams({
      path,
      page: String(page),
    });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('漫画')}</Typography>
      <Button component={Link} to="/comics/cache">
        {tr('缓存漫画')}
      </Button>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        {!libraryOnly && <Tab value="home" label={tr('发现')} />}
        <Tab value="watchLater" label={tr('稍后再看')} />
        <Tab value="favorites" label={tr('收藏')} />
      </Tabs>
      {!libraryOnly && (
        <Button
          onClick={() =>
            setParams({
              path: '/comics',
            })
          }
        >
          {tr('浏览全部漫画')}
        </Button>
      )}
      <Button onClick={() => tab === 'home' && resource.refetch()}>{tr('刷新')}</Button>
      {path && tab === 'home' && (
        <>
          <TextField
            label={tr('漫画搜索暂不可用')}
            slotProps={{
              input: {
                readOnly: true,
              },
            }}
          />
          <Stack direction="row" spacing={1}>
            {[
              'sort',
              tr('社團'),
              tr('分類'),
              tr('語言'),
              tr('作者'),
              tr('標籤'),
              tr('角色'),
              tr('同人'),
            ].map((name) => (
              <Chip
                key={name}
                label={
                  name === 'sort'
                    ? tr('排序')
                    : name === params.get('type')
                      ? `${name}: ${params.get('label')}`
                      : name
                }
                onClick={() => setFilter(name)}
              />
            ))}
          </Stack>
          <Dialog open={!!filter} onClose={() => setFilter('')}>
            <DialogTitle>{filter === 'sort' ? tr('排序') : filter}</DialogTitle>
            <DialogContent>
              <List>
                {(filter === 'sort'
                  ? [
                      ['', tr('最新')],
                      ['/popular-today', tr('本日熱門')],
                      ['/popular-week', tr('本週熱門')],
                      ['/popular', tr('所有熱門')],
                    ]
                  : [['', tr('全部')]]
                ).map(([value, label]) => (
                  <ListItemButton key={value} onClick={() => chooseFilter(value)}>
                    <ListItemText primary={label} />
                  </ListItemButton>
                ))}
              </List>
            </DialogContent>
          </Dialog>
        </>
      )}
      {tab !== 'home' ? (
        <ComicGrid items={saved.data?.[tab as keyof store.ComicLibraryState] ?? []} />
      ) : resource.isPending ? (
        <LoadingState label={tr('正在加载漫画…')} />
      ) : resource.error ? (
        <RequestError error={resource.error} onRetry={resource.refetch} />
      ) : !data ? null : 'items' in data ? (
        <>
          <ComicGrid items={data.items} />
          <Pagination page={data.page} count={data.totalPages} onChange={changePage} />
        </>
      ) : (
        <>
          <Typography variant="h5">{tr('发烧')}</Typography>
          <ComicGrid items={data.trending} />
          <Typography variant="h5">{tr('最新')}</Typography>
          <ComicGrid items={data.latest} />
        </>
      )}
    </Stack>
  );
}
export function ComicDetailPage() {
  const tr = useI18n();
  const { id } = useParams();
  const resource = useQuery(api.detailQuery(id!));
  const saved = useQuery({ queryKey: ['comic-library'], queryFn: store.loadLibrary });
  const [reading, setReading] = useState(false);
  const [expandedTags, setExpandedTags] = useState(false);
  const [cacheNotice, setCacheNotice] = useState('');
  const confirmation = useConfirmation();
  const [categories, setCategories] = useState<string[]>([]);

  async function chooseCategory() {
    if (!(await confirmation.confirm(tr('缓存此漫画的全部图片？')))) {
      return;
    }
    setCategories(await window.electron.comics.categories());
  }

  async function cacheComic(category: string) {
    setCategories([]);
    setCacheNotice(tr('正在缓存…'));
    try {
      await window.electron.comics.cache(resource.data!, category);
      setCacheNotice(tr('已缓存'));
    } catch (error) {
      setCacheNotice(String(error));
    }
  }

  async function toggle(key: keyof store.ComicLibraryState) {
    const comic = resource.data!;
    await store.setComic(
      {
        id: comic.id,
        title: comic.title,
        coverUrl: comic.coverUrl,
      },
      true,
      key,
    );
    saved.refetch();
  }

  const comic = resource.data!;

  if (resource.isPending) {
    return <LoadingState label={tr('正在加载漫画…')} />;
  }
  if (resource.error) {
    return <RequestError error={resource.error} onRetry={resource.refetch} />;
  }

  if (reading) {
    return <ComicReader comic={comic} onClose={() => setReading(false)} />;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{comic.title}</Typography>
      <Button onClick={chooseCategory}>{tr('下载漫画')}</Button>
      {cacheNotice && <Alert severity="info">{cacheNotice}</Alert>}
      {confirmation.dialog}
      <Dialog open={categories.length > 0} onClose={() => setCategories([])}>
        <DialogTitle>{tr('缓存分类')}</DialogTitle>
        <DialogContent>
          {categories.map((category) => (
            <Button key={category} onClick={() => cacheComic(category)}>
              {category}
            </Button>
          ))}
        </DialogContent>
      </Dialog>
      <Box
        component="img"
        src={comic.coverUrl}
        alt={comic.title}
        sx={{
          maxWidth: 400,
        }}
      />
      <Typography>
        {comic.artist} · {comic.pageCount}
        {tr('页 ·')}
        {comic.uploadTime}
      </Typography>
      <Typography>{comic.description}</Typography>
      <Button onClick={() => navigator.clipboard.writeText(comic.title)}>{tr('复制标题')}</Button>
      <Button onClick={() => navigator.clipboard.writeText(comic.description ?? '')}>
        {tr('复制简介')}
      </Button>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => setReading(true)}>
          {tr('开始阅读')}
        </Button>
        <Button onClick={() => toggle('watchLater')}>{tr('稍后再看')}</Button>
        <Button onClick={() => toggle('favorites')}>{tr('收藏')}</Button>
      </Stack>
      <Stack
        direction="row"
        sx={{
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {comic.tags.slice(0, expandedTags ? undefined : 12).map((tag) => (
          <Chip
            key={tag.path}
            component={Link}
            to={`/comics?${new URLSearchParams({
              path: tag.path,
              type: tag.type,
              label: tag.name,
            })}`}
            label={`${tag.type}：${tag.name}`}
            clickable
          />
        ))}
      </Stack>
      {comic.tags.length > 12 && (
        <Button onClick={() => setExpandedTags(!expandedTags)}>
          {tr(expandedTags ? '收起' : '展开')}
        </Button>
      )}
    </Stack>
  );
}
export function ComicReader({ comic, onClose }: { comic: ComicDetail; onClose: () => void }) {
  const tr = useI18n();
  const [state, setState] = useState<store.ComicReaderState>();
  const [page, setPage] = useState(0);
  const transform = useRef<ReactZoomPanPinchRef | null>(null);
  const [controls, setControls] = useState(true);
  const pointer = useRef<
    | {
        x: number;
        y: number;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    let active = true;
    void store.loadReader().then((value) => {
      if (active) {
        setState(value);
        setPage(Math.max(0, Math.min(comic.pageCount - 1, value.progress[comic.id] ?? 0)));
      }
    });
    return () => {
      active = false;
    };
  }, [comic.id, comic.pageCount]);
  useEffect(() => {
    for (const index of [page - 1, page + 1, page + 2]) {
      if (index >= 0 && index < comic.imageUrls.length) {
        const image = new Image();
        image.src = comic.imageUrls[index];
      }
    }
  }, [comic.imageUrls, page]);

  async function changePage(next: number) {
    const value = Math.max(0, Math.min(comic.pageCount - 1, next));
    setPage(value);
    const updated = {
      ...state!,
      progress: {
        ...state!.progress,
        [comic.id]: value,
      },
    };
    setState(updated);
    await store.saveReader(updated);
  }

  async function changeSettings(changes: Partial<store.ComicReaderState>) {
    const next = {
      ...state!,
      ...changes,
    };
    setState(next);
    await store.saveReader(next);
  }

  function start(event: React.PointerEvent) {
    if (!event.isPrimary) {
      pointer.current = undefined;
      return;
    }
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function end(event: React.PointerEvent) {
    const start = pointer.current;
    pointer.current = undefined;
    if (!start) {
      return;
    }
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) < 12 && Math.abs(y) < 12) {
      setControls((value) => !value);
      return;
    }
    if (state!.mode >= 4 || (transform.current?.state.scale ?? 1) !== 1) {
      return;
    }
    if (state!.mode === 3 && Math.abs(y) > Math.abs(x) && Math.abs(y) > 48) {
      void changePage(page + (y < 0 ? 1 : -1));
    } else if (state!.mode !== 3 && Math.abs(x) > Math.abs(y) && Math.abs(x) > 48) {
      void changePage(page + ((state!.mode === 1 ? x < 0 : x > 0) ? 1 : -1));
    }
  }

  function selectImage(value: ReactZoomPanPinchRef) {
    transform.current = value;
  }

  function cancelPageGesture() {
    pointer.current = undefined;
  }

  function startPinch(value: ReactZoomPanPinchRef) {
    selectImage(value);
    cancelPageGesture();
  }

  function transformed(value: ReactZoomPanPinchRef) {
    if (value.state.scale !== 1) {
      cancelPageGesture();
    }
  }

  if (!state) {
    return <LoadingState label={tr('正在读取进度…')} />;
  }

  return (
    <Box
      sx={{
        bgcolor: state.background,
        p: 2,
        minHeight: '80vh',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          display: controls ? 'flex' : 'none',
          bgcolor: 'background.paper',
          p: 1,
          position: 'sticky',
          top: 72,
          zIndex: 1,
          flexWrap: 'wrap',
        }}
      >
        <Button onClick={onClose}>{tr('返回详情')}</Button>
        <Button disabled={page === 0 || state.mode >= 4} onClick={() => changePage(page - 1)}>
          {tr('上一页')}
        </Button>
        <Typography>
          {page + 1}/{comic.pageCount}
        </Typography>
        <Button
          disabled={page === comic.pageCount - 1 || state.mode >= 4}
          onClick={() => changePage(page + 1)}
        >
          {tr('下一页')}
        </Button>
        <TextField
          size="small"
          type="number"
          label={tr('跳页')}
          value={page + 1}
          onChange={(event) => changePage(Number(event.target.value) - 1)}
          sx={{
            width: 90,
          }}
        />
        <TextField
          select
          size="small"
          label={tr('模式')}
          value={state.mode}
          onChange={(event) =>
            changeSettings({
              mode: Number(event.target.value),
            })
          }
        >
          {[
            tr('默认'),
            tr('从左到右'),
            tr('从右到左'),
            tr('从上到下'),
            tr('长图'),
            tr('长图留白'),
          ].map((label, index) => (
            <MenuItem key={label} value={index}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={tr('背景')}
          value={state.background}
          onChange={(event) =>
            changeSettings({
              background: event.target.value,
            })
          }
        >
          {['black', 'gray', 'white'].map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={() => transform.current?.zoomIn(0.25)}>{tr('放大')}</Button>
        <Button onClick={() => transform.current?.zoomOut(0.25)}>{tr('缩小')}</Button>
      </Stack>
      <Stack
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={cancelPageGesture}
        sx={{
          alignItems: 'center',
          gap: state.mode === 5 ? 1 : 0,
          overflow: 'auto',
        }}
      >
        {(state.mode >= 4 ? comic.imageUrls : [comic.imageUrls[page]]).map((url, index) => (
          <TransformWrapper
            key={`${state.mode}:${url}`}
            maxScale={state.mode >= 4 ? 2.5 : 5}
            onInit={index === 0 ? selectImage : undefined}
            onPanningStart={selectImage}
            onZoomStart={selectImage}
            onPinchStart={startPinch}
            onTransform={transformed}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%' }}
              contentStyle={{ width: '100%', justifyContent: 'center' }}
            >
              <Box
                component="img"
                src={url}
                alt={`${comic.title} ${(state.mode >= 4 ? index : page) + 1}`}
                sx={{
                  width: '100%',
                  maxHeight: state.mode >= 4 ? undefined : '80vh',
                  objectFit: 'contain',
                }}
              />
            </TransformComponent>
          </TransformWrapper>
        ))}
      </Stack>
    </Box>
  );
}
