import { Box, Drawer, Typography, Snackbar, Button, useMediaQuery } from '@mui/material';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useLayout } from './Layout';
import { useLocation, useNavigate } from 'react-router';
import Sidebar from '../Sidebar/Sidebar.jsx';
import TopBar from '../TopBar/TopBar.jsx';
import { useAuth } from '../../context/AuthContext';
import { useUserAuth } from '../../context/UserAuthContext';
import PortalSidebar from '../Portal/PortalSidebar.jsx';
import { PortalSidebarProvider } from '../../context/PortalSidebarContext';
import { GlobalSearchProvider } from '../../context/GlobalSearchContext';
import { RecentPagesProvider } from '../../context/RecentPagesContext';
import { loadCustomerData, applyCustomerBranding, getCustomerData } from '../../services/customerService';
import { useVersionCheck } from '../../hooks/useVersionCheck';
import useIdleTimeout from '../../hooks/useIdleTimeout';
import { useThemeMode } from '../../context/ThemeContext';
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
  const navigate = useNavigate();
  const { isAuthenticated, logout, user, customerUuid } = useAuth();
  const userAuth = useUserAuth();
  const { isDarkMode } = useThemeMode();
  // `/` is user sign-in and `/admin` is account sign-in. Both are bare only
  // while no session exists.
  const isLoginPage = ['/', '/admin'].includes(location.pathname)
    && !userAuth.isAuthenticated && !isAuthenticated;
  const isMcpWorkspace = location.pathname === '/mcp';
  // Zendesk support widget (answer bot + "Get in touch" tickets) — admin
  // console only; the portal's corner belongs to the phone FAB.
  useZendeskWidget(isAuthenticated && !isLoginPage, user, customerUuid);
  const customerDataLoadedRef = useRef(false);
  const { updateAvailable, refresh, dismiss } = useVersionCheck();

  // Security: idle session timeout (default 30 min; VITE_IDLE_TIMEOUT_MINUTES).
  // Warns 1 minute before logging out; any activity keeps the session alive.
  const { warningOpen: idleWarningOpen, staySignedIn } = useIdleTimeout({
    enabled: isAuthenticated && !isLoginPage,
    onTimeout: () => { logout(); navigate('/admin'); },
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
  const sidebarExpanded = false;
  const isMobile = useMediaQuery((t) => t.breakpoints.down('md'));
  const handleToggleSidebar = () => {
    if (isMobile) setMobileDrawerOpen(open => !open);
    else setSidebarCollapsed(collapsed => !collapsed);
  };
  const handleToggleExpand = handleToggleSidebar;

  return (
    <Box className="layout-container" data-testid="layout-container">
      {isLoginPage ? (
        // Login page — self-contained split layout inside Login component
        <Box data-testid="login-layout">
          {children}
        </Box>
      ) : (
        // Signed in — an account or a portal user, the same console: Sidebar +
        // TopBar + Content, and the right-hand sidebar where the phone opens
        // (the top bar's phone button, a clicked number, a device's "Open
        // phone"). What a user sees in it is filtered by their ACL (Sidebar,
        // TopBar, App.jsx's ProtectedRoute).
        <GlobalSearchProvider>
          <PortalSidebarProvider>
          <RecentPagesProvider>
          <Box data-testid="authenticated-layout" data-tour="welcome">
            {/* Fixed sidebar — hidden on mobile, shown via the drawer */}
            {!isMcpWorkspace && (
              <Box className="sidebar-desktop">
                <Sidebar collapsed={sidebarCollapsed} />
              </Box>
            )}

            {/* Mobile sidebar drawer */}
            {!isMcpWorkspace && <Drawer
              variant="temporary"
              open={mobileDrawerOpen}
              onClose={() => setMobileDrawerOpen(false)}
              ModalProps={{ keepMounted: true }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': { width: 112, boxSizing: 'border-box' }
              }}
            >
              <Sidebar onNavigate={() => setMobileDrawerOpen(false)} />
            </Drawer>}

            {/* TopBar — fixed at top, offset by the sidebar */}
            {!isMcpWorkspace && <TopBar
              sidebarCollapsed={sidebarCollapsed}
              sidebarExpanded={sidebarExpanded}
              onToggleSidebar={handleToggleSidebar}
              onToggleExpand={handleToggleExpand}
            />}

            {/* Main content area */}
            <Box className={`content-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarExpanded ? 'sidebar-expanded' : ''} ${isMcpWorkspace ? 'mcp-fullscreen' : ''}`} data-testid="main-content">
              <Box sx={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {children}
              </Box>
              {!isMcpWorkspace && <Box className="app-footer">
                <Typography className="app-footer-text" variant="caption" data-testid="app-version">
                  v{APP_VERSION}
                </Typography>
              </Box>}
              {/* Brand watermark — pinned bottom-right of the content area so it's
                  always visible (not at the end of scroll). */}
              {!isMcpWorkspace && <img
                className="app-watermark"
                src={isDarkMode ? LOGO_WHITE : LOGO_DARK}
                alt="VoipAppz"
              />}
            </Box>
          </Box>
          <PortalSidebar />
          </RecentPagesProvider>
          </PortalSidebarProvider>
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
