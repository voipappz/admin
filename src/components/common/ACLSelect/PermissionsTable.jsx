import { Fragment, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  Button,
  Chip,
  Skeleton,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CAPABILITY_ALIASES } from '../../../utils/jwt';

/**
 * PermissionsTable — the ACL permissions editor inside ACLDialog.
 *
 * Laid out like the old read-only ACLs screen (removed): one row per service
 * with a Read and a Write switch. Those two switches are the service's `main`
 * element. Anything else a service carries — `calls` has click2call, `reports`
 * one element per report, most `user` services have sub-screens with their own
 * verbs — is an "extra": the row's "more" button opens them as switches.
 *
 * Props:
 * - typeData: { service: { element: ['perm', ...] } } — what can be granted
 * - value:    same shape — what is granted
 * - onChange: receives the new value
 * - loading, disabled
 */
const MAIN = 'main';
const BASE_PERMS = ['read', 'write'];

// A renamed capability (routes <-> dids) under the key the catalogue uses. A
// document written before the rename says `dids`; the catalogue says `routes`.
// Without this the Routes row showed both switches OFF for an account that
// plainly had the grant, and saving added a second `routes` entry beside the
// `dids` one. Read through the alias, write the catalogue's key, drop the old.
const canonical = (value, typeData) => {
  if (!value || !typeData) return value || {};
  const out = {};
  Object.entries(value).forEach(([service, elements]) => {
    const alias = CAPABILITY_ALIASES[service];
    const key = typeData[service] ? service : (alias && typeData[alias] ? alias : service);
    out[key] = out[key] ? { ...out[key], ...elements } : elements;
  });
  return out;
};

const label = (s) => String(s).replace(/[_.]/g, ' ');

// Every grantable permission of a service that is not main read/write.
const extrasOf = (elements) => Object.entries(elements).flatMap(([element, perms]) => (
  Array.isArray(perms)
    ? perms.filter((p) => element !== MAIN || !BASE_PERMS.includes(p)).map((p) => ({ element, perm: p }))
    : []
));

const PermissionsTable = ({
  typeData,
  value = {},
  onChange,
  loading = false,
  disabled = false
}) => {
  const [expanded, setExpanded] = useState([]);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  // A service matches by its own name (all of it stays) or by any element or
  // permission name (only the matching extras stay).
  const services = useMemo(() => {
    const all = typeData ? Object.entries(typeData) : [];
    return all
      // One row per capability: when the catalogue lists both spellings of a
      // renamed one, the old spelling is hidden (its grant shows on the new row).
      .filter(([service]) => !(CAPABILITY_ALIASES[service] && typeData[CAPABILITY_ALIASES[service]] && service === 'dids'))
      .map(([service, elements]) => {
        const extras = extrasOf(elements);
        if (!query || label(service).toLowerCase().includes(query)) return { service, elements, extras };
        const hits = extras.filter(({ element, perm }) =>
          label(element).toLowerCase().includes(query) || String(perm).toLowerCase().includes(query));
        return hits.length ? { service, elements, extras: hits } : null;
      })
      .filter(Boolean);
  }, [typeData, query]);

  const granted = useMemo(() => canonical(value, typeData), [value, typeData]);

  const counts = useMemo(() => {
    let total = 0;
    let selected = 0;
    Object.entries(typeData || {}).forEach(([service, elements]) => {
      Object.entries(elements).forEach(([element, perms]) => {
        if (!Array.isArray(perms)) return;
        total += perms.length;
        selected += (granted?.[service]?.[element] || []).filter((p) => perms.includes(p)).length;
      });
    });
    return { total, selected };
  }, [typeData, granted]);

  const has = useCallback(
    (service, element, perm) => Boolean(granted?.[service]?.[element]?.includes(perm)),
    [granted]
  );

  const toggle = useCallback((service, element, perm) => {
    if (disabled) return;
    const perms = granted?.[service]?.[element] || [];
    const next = perms.includes(perm) ? perms.filter((p) => p !== perm) : [...perms, perm];
    onChange?.({ ...granted, [service]: { ...(granted?.[service] || {}), [element]: next } });
  }, [granted, onChange, disabled]);

  const setAll = useCallback((on) => {
    if (disabled) return;
    if (!on) { onChange?.({}); return; }
    const next = {};
    Object.entries(typeData || {}).forEach(([service, elements]) => {
      next[service] = {};
      Object.entries(elements).forEach(([element, perms]) => {
        if (Array.isArray(perms)) next[service][element] = [...perms];
      });
    });
    onChange?.(next);
  }, [typeData, onChange, disabled]);

  const toggleExpanded = (service) => setExpanded((prev) => (
    prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
  ));

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={36} sx={{ mb: 1, borderRadius: 1 }} />)}
      </Box>
    );
  }

  if (!typeData || Object.keys(typeData).length === 0) {
    return <Alert severity="info" sx={{ m: 2 }}>Select an ACL type to configure permissions</Alert>;
  }

  const baseSwitch = (service, elements, perm) => {
    if (!elements[MAIN]?.includes(perm)) {
      return <Typography variant="body2" color="text.disabled" aria-hidden>—</Typography>;
    }
    return (
      <Switch
        size="small"
        checked={has(service, MAIN, perm)}
        onChange={() => toggle(service, MAIN, perm)}
        disabled={disabled}
        slotProps={{ input: { role: 'switch', 'aria-label': `${label(service)} ${perm}` } }}
      />
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2">Permissions</Typography>
          <Chip
            size="small"
            label={`${counts.selected} / ${counts.total}`}
            color={counts.total && counts.selected === counts.total ? 'success' : 'default'}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions…"
            size="small"
            sx={{ width: 220 }}
            inputProps={{ 'aria-label': 'Search permissions' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
          />
          <Button size="small" variant="outlined" onClick={() => setAll(true)}
            disabled={disabled || counts.selected === counts.total}>
            Select all
          </Button>
          <Button size="small" variant="outlined" onClick={() => setAll(false)}
            disabled={disabled || counts.selected === 0}>
            Clear all
          </Button>
        </Box>
      </Box>

      <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
        {query && services.length === 0 ? (
          <Alert severity="info" sx={{ m: 2 }}>No permissions match “{search.trim()}”.</Alert>
        ) : (
          <Table size="small" stickyHeader aria-label="Permissions">
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell align="center" sx={{ width: 90 }}>Read</TableCell>
                <TableCell align="center" sx={{ width: 90 }}>Write</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map(({ service, elements, extras }) => {
                const open = Boolean(query) || expanded.includes(service);
                const granted = extras.filter(({ element, perm }) => has(service, element, perm)).length;
                return (
                  <Fragment key={service}>
                    <TableRow hover>
                      <TableCell sx={{ textTransform: 'capitalize' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{label(service)}</span>
                          {extras.length > 0 && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => toggleExpanded(service)}
                              aria-expanded={open}
                              aria-label={`${label(service)}: ${granted} of ${extras.length} more permissions`}
                              endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
                              sx={{ textTransform: 'none', minWidth: 0, py: 0 }}
                            >
                              {granted}/{extras.length} more
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">{baseSwitch(service, elements, 'read')}</TableCell>
                      <TableCell align="center">{baseSwitch(service, elements, 'write')}</TableCell>
                    </TableRow>
                    {open && extras.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ bgcolor: 'action.hover', py: 1 }}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', columnGap: 2 }}>
                            {extras.map(({ element, perm }) => (
                              <Box key={`${element}:${perm}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                <Typography variant="body2" sx={{ textTransform: 'capitalize' }} noWrap>
                                  {element === MAIN ? perm : `${label(element)} · ${perm}`}
                                </Typography>
                                <Switch
                                  size="small"
                                  checked={has(service, element, perm)}
                                  onChange={() => toggle(service, element, perm)}
                                  disabled={disabled}
                                  slotProps={{ input: { role: 'switch', 'aria-label': `${label(service)} ${label(element)} ${perm}` } }}
                                />
                              </Box>
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
};

export default PermissionsTable;
