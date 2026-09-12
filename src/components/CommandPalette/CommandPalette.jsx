import { Dialog, TextField, InputAdornment, Box, CircularProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useGlobalSearchResults } from './useGlobalSearchResults';
import SearchResults from './SearchResults';
import './CommandPalette.css';

// Global search as a centered dialog — the mobile / event-triggered surface.
// On desktop the same search lives inline in the topbar (see TopBar.jsx);
// both render through useGlobalSearchResults + SearchResults.
const CommandPalette = ({ open, onClose, initialQuery = '' }) => {
  const search = useGlobalSearchResults({ open, initialQuery, onClose });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="command-palette-overlay"
      PaperProps={{ className: 'command-palette-paper' }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0, 0, 0, 0.3)' } } }}
    >
      <Box sx={{ p: '12px 12px 0' }}>
        <TextField
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
          onKeyDown={search.handleKeyDown}
          placeholder="Search pages, resources, actions..."
          variant="outlined"
          size="small"
          fullWidth
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 22, color: 'var(--theme-text-secondary)' }} />
              </InputAdornment>
            ),
            endAdornment: search.resourceLoading ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : null,
            sx: {
              borderRadius: '10px',
              fontSize: '1rem',
              '& .MuiOutlinedInput-input': { py: '12px' },
            },
          }}
        />
      </Box>
      <SearchResults search={search} />
    </Dialog>
  );
};

export default CommandPalette;
