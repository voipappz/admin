// The portal's bar: the phone key, the line, you. Nothing else.
import { useEffect, useRef, useState } from 'react';
import { Avatar, Box, IconButton, Tooltip } from '@mui/material';
import { useUserAuth } from '../../context/UserAuthContext';
import { loadCustomerPortalData } from '../../services/customerPortalService';
import { parseCustomerBrand } from '../../utils/customerBrand';
import { applyPortalSurface, SURFACE, ON_SURFACE, HEADER_HEIGHT } from '../../theme/portalSurface';
import PortalLine from '../Portal/PortalLine.jsx';
import PortalActions from '../Portal/PortalActions.jsx';

/**
 * The bar: the phone, the line, you.
 *
 * The line is the menu (PortalLine) and the rail on the left is the only other
 * way to move. The phone opens the sidebar — the one place things open on this
 * surface, where a call's details open too — and the assistant is a tab inside
 * it rather than a second button. The avatar puts the cursor on the line.
 */
export default function PortalHeader() {
  const { user } = useUserAuth();
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
        <PortalActions />
        <PortalLine inputRef={line} />
        <IconButton aria-label="You" data-testid="portal-avatar" onClick={() => line.current?.focus()} sx={{ p: 0.5, color: ON_SURFACE, flexShrink: 0 }}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700 }}>{(user?.name || user?.email || 'U').slice(0, 1)}</Avatar>
        </IconButton>
      </Box>
    </Box>
  );
}
