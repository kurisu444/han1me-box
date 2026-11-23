import { useState, type ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useI18n } from '../../app/i18n';
import { useSaveSettings, useSettings } from '../../app/settings_context';
import { resolvedLibraryTabOrder } from '../../core/settings';
import { searchLocale } from '../../data/search_option_catalog';
import { exploreChannelLabel, orderedExploreChannels } from '../explore/explore_channels';
import { SettingRow } from './setting_controls';

export const libraryTabLabels: Record<string, string> = {
  'watch-later': '稍后观看',
  favorites: '喜欢的影片',
  playlists: '播放清单',
  subscriptions: '我的订阅',
  history: '观看历史',
};

interface SortableItem {
  id: string;
  label: string;
  leading?: ReactNode;
}

function SortableRow({ id, label, leading }: SortableItem) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        position: 'relative',
        zIndex: isDragging ? 10 : 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.75,
        borderRadius: '10px',
        border: 1,
        borderColor: isDragging ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
        boxShadow: isDragging ? 4 : 0,
        userSelect: 'none',
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: isDragging ? 'primary.main' : 'text.disabled',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          '&:hover': { color: 'text.secondary' },
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      {leading}
      <Typography variant="body2" sx={{ fontWeight: isDragging ? 600 : 400, flexGrow: 1 }}>
        {label}
      </Typography>
    </Box>
  );
}

function SortableDialog({
  title,
  items,
  status,
  onReorder,
  onReset,
  onSave,
  onClose,
}: {
  title: string;
  items: SortableItem[];
  status?: ReactNode;
  onReorder: (keys: string[]) => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const tr = useI18n();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const keys = items.map((item) => item.id);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) {
      return;
    }
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from !== -1 && to !== -1) {
      onReorder(arrayMove(keys, from, to));
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          {tr('按住左侧手柄上下拖动调整顺序')}
        </Typography>
        {status}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={keys} strategy={verticalListSortingStrategy}>
            <Stack spacing={0.75}>
              {items.map((item) => (
                <SortableRow key={item.id} {...item} />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReset}>{tr('恢复默认')}</Button>
        <Button onClick={onClose}>{tr('取消')}</Button>
        <Button variant="contained" onClick={onSave}>
          {tr('保存')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HomeLayoutDialog({ onClose }: { onClose: () => void }) {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const [order, setOrder] = useState(settings.homeSectionOrder);
  const [hidden, setHidden] = useState(settings.hiddenHomeSections);

  const locale = searchLocale(settings.language, navigator.language);
  const channels = orderedExploreChannels(order);
  const visibleCount = channels.filter((channel) => !hidden.includes(channel.labelKey)).length;

  function toggle(key: string) {
    setHidden((values) => {
      if (values.includes(key)) {
        return values.filter((value) => value !== key);
      }
      return visibleCount > 1 ? [...values, key] : values;
    });
  }

  return (
    <SortableDialog
      title={tr('首页顶栏频道')}
      items={channels.map((channel) => {
        const key = channel.labelKey;
        const checked = !hidden.includes(key);
        return {
          id: key,
          label: exploreChannelLabel(channel, locale),
          leading: (
            <Checkbox
              size="small"
              checked={checked}
              disabled={checked && visibleCount <= 1}
              onChange={() => toggle(key)}
              sx={{ p: 0.25 }}
            />
          ),
        };
      })}
      onReorder={setOrder}
      onReset={async () => {
        await save({ homeSectionOrder: [], hiddenHomeSections: [] });
        onClose();
      }}
      onSave={async () => {
        await save({ homeSectionOrder: order, hiddenHomeSections: hidden });
        onClose();
      }}
      onClose={onClose}
    />
  );
}

export function LayoutSettings() {
  const tr = useI18n();
  const settings = useSettings();
  const save = useSaveSettings();
  const [open, setOpen] = useState<'home' | 'library'>();
  const [order, setOrder] = useState(resolvedLibraryTabOrder(settings));

  return (
    <Stack spacing={1.25}>
      <SettingRow
        title={tr('首页顶栏频道')}
        control={<ChevronRightIcon color="action" />}
        onClick={() => setOpen('home')}
      />
      <SettingRow
        title={tr('我的标签排序')}
        control={<ChevronRightIcon color="action" />}
        onClick={() => {
          setOrder(resolvedLibraryTabOrder(settings));
          setOpen('library');
        }}
      />
      {open === 'home' && <HomeLayoutDialog onClose={() => setOpen(undefined)} />}
      {open === 'library' && (
        <SortableDialog
          title={tr('我的标签排序')}
          items={order.map((key) => ({ id: key, label: tr(libraryTabLabels[key]) }))}
          onReorder={setOrder}
          onReset={async () => {
            await save({ libraryTabOrder: [] });
            setOpen(undefined);
          }}
          onSave={async () => {
            await save({ libraryTabOrder: order });
            setOpen(undefined);
          }}
          onClose={() => setOpen(undefined)}
        />
      )}
    </Stack>
  );
}
