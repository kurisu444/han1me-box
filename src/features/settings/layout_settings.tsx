import { useMemo, useState } from 'react';
import { useI18n } from '../../app/i18n';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { homeBaseUrl, resolvedLibraryTabOrder } from '../../core/settings';
import { home } from '../../data/han1me_repository';
import { localize, searchLocale, searchOptionCatalog } from '../../data/search_option_catalog';
import { useAccount } from '../account/account_controller';
import { homeSectionKey } from '../explore/explore_page';
import { useQuery } from '@tanstack/react-query';
import { LoadingState, RequestError } from '../shared/request_error';

export const libraryTabLabels: Record<string, string> = {
  'watch-later': '稍后再看',
  favorites: '收藏',
  playlists: '片单',
  subscriptions: '订阅',
  history: '历史',
};
function HomeLayout({ onClose }: { onClose: () => void }) {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const { account, ready } = useAccount();
  const base = useMemo(() => homeBaseUrl(settings), [settings]);
  const resource = useQuery({ ...home(base, account?.id, true), enabled: ready !== false });
  const [order, setOrder] = useState(settings.homeSectionOrder);
  const [hidden, setHidden] = useState(settings.hiddenHomeSections);

  const locale = searchLocale(settings.language, navigator.language);
  const sections = [...(resource.data?.sections ?? [])].sort((a, b) => {
    const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
    return rank(homeSectionKey(a)) - rank(homeSectionKey(b));
  });

  function move(index: number, direction: number) {
    const next = sections.map(homeSectionKey);
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setOrder(next);
  }

  function toggle(key: string) {
    setHidden((values) =>
      values.includes(key) ? values.filter((value) => value !== key) : [...values, key],
    );
  }

  async function reset() {
    await save({ homeSectionOrder: [], hiddenHomeSections: [] });
    onClose();
  }

  async function apply() {
    await save({
      homeSectionOrder: order,
      hiddenHomeSections: hidden,
    });
    onClose();
  }

  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{tr('首页分区排序与显示')}</DialogTitle>
      <DialogContent>
        {resource.isPending && <LoadingState label={tr('正在读取分区…')} />}
        {resource.error && <RequestError error={resource.error} onRetry={resource.refetch} />}
        <List>
          {sections.map((section, index) => (
            <ListItem key={homeSectionKey(section)}>
              <Checkbox
                checked={!hidden.includes(homeSectionKey(section))}
                onChange={() => toggle(homeSectionKey(section))}
              />
              <ListItemText
                primary={
                  localize(searchOptionCatalog.genres, section.title, locale) ??
                  localize(searchOptionCatalog.sorts, section.title, locale) ??
                  section.title
                }
              />
              <Button disabled={index === 0} onClick={() => move(index, -1)}>
                {tr('上移')}
              </Button>
              <Button disabled={index === sections.length - 1} onClick={() => move(index, 1)}>
                {tr('下移')}
              </Button>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={reset}>{tr('恢复默认')}</Button>
        <Button onClick={onClose}>{tr('取消')}</Button>
        <Button onClick={apply}>{tr('保存')}</Button>
      </DialogActions>
    </Dialog>
  );
}
export function LayoutSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const [open, setOpen] = useState<'home' | 'library'>();
  const [order, setOrder] = useState(resolvedLibraryTabOrder(settings));

  async function resetLibrary() {
    await save({ libraryTabOrder: [] });
    setOpen(undefined);
  }

  function openLibrary() {
    setOrder(resolvedLibraryTabOrder(settings));
    setOpen('library');
  }

  function move(index: number, direction: number) {
    const next = [...order];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setOrder(next);
  }

  async function apply() {
    await save({
      libraryTabOrder: order,
    });
    setOpen(undefined);
  }

  return (
    <Stack>
      <Button onClick={() => setOpen('home')}>{tr('首页分区排序与隐藏')}</Button>
      <Button onClick={openLibrary}>{tr('媒体库标签排序')}</Button>
      {open === 'home' && <HomeLayout onClose={() => setOpen(undefined)} />}
      <Dialog open={open === 'library'} onClose={() => setOpen(undefined)} fullWidth>
        <DialogTitle>{tr('媒体库标签排序')}</DialogTitle>
        <DialogContent>
          <List>
            {order.map((key, index) => (
              <ListItem key={key}>
                <ListItemText primary={tr(libraryTabLabels[key])} />
                <Button disabled={index === 0} onClick={() => move(index, -1)}>
                  {tr('上移')}
                </Button>
                <Button disabled={index === order.length - 1} onClick={() => move(index, 1)}>
                  {tr('下移')}
                </Button>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetLibrary}>{tr('恢复默认')}</Button>
          <Button onClick={() => setOpen(undefined)}>{tr('取消')}</Button>
          <Button onClick={apply}>{tr('保存')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
