import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Box, InputBase } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router';
import { useUserAuth } from '../../context/UserAuthContext';
import { usePortalPreferences } from '../../context/PortalPreferencesContext';
import { useSoftphone } from '../../context/SoftphoneContext';
import { usePortalSidebar } from '../../context/PortalSidebarContext';
import { canAccessScreen } from '../../utils/jwt';
import { usePortalCommands } from './usePortalCommands';
import { ON_SURFACE, ON_SURFACE_FAINT, ON_SURFACE_MUTED, SURFACE_BORDER, FIELD_RADIUS } from '../../theme/portalSurface';

/**
 * The line: the portal's one control. A search box that is also the menu.
 *
 * Focus it (click, or ctrl+/) and the rows appear beneath — places, settings,
 * and, once you type, "Call <number>" and "Search calls for <text>". Arrow
 * keys move, Enter does, Escape closes. It is a combobox in the ARIA sense and
 * is marked up as one, so a screen reader hears "Calls, 1 of 6" rather than
 * a text field with a mystery list under it.
 */
export default function PortalLine({ inputRef }) {
  const navigate = useNavigate();
  const { acl, logout } = useUserAuth();
  const { preferences, save } = usePortalPreferences();
  const { dial } = useSoftphone();
  const { open: openSidebar } = usePortalSidebar();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const ownRef = useRef(null);
  const input = inputRef || ownRef;
  const listId = useId();

  const go = useCallback((path) => navigate(path), [navigate]);
  const phone = useCallback(() => openSidebar('phone', { tab: 'dialpad' }), [openSidebar]);
  const assistant = useCallback(() => openSidebar('phone', { tab: 'assistant' }), [openSidebar]);
  // Dialling opens the phone in the sidebar and puts the number in it, rather
  // than navigating away from whatever the person was reading.
  const callNumber = useCallback((n) => { openSidebar('phone', { tab: 'dialpad' }); dial?.(n.replace(/[^\d+*#]/g, '')); }, [openSidebar, dial]);
  const searchCalls = useCallback((text) => navigate(`/my-calls?q=${encodeURIComponent(text)}`), [navigate]);
  const theme = useCallback(() => save({ theme: preferences.theme === 'dark' ? 'light' : 'dark' }), [save, preferences.theme]);
  const density = useCallback(() => save({ calls_density: preferences.calls_density === 'compact' ? 'comfortable' : 'compact' }), [save, preferences.calls_density]);

  const cmd = usePortalCommands({
    liveAllowed: canAccessScreen(acl, 'dashboard'),
    callsAllowed: canAccessScreen(acl, 'calls'),
    dark: preferences.theme === 'dark',
    compact: preferences.calls_density === 'compact',
    go, phone, assistant, dial: callNumber, searchCalls, theme, density, logout,
  });

  const close = useCallback(() => { setOpen(false); cmd.reset(); input.current?.blur(); }, [cmd, input]);
  const run = useCallback((row) => { close(); row.action(); }, [close]);

  // ctrl+/ (or cmd+/) from anywhere puts the cursor on the line.
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input]);

  // A click anywhere else closes the rows.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) close(); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Enter') { const row = cmd.rows[cmd.highlight]; if (row) { e.preventDefault(); run(row); } return; }
    cmd.onKeyDown(e);
  };

  let index = -1;
  const activeId = cmd.rows[cmd.highlight] ? `${listId}-${cmd.rows[cmd.highlight].id}` : undefined;

  return (
    <Box ref={wrap} sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <SearchIcon sx={{ position: 'absolute', left: 14, top: '50%', translate: '0 -50%', fontSize: 20, color: ON_SURFACE_MUTED, pointerEvents: 'none' }} />
      <InputBase
        inputRef={input}
        value={cmd.query}
        onChange={(e) => { cmd.setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Name, number, or where to go"
        inputProps={{
          'aria-label': 'Search or go to', role: 'combobox', 'aria-expanded': open, 'aria-controls': listId,
          'aria-autocomplete': 'list', 'aria-activedescendant': open ? activeId : undefined, autoComplete: 'off', maxLength: 200,
        }}
        data-testid="portal-line"
        sx={{
          width: '100%', height: 44, color: ON_SURFACE, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: FIELD_RADIUS,
          border: `1px solid ${SURFACE_BORDER}`, pl: '42px', pr: '52px', fontSize: 16,
          '&.Mui-focused': { borderColor: 'rgba(255,255,255,0.72)' },
          '& input::placeholder': { color: ON_SURFACE_FAINT, opacity: 1 },
        }}
      />
      <Box component="kbd" aria-hidden sx={{ position: 'absolute', right: 12, top: '50%', translate: '0 -50%', font: '12px ui-monospace, SFMono-Regular, Menlo, monospace', color: ON_SURFACE_FAINT, border: `1px solid ${SURFACE_BORDER}`, borderRadius: '6px', px: 0.75, display: { xs: 'none', sm: 'block' } }}>ctrl /</Box>

      <Box
        id={listId} role="listbox" aria-label="Results" data-testid="portal-line-results"
        sx={{
          display: open ? 'block' : 'none', position: 'absolute', left: 0, right: 0, top: 52, zIndex: 1200,
          bgcolor: 'background.paper', color: 'text.primary', border: 1, borderColor: 'divider', borderRadius: '12px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.22)', overflow: 'hidden', maxHeight: 'min(60vh, 480px)', overflowY: 'auto',
        }}
      >
        {cmd.groups.map((group) => (
          <Box key={group.label}>
            <Box sx={{ px: 1.75, pt: 1.25, pb: 0.5, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'text.secondary' }}>{group.label}</Box>
            {group.items.map((row) => {
              index += 1;
              const i = index;
              const active = i === cmd.highlight;
              return (
                <Box
                  key={row.id} id={`${listId}-${row.id}`} role="option" aria-selected={active}
                  onMouseDown={(e) => { e.preventDefault(); run(row); }}
                  onMouseEnter={() => cmd.setHighlight(i)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1.25, cursor: 'pointer', bgcolor: active ? 'action.selected' : 'transparent' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, fontFamily: row.number ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit' }}>
                    <Box>{row.label}</Box>
                    {row.hint && <Box sx={{ fontSize: 13, color: 'text.secondary' }}>{row.hint}</Box>}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
        {open && cmd.rows.length === 0 && <Box sx={{ p: 2, color: 'text.secondary' }}>Nothing for “{cmd.query}”</Box>}
      </Box>
    </Box>
  );
}
