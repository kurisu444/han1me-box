import { useState } from 'react';
import { Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import { searchLocale } from '../../data/search_option_catalog';
import type { SearchQuery } from '../../domain/models/search_query';
import { SearchBarBox } from '../search/search_bar_box';
import { searchRouteUrl } from '../search/search_controller';
import { exploreChannelLabel, type ExploreChannel } from './explore_channels';

export function ExploreTopBar({
  channels,
  activeChannelId,
  onSelectChannel,
}: {
  channels: ExploreChannel[];
  activeChannelId: string;
  onSelectChannel: (channel: ExploreChannel) => void;
}) {
  const tr = useI18n();
  const settings = useSettings();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const localeKey = searchLocale(settings.language, navigator.language);

  function submitSearch() {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return;
    }
    setKeyword('');
    navigate(`/search?query=${encodeURIComponent(trimmed)}`);
  }

  function selectHistory(query: SearchQuery) {
    setKeyword('');
    navigate(searchRouteUrl({ ...query, page: 1 }));
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        mt: -2.5,
        mb: 2.5,
        mx: { xs: -2, sm: -3 },
        px: { xs: 2, sm: 3 },
        height: 54,
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        component="nav"
        aria-label={tr('分类')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexGrow: 1,
          minWidth: 0,
          pr: { xs: '204px', sm: '264px' },
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          opacity: searchFocused ? 0 : 1,
          pointerEvents: searchFocused ? 'none' : 'auto',
          transition: 'opacity 0.18s ease',
        }}
      >
        {channels.map((channel) => {
          const selected = channel.id === activeChannelId;
          return (
            <Button
              key={channel.id}
              size="small"
              color={selected ? 'primary' : 'inherit'}
              aria-current={selected ? 'page' : undefined}
              onClick={() => onSelectChannel(channel)}
              sx={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                minWidth: 'auto',
                px: 1.25,
                py: 0.5,
                fontSize: 13.5,
                fontWeight: selected ? 700 : 500,
                opacity: selected ? 1 : 0.8,
                '&:hover': { opacity: 1 },
              }}
            >
              {exploreChannelLabel(channel, localeKey)}
            </Button>
          );
        })}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          right: searchFocused ? '50%' : { xs: 16, sm: 24 },
          transform: searchFocused ? 'translate(50%, -50%)' : 'translateY(-50%)',
          width: searchFocused ? { xs: 'calc(100% - 32px)', sm: 460 } : { xs: 190, sm: 248 },
          maxWidth: 'calc(100% - 32px)',
          zIndex: 12,
          transition: 'right 0.22s ease, transform 0.22s ease, width 0.22s ease',
        }}
      >
        <SearchBarBox
          value={keyword}
          locale={localeKey}
          height={36}
          fontSize={13}
          maxItems={12}
          allowEmptySubmit={false}
          onChange={setKeyword}
          onSubmit={submitSearch}
          onSelectHistory={selectHistory}
          onFocusChange={setSearchFocused}
        />
      </Box>
    </Box>
  );
}
