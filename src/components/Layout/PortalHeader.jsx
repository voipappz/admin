// Portal navigation and persistent server-side call search.
import { useEffect, useRef, useState } from 'react';
import { Avatar, Box, Button, IconButton, InputAdornment, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import TextSearchFilter from '../shared/Filters/TextSearchFilter';
import CloseIcon from '@mui/icons-material/Close';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useUserAuth } from '../../context/UserAuthContext';
import { usePortalPreferences } from '../../context/PortalPreferencesContext';
import { useAIChatSidebar } from '../../context/AIChatSidebarContext';
import { useSoftphone } from '../../context/SoftphoneContext';
import { canAccessScreen } from '../../utils/jwt';

export default function PortalHeader() {
  const { user, acl, logout } = useUserAuth();
  const { preferences, ready, save, reset } = usePortalPreferences();
  const { openAIDrawer } = useAIChatSidebar();
  const { connected } = useSoftphone();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get('q') || '';
  const [draft, setDraft] = useState(query);
  const [anchor, setAnchor] = useState(null);
  const input = useRef(null);
  const dashboardAllowed = canAccessScreen(acl, 'dashboard');
  const callsAllowed = canAccessScreen(acl, 'calls');
  useEffect(() => { setDraft(query); }, [query, pathname]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k' && callsAllowed) {
        event.preventDefault(); input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [callsAllowed]);
  const search = (value) => {
    const next = pathname === '/my-calls' ? new URLSearchParams(params) : new URLSearchParams();
    if (value.trim()) next.set('q', value.trim()); else next.delete('q');
    next.delete('page');
    navigate(`/my-calls?${next}`);
  };
  const links = [
    ...(dashboardAllowed ? [{ label: 'Dashboard', path: '/' }, { label: 'Live', path: '/live' }] : []),
    ...(callsAllowed ? [{ label: 'Calls', path: '/my-calls' }] : []),
  ];
  return (
    <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 1100, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>VoipAppz</Typography>
      <Box component="nav" aria-label="Portal navigation" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {links.map(({ label, path }) => <Button key={path} onClick={() => navigate(path)} aria-current={pathname === path ? 'page' : undefined} variant={pathname === path ? 'contained' : 'text'} disableElevation>{label}</Button>)}
        <Button onClick={openAIDrawer}>Assistant</Button>
      </Box>
      {callsAllowed && <Box component="form" onSubmit={(event) => { event.preventDefault(); search(draft); }} sx={{ flex: 1, minWidth: { xs: '100%', md: 240 }, order: { xs: 3, md: 0 } }}>
        <TextSearchFilter field="inline" inputRef={input} value={draft} onChange={(_field, value) => setDraft(value)} placeholder="Search calls, names or numbers…" inputProps={{ 'aria-label': 'Search calls', maxLength: 200 }}
          endAdornment={draft ? <InputAdornment position="end"><IconButton size="small" aria-label="Clear search" onClick={() => { setDraft(''); search(''); }}><CloseIcon fontSize="small" /></IconButton></InputAdornment> : undefined} />
      </Box>}
      <Tooltip title={connected ? 'Phone connected' : 'Phone disconnected'}><Box component="span" aria-label={connected ? 'Phone connected' : 'Phone disconnected'} sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: connected ? 'success.main' : 'text.disabled', ml: 'auto' }} /></Tooltip>
      <IconButton aria-label="Your account and preferences" onClick={(event) => setAnchor(event.currentTarget)}><Avatar sx={{ width: 32, height: 32 }}>{(user?.name || user?.email || 'U').slice(0, 1)}</Avatar></IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem disabled>{user?.name || user?.email}</MenuItem>
        <MenuItem disabled={!ready} onClick={() => save({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })}>{preferences.theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</MenuItem>
        <MenuItem disabled={!ready} onClick={() => { reset(); setAnchor(null); }}>Reset my preferences</MenuItem>
        <MenuItem onClick={logout}>Sign out</MenuItem>
      </Menu>
    </Box>
  );
}
