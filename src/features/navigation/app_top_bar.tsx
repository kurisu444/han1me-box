import { useState, type SyntheticEvent } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import {
  AppBar,
  Box,
  Button,
  IconButton,
  InputBase,
  Toolbar,
  Tooltip,
  useTheme,
} from '@mui/material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../app/i18n';
import { useSettings } from '../../app/settings_context';
import {
  canonical,
  labelFor,
  searchLocale,
  searchOptionCatalog,
  type SearchOption,
} from '../../data/search_option_catalog';

const topBarGenres = searchOptionCatalog.genres.options.filter(
  (option): option is SearchOption & { searchKey: string } => Boolean(option.searchKey),
);

export function AppTopBar() {
  const tr = useI18n();
  const theme = useTheme();
  const settings = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const localeKey = searchLocale(settings.language, navigator.language);
  const activeGenre =
    location.pathname === '/search'
      ? canonical(
          searchOptionCatalog.genres,
          new URLSearchParams(location.search).get('genre') ?? '',
        )
      : '';

  function submitSearch(event: SyntheticEvent) {
    event.preventDefault();
    const trimmed = keyword.trim();
    navigate(trimmed ? `/search?query=${encodeURIComponent(trimmed)}` : '/search');
    setKeyword('');
  }

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        flexShrink: 0,
        bgcolor: 'background.default',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 48 }}>
        <Box
          component="nav"
          aria-label={tr('分类')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexGrow: 1,
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {!settings.comicMode &&
            topBarGenres.map((option) => {
              const selected = activeGenre === option.searchKey;
              return (
                <Button
                  key={option.searchKey}
                  component={Link}
                  to={`/search?genre=${encodeURIComponent(option.searchKey)}`}
                  size="small"
                  color={selected ? 'primary' : 'inherit'}
                  sx={{
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    minWidth: 'auto',
                    px: 1.25,
                    fontWeight: selected ? 700 : 500,
                    opacity: selected ? 1 : 0.85,
                  }}
                >
                  {labelFor(option, localeKey)}
                </Button>
              );
            })}
        </Box>
        {!settings.comicMode && (
          <Box
            component="form"
            onSubmit={submitSearch}
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: 230,
              flexShrink: 0,
              pl: 1.75,
              pr: 0.5,
              height: 34,
              borderRadius: '999px',
              bgcolor:
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              '&:focus-within': {
                outline: '1.5px solid',
                outlineColor: 'primary.main',
              },
            }}
          >
            <InputBase
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={tr('搜索视频、作者、标签…')}
              inputProps={{ 'aria-label': tr('搜索') }}
              sx={{ flexGrow: 1, fontSize: 13 }}
            />
            <Tooltip title={tr('搜索')}>
              <IconButton type="submit" size="small" aria-label={tr('搜索')}>
                <SearchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
