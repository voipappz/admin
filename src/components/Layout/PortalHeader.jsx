// The portal's bar: the phone key, the line, you. Nothing else.
import { useEffect, useRef, useState } from 'react';
import { Avatar, Box, IconButton, Tooltip } from '@mui/material';
import { useUserAuth } from '../../context/UserAuthContext';
import { useSoftphone } from '../../context/SoftphoneContext';
import { loadCustomerPortalData } from '../../services/customerPortalService';
import { parseCustomerBrand } from '../../utils/customerBrand';
import { applyPortalSurface, SURFACE, ON_SURFACE, HEADER_HEIGHT } from '../../theme/portalSurface';
import PortalLine from '../Portal/PortalLine.jsx';

/**
 * The bar holds the line and you. Nothing else: the line is the menu
 * (PortalLine), the rail on the left is the only other way to move, and the
 * phone and the assistant are buttons in the corner beside their own panels.
 * The avatar puts the cursor on the line.
 */
export default function PortalHeader() {
  const { user } = useUserAuth();
  const { connected } = useSoftphone();
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
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
