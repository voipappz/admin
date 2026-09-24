// The portal's bar: the phone key, the line, you. Nothing else.
import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useUserAuth } from '../../context/UserAuthContext';
import { loadCustomerPortalData } from '../../services/customerPortalService';
import { parseCustomerBrand } from '../../utils/customerBrand';
import { applyPortalSurface, SURFACE, ON_SURFACE, HEADER_HEIGHT } from '../../theme/portalSurface';
import PortalLine from '../Portal/PortalLine.jsx';
import PortalActions from '../Portal/PortalActions.jsx';
import PortalNav from '../Portal/PortalNav.jsx';

/**
 * The bar: the places on the left, the line, the phone on the right.
 *
 * Everything the portal offers is on one row. Calls and Live are two pills at
 * the left end (PortalNav) — they were a rail, which cost a whole column
 * beside a table that wants the width. The line is the menu (PortalLine). The
 * phone sits at the right end, where an account menu usually is, and opens the
 * sidebar from that same edge — the one place things open on this surface,
 * where a call's details open too. The assistant is a tab inside the phone.
 *
 * There is no avatar and no account menu: signing out and the appearance and
 * density settings are rows in the line, which is the only menu here.
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
        <PortalNav />
        <PortalLine inputRef={line} />
        <PortalActions />
      </Box>
    </Box>
  );
}
