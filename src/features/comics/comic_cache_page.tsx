import { cardGridSx } from '../shared/video_card';
import { useI18n } from '../../app/i18n';
import { LoadingState } from '../shared/request_error';
import { useState } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { type ComicCacheEntry, type ComicDetail } from '../../domain/models/comic';
import { ComicReader } from './comic_pages';
import { localMediaUrl } from '../../domain/models/download';

const entries = () => window.electron.comics.entries();
const categories = () => window.electron.comics.categories();
export function ComicCachePage() {
  const tr = useI18n();
  const [error, setError] = useState('');
  const resource = useQuery({ queryKey: ['comic-cache'], queryFn: entries }),
    groups = useQuery({ queryKey: ['comic-categories'], queryFn: categories });
  const [category, setCategory] = useState(''),
    [name, setName] = useState('');
  const [reading, setReading] = useState<ComicDetail>();

  const allCategories = [
    ...new Set([
      '',
      ...(groups.data ?? ['默认']),
      ...(resource.data ?? []).map((entry) => entry.category),
    ]),
  ];
  const selectedCategory = allCategories.includes(category) ? category : '';
  const visible = (resource.data ?? []).filter(
    (entry) => !selectedCategory || entry.category === selectedCategory,
  );

  async function read(entry: ComicCacheEntry) {
    try {
      const images = await window.electron.comics.extract(entry);
      setReading({
        ...entry,
        imageUrls: images.map(localMediaUrl),
        tags: [],
      });
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function remove(entry: ComicCacheEntry) {
    await window.electron.comics.remove(entry);
    resource.refetch();
  }

  async function addCategory() {
    await window.electron.comics.addCategory(name);
    groups.refetch();
    setName('');
  }

  async function deleteCategory() {
    await window.electron.comics.deleteCategory(category);
    setCategory('');
    groups.refetch();
    resource.refetch();
  }

  if (reading) return <ComicReader comic={reading} onClose={() => setReading(undefined)} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{tr('漫画缓存')}</Typography>
      <TextField
        select
        label={tr('分类')}
        value={selectedCategory}
        onChange={(event) => setCategory(event.target.value)}
      >
        {allCategories.map((value) => (
          <MenuItem key={value} value={value}>
            {value === '' ? tr('全部') : value === '默认' ? tr('默认') : value}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction="row" spacing={1}>
        <TextField
          label={tr('新分类')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button onClick={addCategory}>{tr('添加')}</Button>
        <Button
          disabled={!selectedCategory || selectedCategory === '默认'}
          onClick={deleteCategory}
        >
          {tr('删除分类')}
        </Button>
      </Stack>
      <Box sx={cardGridSx}>
        {visible.map((entry) => (
          <Stack key={entry.id} spacing={1}>
            <Typography>{entry.title}</Typography>
            <Button onClick={() => read(entry)}>{tr('阅读')}</Button>
            <Button onClick={() => remove(entry)}>{tr('删除')}</Button>
          </Stack>
        ))}
      </Box>
      {resource.isPending && <LoadingState label={tr('正在加载缓存…')} />}
      {!resource.isPending && !visible.length && <Typography>{tr('暂无缓存')}</Typography>}
      {(error || resource.error) && (
        <Alert severity="error">{error || String(resource.error)}</Alert>
      )}
    </Stack>
  );
}
