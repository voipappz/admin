import { Box, Drawer, Typography, Snackbar, Button, useMediaQuery } from '@mui/material';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useLayout } from './Layout';
import { useLocation } from 'react-router';
import Sidebar from '../Sidebar/Sidebar.jsx';
import TopBar from '../TopBar/TopBar.jsx';
import { useAuth } from '../../context/AuthContext';
import { useUserAuth } from '../../context/UserAuthContext';
import PortalHeader from './PortalHeader.jsx';
import { usePortalPreferences } from '../../context/PortalPreferencesContext';
import PortalSoftkeys, { RAIL_HEIGHT_MOBILE } from '../Portal/PortalSoftkeys.jsx';
import PortalSidebar from '../Portal/PortalSidebar.jsx';
import { PortalSidebarProvider } from '../../context/PortalSidebarContext';
import { GlobalSearchProvider } from '../../context/GlobalSearchContext';
import { RecentPagesProvider } from '../../context/RecentPagesContext';
import { loadCustomerData, applyCustomerBranding, getCustomerData } from '../../services/customerService';
import { useVersionCheck } from '../../hooks/useVersionCheck';
import useIdleTimeout from '../../hooks/useIdleTimeout';
import { useThemeMode } from '../../context/ThemeContext';
import WebRTCPanel from '../Users/UserDialog/WebRTCPanel';
import { useZendeskWidget } from '../../services/zendeskWidget';
import './Layout.css';


// Build version shown in the footer. Prefer the CI build stamp
// (VITE_APP_VERSION = YYYY.MM.DD-<short-sha>, set by the build step in .github/workflows/ci.yml),
// fall back to the package.json version, then "dev" for local `npm run dev`.
const APP_VERSION = import.meta.env.VITE_APP_VERSION || __APP_VERSION__ || 'dev';

// Both served from this deployment's own public/images. The white one used to be
// hardcoded to https://cloud.voipappz.io:9443 — so every install, MTN included,
// fetched its logo from voipappz's cloud host, and lost its logo entirely if that
// host was unreachable. The asset was in public/images the whole time.
const LOGO_DARK = '/images/VA_logo_dark.png';
const LOGO_WHITE = '/images/VA_logo_white.png';

const Layout = ({ children }) => {
  useLayout();
  const location = useLocation();
  const { isAuthenticated, logout, user, customerUuid } = useAuth();
  const userAuth = useUserAuth();
  const portalPreferences = usePortalPreferences();
  const { isDarkMode } = useThemeMode();
  // `/login` still matches for a moment while it redirects to `/admin`.
  // `/` is BOTH the portal's login and, once signed in, the portal itself
  // (App.jsx's PortalRoot). Only treat it as a login page while there is no
  // portal session — otherwise the dashboard renders bare, with no rail and
  // no phone dock.
  const isLoginPage = ['/admin', '/login'].includes(location.pathname)
    || (location.pathname === '/' && !userAuth.isAuthenticated);
  // A signed-in portal user (not an admin) gets a minimal shell below — the
  // admin sidebar/topbar/WebRTCPanel are all admin-console concepts a portal
  // user has no business seeing.
  const isUserOnlySession = userAuth.isAuthenticated && !isAuthenticated;
  // Zendesk support widget (answer bot + "Get in touch" tickets) — admin
  // console only; the portal's corner belongs to the phone FAB.
  useZendeskWidget(isAuthenticated && !isLoginPage, user, customerUuid);
  const customerDataLoadedRef = useRef(false);
  const { updateAvailable, refresh, dismiss } = useVersionCheck();

  // Security: idle session timeout (default 30 min; VITE_IDLE_TIMEOUT_MINUTES).
  // Warns 1 minute before logging out; any activity keeps the session alive.
  const { warningOpen: idleWarningOpen, staySignedIn } = useIdleTimeout({
    enabled: isAuthenticated && !isLoginPage,
    onTimeout: logout,
  });

  // Load and apply customer branding when authenticated (once)
  useEffect(() => {
    if (isAuthenticated && !isLoginPage) {
      // Use cached data if available (prevents double fetch)
      const cached = getCustomerData();
      if (cached) {
        applyCustomerBranding(cached);
        customerDataLoadedRef.current = true;
        return;
      }
      // Only fetch from API if not already loaded this session
      if (!customerDataLoadedRef.current) {
        customerDataLoadedRef.current = true;
        loadCustomerData().then((data) => {
          if (data) applyCustomerBranding(data);
        });
      }
    }
    // Reset ref on logout so next login fetches fresh data
    if (!isAuthenticated) {
      customerDataLoadedRef.current = false;
    }
  }, [isAuthenticated, isLoginPage]);

  // Sidebar state — desktop collapse + mobile drawer (shared by the hamburger).
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Desktop: compact icon rail (default) vs labeled rail, toggled by the
  // sidebar-top hamburger and remembered across sessions.
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try { return localStorage.getItem('nimbus_sidebar_expanded') === 'true'; } catch { return false; }
  });
  const isMobile = useMediaQuery((t) => t.breakpoints.down('md'));
  const handleToggleSidebar = () => {
    if (isMobile) setMobileDrawerOpen(open => !open);
    else setSidebarCollapsed(collapsed => !collapsed);
  };
  const handleToggleExpand = () => {
    setSidebarExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('nimbus_sidebar_expanded', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <Box className="layout-container" data-testid="layout-container">
      {isLoginPage ? (
        // Login page — self-contained split layout inside Login component
        <Box data-testid="login-layout">
          {children}
        </Box>
      ) : isUserOnlySession ? (
        // Portal user, not an admin: a desk phone. The bar (hamburger, the
        // line, you), the softkeys under it, and ONE screen — Calls, Live,
        // Assistant or Phone. No dock, no floating buttons, no menus: the line
        // is the menu (PortalLine) and the softkeys are the only other way to
        // move. The admin sidebar/topbar are admin-console concepts.
        <PortalSidebarProvider>
        <Box data-testid="user-layout" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <PortalHeader />
          <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <PortalSoftkeys />
            <Box
              component="main"
              sx={{
                flex: 1, minWidth: 0,
                // Nothing floats over the screen any more — the phone and the
                // assistant are buttons in the bar. Only the rail, which is a
                // bottom bar on a phone, needs clearing.
                pb: { xs: `calc(${RAIL_HEIGHT_MOBILE}px + env(safe-area-inset-bottom, 0px))`, md: 0 },
              }}
            >
              {/* A local Suspense boundary. Without it, any lazy chunk this
                  subtree pulls in suspends all the way up to App.jsx's
                  boundary, whose fallback is ANOTHER <Layout> — the shell was
                  torn down and rebuilt on every route's first load. */}
              <Suspense fallback={null}>{children}</Suspense>
            </Box>
          </Box>
          {portalPreferences.error && <Box role="alert" sx={{ p: 1, color: 'error.main' }}>{portalPreferences.error}</Box>}
          <PortalSidebar />
        </Box>
        </PortalSidebarProvider>
      ) : (
        // Authenticated layout: Sidebar + TopBar + Content
        <GlobalSearchProvider>
          <RecentPagesProvider>
          <Box data-testid="authenticated-layout" data-tour="welcome">
            {/* Fixed sidebar — hidden on mobile, shown via the drawer */}
            <Box className="sidebar-desktop">
              <Sidebar collapsed={sidebarCollapsed} expanded={sidebarExpanded} onToggleExpand={handleToggleExpand} onToggleSidebar={handleToggleSidebar} />
            </Box>

            {/* Mobile sidebar drawer */}
            <Drawer
              variant="temporary"
              open={mobileDrawerOpen}
              onClose={() => setMobileDrawerOpen(false)}
              ModalProps={{ keepMounted: true }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': { width: 80, boxSizing: 'border-box' }
              }}
            >
              <Sidebar expanded onNavigate={() => setMobileDrawerOpen(false)} onToggleSidebar={handleToggleSidebar} />
            </Drawer>

            {/* TopBar — fixed at top, offset by the sidebar */}
            <TopBar
              sidebarCollapsed={sidebarCollapsed}
              sidebarExpanded={sidebarExpanded}
              onToggleSidebar={handleToggleSidebar}
              onToggleExpand={handleToggleExpand}
            />

            {/* Main content area */}
            <Box className={`content-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarExpanded ? 'sidebar-expanded' : ''}`} data-testid="main-content">
              <Box sx={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {children}
              </Box>
              <Box className="app-footer">
                <Typography className="app-footer-text" variant="caption" data-testid="app-version">
                  v{APP_VERSION}
                </Typography>
              </Box>
              {/* Brand watermark — pinned bottom-right of the content area so it's
                  always visible (not at the end of scroll). */}
              <img
                className="app-watermark"
                src={isDarkMode ? LOGO_WHITE : LOGO_DARK}
                alt="VoipAppz"
              />
            </Box>
          </Box>
          <WebRTCPanel />
          </RecentPagesProvider>
        </GlobalSearchProvider>
      )}

      {/* Version update notification */}
      <Snackbar
        open={updateAvailable}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="A new version is available"
        action={
          <>
            <Button color="inherit" size="small" onClick={dismiss}>
              Later
            </Button>
            <Button color="primary" variant="contained" size="small" onClick={refresh} sx={{ ml: 1 }}>
              Refresh
            </Button>
          </>
        }
      />

      {/* Idle-timeout warning — 1 minute before automatic sign-out */}
      <Snackbar
        open={idleWarningOpen}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message="You'll be signed out in 1 minute due to inactivity"
        action={
          <Button color="primary" variant="contained" size="small" onClick={staySignedIn}>
            Stay signed in
          </Button>
        }
      />
    </Box>
  );
};

export default Layout;
