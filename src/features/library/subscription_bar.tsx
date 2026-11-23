import { useEffect, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import { useI18n } from '../../app/i18n';
import type { SubscribedArtist } from '../../domain/models/library';

const COLLAPSED_MAX_HEIGHT = 72;

export function SubscriptionBar({
  artists,
  value,
  useNameKey,
  onChange,
}: {
  artists: SubscribedArtist[];
  value: string;
  useNameKey: boolean;
  onChange: (value: string) => void;
}) {
  const tr = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? artists.filter((item) => item.name.toLowerCase().includes(normalized))
    : artists;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 作者数量变化时重新检测是否超出两行
  useEffect(() => {
    const element = listRef.current;
    if (!element || expanded || normalized) {
      return;
    }
    const check = () => setOverflowing(element.scrollHeight > COLLAPSED_MAX_HEIGHT + 2);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [artists.length, expanded, normalized]);

  if (!artists.length) {
    return null;
  }

  const pillSx = (active: boolean) => ({
    height: 32,
    px: 1.4,
    gap: 0.75,
    borderRadius: '999px',
    border: '1px solid',
    borderColor: active ? 'primary.main' : 'divider',
    bgcolor: active ? 'action.selected' : 'background.paper',
    color: active ? 'primary.main' : 'text.primary',
    transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
    '&:hover': {
      borderColor: active ? 'primary.main' : 'text.secondary',
      bgcolor: active ? 'action.selected' : 'action.hover',
    },
  });

  return (
    <Stack spacing={1}>
      <Box
        ref={listRef}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.75,
          maxHeight: expanded || normalized ? 'none' : COLLAPSED_MAX_HEIGHT,
          overflow: 'hidden',
        }}
      >
        {!normalized && (
          <ButtonBase onClick={() => onChange('')} sx={pillSx(!value)}>
            <Typography component="span" sx={{ fontSize: 12.5, fontWeight: !value ? 600 : 500 }}>
              {tr('全部作者')}
            </Typography>
          </ButtonBase>
        )}
        {filtered.map((item) => {
          const key = useNameKey ? item.name : item.id;
          const active = value === key;
          return (
            <ButtonBase
              key={item.id}
              onClick={() => onChange(active ? '' : key)}
              sx={{ ...pillSx(active), pl: 0.6 }}
            >
              <Avatar
                src={item.avatarUrl}
                alt={item.name}
                sx={{ width: 22, height: 22, fontSize: 11 }}
              >
                {item.name.slice(0, 1)}
              </Avatar>
              <Typography
                component="span"
                sx={{ fontSize: 12.5, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap' }}
              >
                {item.name}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      {(artists.length > 6 || overflowing || expanded) && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          {artists.length > 6 ? (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                alignItems: 'center',
                height: 30,
                width: 190,
                px: 1,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                '&:focus-within': { borderColor: 'primary.main' },
              }}
            >
              <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
              <InputBase
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tr('筛选作者')}
                inputProps={{ 'aria-label': tr('筛选作者') }}
                sx={{ fontSize: 12.5, flex: 1, minWidth: 0 }}
              />
              {query && (
                <IconButton size="small" onClick={() => setQuery('')} sx={{ p: 0.2 }}>
                  <CloseRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Stack>
          ) : (
            <Box />
          )}

          {!normalized && (overflowing || expanded) && (
            <Button
              size="small"
              color="inherit"
              endIcon={
                expanded ? (
                  <ExpandLessRoundedIcon fontSize="small" />
                ) : (
                  <ExpandMoreRoundedIcon fontSize="small" />
                )
              }
              onClick={() => setExpanded((open) => !open)}
              sx={{ height: 28, px: 1, borderRadius: '8px', fontSize: 12, color: 'text.secondary' }}
            >
              {expanded ? tr('收起') : tr('展开全部 ({0})', artists.length)}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
