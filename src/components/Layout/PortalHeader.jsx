// The portal's bar: the phone key, the line, you. Nothing else.
import { useEffect, useRef, useState } from 'react';
import { Avatar, Box, IconButton, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router';
import { useUserAuth } from '../../context/UserAuthContext';
import { useSoftphone } from '../../context/SoftphoneContext';
import { loadCustomerPortalData } from '../../services/customerPortalService';
import { parseCustomerBrand } from '../../utils/customerBrand';
import { applyPortalSurface, SURFACE, ON_SURFACE, HEADER_HEIGHT } from '../../theme/portalSurface';
import PortalLine from '../Portal/PortalLine.jsx';

/**
 * There is no navigation here and no account menu: the line is the menu
 * (PortalLine), and the softkeys under this bar are the only other way to
 * move. The hamburger opens the phone — the one thing a person reaches for
 * without thinking — and the avatar puts the cursor on the line.
 */
export default function PortalHeader() {
  const { user } = useUserAuth();
  const { connected } = useSoftphone();
  const navigate = useNavigate();
  const [portalData, setPortalData] = useState(null);
  const line = useRef(null);
  const { color: brandColor } = parseCustomerBrand(portalData);
  const language = portalData?.language || user?.profile?.language || user?.language
    || (typeof document !== 'undefined' ? document.documentElement.lang : 'en');
  const direction = /^(he|ar|fa|ur)(-|$)/i.test(language) ? 'rtl' : 'ltr';

  useEffect(() => {
    let alive = true;
    loadCustomerPortalData().then((data) => { if (alive) setPortalData(data); });
    return () => { alive = false; };
  }, []);
  // The customer's colour, published for the softkeys and the phone screen.
  useEffect(() => { applyPortalSurface(brandColor); }, [brandColor]);

  return (
    <Box component="header" dir={direction} sx={{ position: 'sticky', top: 0, zIndex: 1100, minHeight: HEADER_HEIGHT, bgcolor: SURFACE, color: ON_SURFACE, px: { xs: 2, md: 3 }, py: 1.25, boxShadow: '0 1px 0 rgba(255,255,255,0.08)' }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Tooltip title="Phone">
          <IconButton aria-label="Phone" data-testid="portal-phone-toggle" onClick={() => navigate('/phone')} sx={{ color: ON_SURFACE, width: 44, height: 44, flexShrink: 0 }}>
            <MenuIcon />
          </IconButton>
        </Tooltip>
        <PortalLine inputRef={line} />
        <Tooltip title={connected ? 'Phone connected' : 'Phone disconnected'}>
          <Box component="span" aria-label={connected ? 'Phone connected' : 'Phone disconnected'} sx={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, bgcolor: connected ? '#28d17c' : 'rgba(255,255,255,0.35)', boxShadow: connected ? '0 0 0 3px rgba(40,209,124,0.12)' : 'none' }} />
        </Tooltip>
        <IconButton aria-label="You" data-testid="portal-avatar" onClick={() => line.current?.focus()} sx={{ p: 0.5, color: ON_SURFACE, flexShrink: 0 }}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700 }}>{(user?.name || user?.email || 'U').slice(0, 1)}</Avatar>
        </IconButton>
      </Box>
    </Box>
  );
}
