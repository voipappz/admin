import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Popover,
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PhoneIcon from '@mui/icons-material/Phone';
import QueueIcon from '@mui/icons-material/Queue';
import SettingsIcon from '@mui/icons-material/Settings';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import { FixedSizeList } from 'react-window';
import { didsApi } from '../../services/api/routesApi';

const ITEM_HEIGHT = 52;

/**
 * DIDSelectorPopover — DID picker shown as the second TopBar breadcrumb popover.
 * Fetches DIDs for the selected environments, supports search + tag filter.
 * Clicking a DID triggers onDIDSelect(did).
 */
const DIDSelectorPopover = ({ open, anchorEl, onClose, selectedEnvironments, onDIDSelect, activeDIDUuid, onNavigate }) => {
  const [dids, setDids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('all');
  const [tagFilters, setTagFilters] = useState([]);
  const [tagKeyInput, setTagKeyInput] = useState('');
  const [tagValueInput, setTagValueInput] = useState('');
  const [truncated, setTruncated] = useState(false);

  // Context menu for DID actions
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [actionMenuDID, setActionMenuDID] = useState(null);

  // Fetch DIDs when popover opens
  const fetchDIDs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setTruncated(false);
    try {
      const envUuids = selectedEnvironments.map(e => e.uuid).filter(Boolean);
      const params = { per_page: 9999 };
      if (envUuids.length === 1) {
        params.environment_uuid = envUuids[0];
      }
      const response = await didsApi.getDIDs(params);
      const list = Array.isArray(response) ? response : (response?.data || []);
      setDids(list);
      if (list.length >= 9999) setTruncated(true);
    } catch (err) {
      console.error('Failed to fetch Routes:', err);
      setFetchError(err.message || 'Failed to load Routes');
      setDids([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironments]);

  useEffect(() => {
    if (!open) return;
    fetchDIDs();
  }, [open, fetchDIDs]);

  // Reset state when closing
  const handleClose = useCallback(() => {
    setSearchValue('');
    setEnabledFilter('all');
    setTagFilters([]);
    setTagKeyInput('');
    setTagValueInput('');
    setActionMenuAnchor(null);
    setActionMenuDID(null);
    onClose();
  }, [onClose]);

  // DID action menu — context-aware actions per DID
  const handleDIDRightClick = useCallback((e, did) => {
    e.preventDefault();
    e.stopPropagation();
    setActionMenuAnchor(e.currentTarget);
    setActionMenuDID(did);
  }, []);

  const handleActionMenuClose = useCallback(() => {
    setActionMenuAnchor(null);
    setActionMenuDID(null);
  }, []);

  // Filter by enabled status
  const enabledFiltered = useMemo(() => {
    if (enabledFilter === 'all') return dids;
    const wantEnabled = enabledFilter === 'enabled';
    return dids.filter(d => d.enabled === wantEnabled);
  }, [dids, enabledFilter]);

  // Filter by search text
  const textFiltered = useMemo(() => {
    const q = searchValue.toLowerCase().trim();
    if (!q) return enabledFiltered;
    return enabledFiltered.filter(d =>
      (d.number || '').toLowerCase().includes(q) ||
      (d.name || '').toLowerCase().includes(q)
    );
  }, [enabledFiltered, searchValue]);

  // Collect available tag keys
  const availableTagKeys = useMemo(() => {
    const keys = new Set();
    dids.forEach(d => {
      const meta = d.meta || d.tags || {};
      if (typeof meta === 'object' && meta !== null) {
        Object.keys(meta).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys).sort();
  }, [dids]);

  // Filter by tags (AND logic)
  const filteredDIDs = useMemo(() => {
    if (tagFilters.length === 0) return textFiltered;
    return textFiltered.filter(d => {
      const meta = d.meta || d.tags || {};
      if (typeof meta !== 'object' || meta === null) return false;
      return tagFilters.every(tf => {
        const val = meta[tf.key];
        if (val === undefined) return false;
        if (!tf.value) return true;
        return String(val).toLowerCase().includes(tf.value.toLowerCase());
      });
    });
  }, [textFiltered, tagFilters]);

  const handleAddTagFilter = useCallback(() => {
    const key = tagKeyInput.trim();
    if (!key) return;
    const value = tagValueInput.trim();
    if (tagFilters.some(tf => tf.key === key && tf.value === value)) return;
    setTagFilters(prev => [...prev, { key, value }]);
    setTagKeyInput('');
    setTagValueInput('');
  }, [tagKeyInput, tagValueInput, tagFilters]);

  const handleDIDClick = useCallback((e, did) => {
    // Single click → show action menu for the DID
    setActionMenuAnchor(e.currentTarget);
    setActionMenuDID(did);
  }, []);

  const handleActionGoToQueue = useCallback(() => {
    if (actionMenuDID) {
      onDIDSelect(actionMenuDID);
    }
    handleActionMenuClose();
    handleClose();
  }, [actionMenuDID, onDIDSelect, handleActionMenuClose, handleClose]);

  const handleActionGoToDIDSettings = useCallback(() => {
    if (actionMenuDID && onNavigate) {
      onNavigate(`/dids?highlight=${actionMenuDID.uuid}`);
    }
    handleActionMenuClose();
    handleClose();
  }, [actionMenuDID, onNavigate, handleActionMenuClose, handleClose]);

  // Row renderer
  const DIDRow = useCallback(({ index, style }) => {
    const did = filteredDIDs[index];
    if (!did) return null;
    const isActive = activeDIDUuid && did.uuid === activeDIDUuid;
    return (
      <Box
        style={style}
        onClick={(e) => handleDIDClick(e, did)}
        onContextMenu={(e) => handleDIDRightClick(e, did)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'var(--theme-hover)' },
          borderBottom: '1px solid var(--border-light, #e0e0e0)',
          gap: 1,
          ...(isActive && {
            backgroundColor: 'var(--theme-active, rgba(25, 118, 210, 0.08))',
            borderLeft: '3px solid',
            borderLeftColor: 'primary.main',
          }),
        }}
      >
        <PhoneIcon sx={{ fontSize: 16, color: 'var(--theme-text-secondary)', flexShrink: 0 }} />
        <Box sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
            {did.number || 'No number'}
          </Typography>
          {did.name && (
            <Typography variant="caption" noWrap sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.7rem', display: 'block' }}>
              {did.name}
            </Typography>
          )}
        </Box>
        <Chip
          label={did.enabled ? 'On' : 'Off'}
          size="small"
          color={did.enabled ? 'success' : 'default'}
          variant={did.enabled ? 'filled' : 'outlined'}
          sx={{ height: 18, fontSize: '0.6rem', minWidth: 30, flexShrink: 0 }}
        />
        {did.bridge_type && (
          <Chip
            label={did.bridge_type}
            size="small"
            variant="outlined"
            sx={{ height: 18, fontSize: '0.58rem', flexShrink: 0, maxWidth: 80 }}
          />
        )}
      </Box>
    );
  }, [filteredDIDs, handleDIDClick, handleDIDRightClick, activeDIDUuid]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      sx={{
        '& .MuiPaper-root': {
          width: 420,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          border: '1px solid var(--border-light)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          backgroundColor: 'var(--theme-bg-primary)',
          mt: 0.5,
        }
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5, display: 'block' }}>
          DIDs {!loading && `(${filteredDIDs.length})`}
        </Typography>

        {/* Search */}
        <TextField
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search by number or name..."
          variant="outlined"
          size="small"
          fullWidth
          autoFocus
          sx={{ mt: 0.5, mb: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'var(--theme-text-secondary)' }} />
              </InputAdornment>
            ),
            endAdornment: searchValue ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchValue('')}>
                  <ClearIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
        />

        {/* Filter toggles */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={enabledFilter}
            exclusive
            onChange={(_e, val) => { if (val) setEnabledFilter(val); }}
            size="small"
            sx={{ height: 26 }}
          >
            <ToggleButton value="all" sx={{ px: 1.5, py: 0, fontSize: '0.7rem', textTransform: 'none' }}>
              All
            </ToggleButton>
            <ToggleButton value="enabled" sx={{ px: 1.5, py: 0, fontSize: '0.7rem', textTransform: 'none' }}>
              Enabled
            </ToggleButton>
            <ToggleButton value="disabled" sx={{ px: 1.5, py: 0, fontSize: '0.7rem', textTransform: 'none' }}>
              Disabled
            </ToggleButton>
          </ToggleButtonGroup>
          {loading && <CircularProgress size={14} sx={{ ml: 'auto' }} />}
        </Box>

        {/* Tag Filter */}
        {availableTagKeys.length > 0 && (
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid var(--border-light, #e0e0e0)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <FilterListIcon sx={{ fontSize: 14, color: 'var(--theme-text-secondary)' }} />
              <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tag Filter
              </Typography>
              {tagFilters.length > 0 && (
                <IconButton size="small" onClick={() => setTagFilters([])} sx={{ p: 0.25, ml: 'auto' }}>
                  <ClearIcon sx={{ fontSize: 12, color: 'var(--theme-text-secondary)' }} />
                </IconButton>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TextField
                select
                value={tagKeyInput}
                onChange={(e) => setTagKeyInput(e.target.value)}
                size="small"
                variant="outlined"
                sx={{ minWidth: 100, flex: 1, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 30 } }}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="" disabled><em>Key</em></MenuItem>
                {availableTagKeys.map(k => (
                  <MenuItem key={k} value={k} sx={{ fontSize: '0.8rem' }}>{k}</MenuItem>
                ))}
              </TextField>
              <TextField
                value={tagValueInput}
                onChange={(e) => setTagValueInput(e.target.value)}
                size="small"
                variant="outlined"
                placeholder="Value"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTagFilter(); }}
                sx={{ flex: 1, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 30 } }}
              />
              <Chip
                label="Add"
                size="small"
                onClick={handleAddTagFilter}
                disabled={!tagKeyInput.trim()}
                sx={{ fontSize: '0.7rem', height: 26, cursor: 'pointer' }}
              />
            </Box>
            {tagFilters.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {tagFilters.map((tf, i) => (
                  <Chip
                    key={`${tf.key}-${tf.value}-${i}`}
                    label={tf.value ? `${tf.key}=${tf.value}` : tf.key}
                    size="small"
                    variant="outlined"
                    color="primary"
                    onDelete={() => setTagFilters(prev => prev.filter((_, idx) => idx !== i))}
                    sx={{ height: 22, fontSize: '0.68rem' }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Column Headers */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.5, borderTop: '1px solid var(--border-light, #e0e0e0)', backgroundColor: 'var(--theme-bg-secondary, #fafafa)' }}>
        <Box sx={{ width: 20 }} />
        <Typography variant="caption" sx={{ flex: 1, fontSize: '0.6rem', color: 'var(--theme-text-secondary)', fontWeight: 600, textTransform: 'uppercase', ml: 1 }}>
          Number / Name
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', fontWeight: 600, textTransform: 'uppercase', mr: 1 }}>
          Status
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
          Type
        </Typography>
      </Box>

      {/* Truncation / multi-env warning */}
      {truncated && (
        <Alert severity="warning" sx={{ mx: 2, mb: 1, py: 0, fontSize: '0.72rem' }}>
          Showing first 9,999 results. Use search to narrow down.
        </Alert>
      )}
      {selectedEnvironments.length > 1 && !loading && (
        <Typography variant="caption" sx={{ px: 2, pb: 0.5, color: 'var(--theme-text-secondary)', fontSize: '0.68rem', display: 'block' }}>
          Showing DIDs across {selectedEnvironments.length} environments
        </Typography>
      )}

      {/* DID List */}
      <Box sx={{ flex: '1 1 auto', minHeight: 0 }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ mt: 1, color: 'var(--theme-text-secondary)', fontSize: '0.8rem' }}>
              Loading DIDs...
            </Typography>
          </Box>
        ) : fetchError ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 1 }}>
              {fetchError}
            </Alert>
            <Button size="small" startIcon={<RefreshIcon />} onClick={fetchDIDs} sx={{ textTransform: 'none' }}>
              Retry
            </Button>
          </Box>
        ) : filteredDIDs.length > 0 ? (
          <FixedSizeList
            height={Math.min(filteredDIDs.length * ITEM_HEIGHT, 360)}
            width="100%"
            itemSize={ITEM_HEIGHT}
            itemCount={filteredDIDs.length}
            overscanCount={5}
          >
            {DIDRow}
          </FixedSizeList>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <PhoneIcon sx={{ fontSize: 36, color: 'var(--theme-text-secondary)', opacity: 0.4, mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.8rem' }}>
              {selectedEnvironments.length === 0 ? 'Select a application first' : 'No Routes found'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* DID Action Menu — context-aware actions */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ '& .MuiPaper-root': { minWidth: 200, borderRadius: '8px' } }}
      >
        {actionMenuDID && (
          <Box sx={{ px: 2, py: 1, borderBottom: '1px solid var(--border-light, #e0e0e0)' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
              {actionMenuDID.number}
            </Typography>
            {actionMenuDID.name && (
              <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)' }}>
                {actionMenuDID.name}
              </Typography>
            )}
          </Box>
        )}
        <MenuItem onClick={handleActionGoToQueue} sx={{ fontSize: '0.85rem' }}>
          <ListItemIcon><QueueIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Queue Editor</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleActionGoToDIDSettings} sx={{ fontSize: '0.85rem' }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Route Settings</ListItemText>
        </MenuItem>
      </Menu>
    </Popover>
  );
};

export default DIDSelectorPopover;
