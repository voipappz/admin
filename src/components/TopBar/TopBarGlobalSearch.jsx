import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Box, InputBase, Popper, Paper, CircularProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useGlobalSearchResults } from '../CommandPalette/useGlobalSearchResults';
import SearchResults from '../CommandPalette/SearchResults';

// Desktop global search — isolated from TopBar so every keystroke re-renders
// ONLY this small subtree, not the whole (large, always-mounted) TopBar.
// Handles its own Ctrl+K and `openResourceFinder` events; the mobile dialog
// surface stays in TopBar (this component is only mounted on desktop).
const TopBarGlobalSearch = () => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [seed, setSeed] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    setPanelOpen(false);
    setSeed('');
    inputRef.current?.blur();
  }, []);

  const search = useGlobalSearchResults({ open: panelOpen, initialQuery: seed, onClose: close });

  const open = useCallback((query = '') => {
    setSeed(query || '');
    setPanelOpen(true);
    inputRef.current?.focus();
  }, []);

  // Ctrl+K focuses the input; `openResourceFinder` events (page-level
  // escalations) open it pre-seeded.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        open();
      }
    };
    const onEvent = (e) => open(e?.detail?.query || '');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('openResourceFinder', onEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('openResourceFinder', onEvent);
    };
  }, [open]);

  return (
    <Box className="topbar-search-wrapper" sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Box ref={boxRef} className="topbar-global-search">
        <SearchIcon sx={{ fontSize: 19, opacity: 0.6, flexShrink: 0 }} />
        <InputBase
          inputRef={inputRef}
          value={search.query}
          placeholder="Search pages, resources, actions…"
          aria-label="Search pages, resources, actions"
          onFocus={() => setPanelOpen(true)}
          onChange={(e) => {
            search.setQuery(e.target.value);
            if (!panelOpen) setPanelOpen(true);
          }}
          onBlur={() => setPanelOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { close(); return; }
            search.handleKeyDown(e);
          }}
          sx={{ flex: 1, fontSize: '0.85rem', color: 'var(--theme-text-primary)' }}
        />
        {search.resourceLoading && panelOpen ? (
          <CircularProgress size={14} sx={{ flexShrink: 0 }} />
        ) : (
          <Box component="span" className="topbar-global-search-kbd">Ctrl K</Box>
        )}
      </Box>
      {/* Results panel attached under the input; mousedown is swallowed so the
          input keeps focus and row clicks beat the blur-close. */}
      <Popper open={panelOpen} anchorEl={boxRef.current} placement="bottom-end" sx={{ zIndex: 1300 }}>
        <Paper className="topbar-search-panel" onMouseDown={(e) => e.preventDefault()}>
          <SearchResults search={search} />
        </Paper>
      </Popper>
    </Box>
  );
};

export default memo(TopBarGlobalSearch);
