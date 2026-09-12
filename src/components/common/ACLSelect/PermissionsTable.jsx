import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Skeleton,
  Alert,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

/**
 * PermissionsTable Component
 * Displays a hierarchical permissions selector organized by categories
 *
 * Props:
 * - typeData: Object - Available permissions structure { category: { element: ['perm1', 'perm2'] } }
 * - value: Object - Currently selected permissions { category: { element: ['perm1'] } }
 * - onChange: Function - Callback when permissions change
 * - loading: Boolean - Show loading skeleton
 * - disabled: Boolean - Disable all interactions
 */
const PermissionsTable = ({
  typeData,
  value = {},
  onChange,
  loading = false,
  disabled = false
}) => {
  // Track expanded categories
  const [expanded, setExpanded] = useState([]);
  // Search across category / element / permission names
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  // Categories/elements filtered by the search query. A category matches by its
  // own name (→ keep all its elements) or by any element/permission name (→ keep
  // only the matching elements). Empty query = everything.
  const filteredCategories = useMemo(() => {
    const all = typeData ? Object.entries(typeData) : [];
    if (!query) return all;
    return all
      .map(([category, elements]) => {
        if (category.replace(/_/g, ' ').toLowerCase().includes(query)) return [category, elements];
        const els = Object.fromEntries(
          Object.entries(elements).filter(([element, perms]) =>
            element.replace(/_/g, ' ').toLowerCase().includes(query) ||
            (Array.isArray(perms) && perms.some((p) => String(p).toLowerCase().includes(query)))
          )
        );
        return Object.keys(els).length ? [category, els] : null;
      })
      .filter(Boolean);
  }, [typeData, query]);

  // Calculate total counts for display
  const counts = useMemo(() => {
    if (!typeData) return { total: 0, selected: 0 };

    let total = 0;
    let selected = 0;

    Object.entries(typeData).forEach(([category, elements]) => {
      Object.entries(elements).forEach(([element, permissions]) => {
        if (Array.isArray(permissions)) {
          total += permissions.length;
          const selectedPerms = value?.[category]?.[element] || [];
          selected += selectedPerms.length;
        }
      });
    });

    return { total, selected };
  }, [typeData, value]);

  // Check if a specific permission is selected
  const isPermissionSelected = useCallback((category, element, permission) => {
    return value?.[category]?.[element]?.includes(permission) || false;
  }, [value]);

  // Toggle a single permission
  const togglePermission = useCallback((category, element, permission) => {
    if (disabled) return;

    const newValue = { ...value };
    if (!newValue[category]) newValue[category] = {};
    if (!newValue[category][element]) newValue[category][element] = [];

    const perms = [...newValue[category][element]];
    const index = perms.indexOf(permission);

    if (index > -1) {
      perms.splice(index, 1);
    } else {
      perms.push(permission);
    }

    newValue[category][element] = perms;
    onChange?.(newValue);
  }, [value, onChange, disabled]);

  // Get category selection state
  const getCategoryState = useCallback((category) => {
    if (!typeData?.[category]) return 'none';

    let total = 0;
    let selected = 0;

    Object.entries(typeData[category]).forEach(([element, permissions]) => {
      if (Array.isArray(permissions)) {
        total += permissions.length;
        const selectedPerms = value?.[category]?.[element] || [];
        selected += selectedPerms.length;
      }
    });

    if (selected === 0) return 'none';
    if (selected === total) return 'all';
    return 'partial';
  }, [typeData, value]);

  // Toggle all permissions in a category
  const toggleCategory = useCallback((category) => {
    if (disabled || !typeData?.[category]) return;

    const state = getCategoryState(category);
    const newValue = { ...value };

    if (state === 'all') {
      // Deselect all
      newValue[category] = {};
    } else {
      // Select all
      newValue[category] = {};
      Object.entries(typeData[category]).forEach(([element, permissions]) => {
        if (Array.isArray(permissions)) {
          newValue[category][element] = [...permissions];
        }
      });
    }

    onChange?.(newValue);
  }, [typeData, value, onChange, disabled, getCategoryState]);

  // Select all permissions globally
  const selectAll = useCallback(() => {
    if (disabled || !typeData) return;

    const newValue = {};
    Object.entries(typeData).forEach(([category, elements]) => {
      newValue[category] = {};
      Object.entries(elements).forEach(([element, permissions]) => {
        if (Array.isArray(permissions)) {
          newValue[category][element] = [...permissions];
        }
      });
    });

    onChange?.(newValue);
  }, [typeData, onChange, disabled]);

  // Deselect all permissions globally
  const deselectAll = useCallback(() => {
    if (disabled) return;
    onChange?.({});
  }, [onChange, disabled]);

  // Handle accordion expansion
  const handleAccordionChange = (category) => (event, isExpanded) => {
    setExpanded(prev =>
      isExpanded
        ? [...prev, category]
        : prev.filter(c => c !== category)
    );
  };

  // Render loading skeleton
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={60}
            sx={{ mb: 1, borderRadius: 1 }}
          />
        ))}
      </Box>
    );
  }

  // Render empty state
  if (!typeData || Object.keys(typeData).length === 0) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        Select an ACL type to configure permissions
      </Alert>
    );
  }

  return (
    <Box>
      {/* Global controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2">
            Permissions
          </Typography>
          <Chip
            size="small"
            label={`${counts.selected} / ${counts.total}`}
            color={counts.selected === counts.total ? 'success' : 'default'}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Search fields for easy management of large ACLs */}
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
            size="small"
            sx={{ width: 220, '& .MuiInputBase-root': { fontSize: '0.82rem', height: 34 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search">
                    <ClearIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={selectAll}
            disabled={disabled || counts.selected === counts.total}
          >
            Select All
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={deselectAll}
            disabled={disabled || counts.selected === 0}
          >
            Clear All
          </Button>
        </Box>
      </Box>

      {/* Categories */}
      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
        {query && filteredCategories.length === 0 && (
          <Alert severity="info" sx={{ m: 2 }}>
            No fields match “{search.trim()}”.
          </Alert>
        )}
        {filteredCategories.map(([category, elements]) => {
          const state = getCategoryState(category);
          const categoryElements = Object.entries(elements);
          const categoryTotal = categoryElements.reduce(
            (sum, [, perms]) => sum + (Array.isArray(perms) ? perms.length : 0),
            0
          );
          const categorySelected = categoryElements.reduce(
            (sum, [element]) =>
              sum + (value?.[category]?.[element]?.length || 0),
            0
          );

          return (
            <Accordion
              key={category}
              expanded={query ? true : expanded.includes(category)}
              onChange={handleAccordionChange(category)}
              disableGutters
              sx={{
                '&:before': { display: 'none' },
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  bgcolor: (query || expanded.includes(category)) ? 'grey.100' : 'transparent',
                  '&:hover': { bgcolor: 'grey.50' }
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flex: 1
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={state === 'all'}
                    indeterminate={state === 'partial'}
                    onChange={() => toggleCategory(category)}
                    disabled={disabled}
                    size="small"
                    icon={<CheckBoxOutlineBlankIcon />}
                    checkedIcon={<CheckBoxIcon />}
                    indeterminateIcon={<IndeterminateCheckBoxIcon />}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{ textTransform: 'capitalize', flex: 1 }}
                  >
                    {category.replace(/_/g, ' ')}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${categorySelected}/${categoryTotal}`}
                    color={categorySelected === categoryTotal ? 'success' : 'default'}
                    sx={{ mr: 1 }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                {categoryElements.map(([element, permissions]) => {
                  if (!Array.isArray(permissions)) return null;

                  return (
                    <Box
                      key={element}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        py: 1,
                        px: 3,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'grey.50' }
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          minWidth: 150,
                          textTransform: 'capitalize',
                          color: 'text.secondary'
                        }}
                      >
                        {element.replace(/_/g, ' ')}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {permissions.map((permission) => (
                          <FormControlLabel
                            key={permission}
                            control={
                              <Checkbox
                                checked={isPermissionSelected(category, element, permission)}
                                onChange={() => togglePermission(category, element, permission)}
                                disabled={disabled}
                                size="small"
                              />
                            }
                            label={
                              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                {permission}
                              </Typography>
                            }
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
};

export default PermissionsTable;
