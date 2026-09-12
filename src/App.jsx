import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useParams } from 'react-router';
import { Suspense, lazy } from 'react';
// Sentry is initialized in main.jsx
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserAuthProvider, useUserAuth } from './context/UserAuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { CustomerEnvironmentProvider } from './context/CustomerEnvironmentContext';
import { TourProvider } from './context/TourContext';
import { ThemeProvider } from './context/ThemeContext';
import { PhoneProvider } from './context/PhoneContext';
import { SoftphoneProvider } from './context/SoftphoneContext.jsx';
import { QueryProvider } from './providers/QueryProvider';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import Layout from './components/Layout/Layout.jsx';
import { TourOverlay } from './components/Tour';
import { usePermissions } from './hooks/usePermissions';
import { canAccessScreen } from './utils/jwt';
import { CircularProgress, Box, Typography, Button } from '@mui/material';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
const muiTheme = createTheme({
  // voipappz brand indigo — the exact color from the reports date selector,
  // now the primary action color for buttons/toggles across the whole app.
  palette: {
    primary: {
      main: '#5c6bc0',
      dark: '#3f4fb5',
      light: '#7986cb',
      contrastText: '#ffffff',
    },
  },
  typography: {
    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
    fontSize: 15,
    h1: { fontFamily: "'Rubik', sans-serif", fontWeight: 600 },
    h2: { fontFamily: "'Rubik', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Rubik', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Rubik', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Rubik', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Rubik', sans-serif", fontWeight: 600 },
    subtitle1: { fontFamily: "'Rubik', sans-serif", fontWeight: 500 },
    subtitle2: { fontFamily: "'Rubik', sans-serif", fontWeight: 500 },
    body1: { fontFamily: "'Rubik', sans-serif", fontSize: '0.9375rem' },
    body2: { fontFamily: "'Rubik', sans-serif", fontSize: '0.875rem' },
    button: { fontFamily: "'Rubik', sans-serif", fontWeight: 500, textTransform: 'none' },
    caption: { fontFamily: "'Rubik', sans-serif" },
    overline: { fontFamily: "'Rubik', sans-serif" },
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontFamily: "'Rubik', sans-serif",
          fontSize: '0.8rem',
          padding: '8px 14px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 320,
        },
        head: {
          fontWeight: 600,
          fontSize: '0.72rem',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          backgroundColor: 'var(--theme-bg-primary, #fff)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: 'rgba(101, 117, 142, 0.04)' },
        },
      },
    },
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: {
        root: { borderRadius: '6px' },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontFamily: "'Rubik', sans-serif", fontSize: '0.9375rem' },
      },
    },
    // Menu paper is capped so a long option (a customer name like "LAURUS
    // AFRICA SECURITIES LTD") can't stretch the dropdown across the screen;
    // the item then ellipsises inside it instead of overflowing.
    MuiMenu: {
      styleOverrides: {
        paper: { maxWidth: 'min(480px, calc(100vw - 32px))' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: "'Rubik', sans-serif",
          fontSize: '0.9rem',
          overflow: 'hidden',
          // MenuItem is a flex row: a label element only shrinks once its
          // automatic min-width is cleared. ListItemIcon is left alone so its
          // gutter survives.
          '& > .MuiBox-root, & > .MuiTypography-root, & > span': {
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontFamily: "'Rubik', sans-serif", fontSize: '0.8rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: "'Rubik', sans-serif", maxWidth: '100%' },
        // Chip already ellipsises its label; the cap stops one long resource
        // name from making a chip wider than the row that holds it.
        label: { fontWeight: 500, maxWidth: 280 },
      },
    },
  },
});

// Eager: Login and UserLogin are the entry points for unauthenticated users
import Login from './components/Login/Login.jsx';
import UserLogin from './components/Login/UserLogin.jsx';

// Lazy-load all other route components for code splitting
const Reports = lazy(() => import('./components/Reports/Reports.jsx'));
const LiveDashboard = lazy(() => import('./components/LiveDashboard/LiveDashboard.jsx'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard.jsx'));
const Phone = lazy(() => import('./components/Phone/PhoneScreen.jsx'));
// The PORTAL's call history — deliberately not the admin Calls screen
// (/calls), which is built around dynamic field configs and saved segments.
const PortalCalls = lazy(() => import('./components/PortalCalls/PortalCalls.jsx'));
const Calls = lazy(() => import('./components/Calls/Calls.jsx'));

const Notifications = lazy(() => import('./components/Notifications/Notifications.jsx'));
const Users = lazy(() => import('./components/Users/Users.jsx'));
const Account = lazy(() => import('./components/Account/Account.jsx'));
const Accounts = lazy(() => import('./components/Accounts/Accounts.jsx'));
const Acls = lazy(() => import('./components/Acls/Acls.jsx'));
const Subscriptions = lazy(() => import('./components/Subscriptions/Subscriptions.jsx'));
const Providers = lazy(() => import('./components/Providers/Providers.jsx'));
const Environments = lazy(() => import('./components/Environments/Environments.jsx'));
const DIDs = lazy(() => import('./components/DIDs/DIDs.jsx'));
const PBXRouting = lazy(() => import('./components/PBXRouting/PBXRoutingView.jsx'));
// Routing lands on the DIDs LIST; the flow canvas opens only via a row's
// Edit button (?did=...). Closing the canvas returns to the list.
const DIDsList = lazy(() => import('./components/DIDs/DIDs.jsx'));
const RoutingScreen = () => {
  const [params, setParams] = useSearchParams();
  return params.get('did')
    ? <PBXRouting onClose={() => setParams({}, { replace: true })} />
    : <DIDsList />;
};
// /dids/:id deep link — per-DID edit is the visual routing flow.
const DIDEditRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/routing?did=${id}`} replace />;
};
const CommsLog = lazy(() => import('./components/CommsLog/CommsLog.jsx'));
const Services = lazy(() => import('./components/Studio/ServicesStudio.jsx'));
const BillingStudio = lazy(() => import('./components/Studio/BillingStudio.jsx'));
const Events = lazy(() => import('./components/Events/Events.jsx'));
const LogsScreen = lazy(() => import('./views/syslogs/LogsScreen.jsx'));
const Bots = lazy(() => import('./components/Bots/Bots.jsx'));
const CallsLog = lazy(() => import('./components/CallsLog/CallsLog.jsx'));
const HealthMonitor = lazy(() => import('./components/HealthMonitor/HealthMonitor.jsx'));
const Extensions = lazy(() => import('./components/Extensions/Extensions.jsx'));
const AIChat = lazy(() => import('./components/AIChat/AIChat.jsx'));
const Messages = lazy(() => import('./components/Messages/Messages.jsx'));
const Monitoring = lazy(() => import('./components/Monitoring/Monitoring.jsx'));
const Workflows = lazy(() => import('./components/Workflows/Workflows.jsx'));
const Campaigns = lazy(() => import('./components/Campaigns/Campaigns.jsx'));
const Templates = lazy(() => import('./components/Templates/Templates.jsx'));
const Tariffs = lazy(() => import('./components/Tariffs/Tariffs.jsx'));
const Schema = lazy(() => import('./components/Appz/Schema.jsx'));
const Transactions = lazy(() => import('./components/Transactions/Transactions.jsx'));
const Settings = lazy(() => import('./components/Settings/Settings.jsx'));
const ApiDocs = lazy(() => import('./components/ApiDocs/ApiDocs.jsx'));

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <CircularProgress size={36} />
  </Box>
);

// MODULE SCOPE ON PURPOSE. Defined inside AppContent it was a new component
// identity on every render, so React remounted the whole subtree — including
// Layout, which owns the phone dock's open state. The dock opened and shut
// itself within ~300ms.
//
// `/` IS the end-user portal: the login when signed out, the dashboard
// when signed in. The portal is one screen with the phone docked beside it,
// so the dashboard sits at the root rather than one hop inside it — there
// is nothing for a "home" that isn't the dashboard to be.
//
// An admin session gets sent to its own console instead; the account
// surface's front door is /admin.
const PortalRoot = () => {
  const admin = useAuth();
  const user = useUserAuth();
  if (admin.initializing || user.initializing) return null;
  if (user.isAuthenticated) {
    return canAccessScreen(user.acl, 'dashboard')
      ? <Layout><Dashboard /></Layout>
      : <Layout><PortalCalls /></Layout>;
  }
  if (admin.isAuthenticated) return <Navigate to="/calls" replace />;
  return <Layout><UserLogin /></Layout>;
};

function AppContent() {
  // Define route guards INSIDE AppContent so they're guaranteed to be inside AuthProvider
  const ProtectedRoute = ({ children, requiredAcl }) => {
    const { isAuthenticated, initializing } = useAuth();
    const { canAccess } = usePermissions();

    // Wait for AuthContext to finish initializing (restoring auth from localStorage)
    // This prevents race conditions where API calls happen before auth is restored
    if (initializing) {
      return null; // Show nothing while auth is being restored
    }

    // After initialization is complete, check if user is authenticated
    // AuthContext handles all token validation using JWT exp claim
    if (!isAuthenticated) return <Navigate to="/admin" replace />;

    // ACL route protection: block access if user lacks read/index/list permission.
    // Bounce to /account, which carries no requiredAcl — sending a denial to an
    // ACL-guarded route (as /live -> /reports did) loops forever for a user who
    // lacks that ACL.
    if (requiredAcl && !canAccess(requiredAcl)) {
      return <Navigate to="/account" replace />;
    }

    return children;
  };

  const PublicRoute = ({ children }) => {
    const { isAuthenticated, initializing } = useAuth();

    // Wait for AuthContext to finish initializing
    if (initializing) {
      return null;
    }

    // Already signed in and sitting on /admin → straight to the landing screen (Calls).
    return !isAuthenticated ? children : <Navigate to="/calls" replace />;
  };

  // Dashboard and Phone are shared, ACL-gated screens usable from EITHER
  // surface (confirmed: one route each, not separate namespaces per surface).
  // Whichever session is active decides which ACL system gates the screen;
  // the screen itself reads useAuth()/useUserAuth() to pick its data scoping
  // (selected environment vs. the user's own environment_uuid).
  // Portal-only screens. The widget dashboard is the END USER's landing
  // screen; the account console answers the same questions with Calls,
  // Reports and Monitoring, so an admin session has no business here and is
  // sent to its own landing screen rather than shown a second dashboard.
  const PortalRoute = ({ children, aclKey }) => {
    const admin = useAuth();
    const user = useUserAuth();
    if (admin.initializing || user.initializing) return null;
    if (admin.isAuthenticated) return <Navigate to="/calls" replace />;
    if (!user.isAuthenticated) return <Navigate to="/" replace />;
    return canAccessScreen(user.acl, aclKey) ? children : <Navigate to="/" replace />;
  };

  // Live is the user's dashboard, but an admin has to be able to open it too —
  // to check it, and because the account console answers the same question.
  // DualProtectedRoute can't serve both: it checks ONE aclKey against whichever
  // session is active, and the vocabularies differ (admin ACLs are plural —
  // `reports`; portal ACLs are singular — `dashboard`). So each surface is
  // checked against its own key.
  const LiveRoute = ({ children }) => {
    const admin = useAuth();
    const user = useUserAuth();
    const { canAccess } = usePermissions();

    if (admin.initializing || user.initializing) return null;
    if (admin.isAuthenticated) {
      return canAccess('reports') ? children : <Navigate to="/account" replace />;
    }
    if (user.isAuthenticated) {
      return canAccessScreen(user.acl, 'dashboard') ? children : <Navigate to="/" replace />;
    }
    return <Navigate to="/" replace />;
  };

  const DualProtectedRoute = ({ children, aclKey }) => {
    const admin = useAuth();
    const user = useUserAuth();
    const { canAccess } = usePermissions();

    if (admin.initializing || user.initializing) return null;

    if (admin.isAuthenticated) {
      return canAccess(aclKey) ? children : <Navigate to="/account" replace />;
    }
    if (user.isAuthenticated) {
      // Phone is always available to a signed-in portal user, unconditional
      // on ACL — mirrors app, where the phone icon was just always there,
      // never gated. (It's also reachable without navigating here at all via
      // the persistent PhoneFab — see Layout.jsx/PhoneFab.jsx.)
      if (aclKey === 'phone') return children;
      return canAccessScreen(user.acl, aclKey) ? children : <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  };

  return (
    <Router>
      <Suspense fallback={<Layout><PageLoader /></Layout>}>
      <Routes>
        {/* `/` is the end-user (customer) front door; `/admin` is the account
            surface this Login has always been. `/login` is kept as a bare
            redirect so old admin bookmarks still land somewhere. */}
        <Route path="/" element={<PortalRoot />} />
        <Route
          path="/admin"
          element={
            <PublicRoute>
              <Layout>
                <Login />
              </Layout>
            </PublicRoute>
          }
        />
        <Route path="/login" element={<Navigate to="/admin" replace />} />
        {/* /live was a redirect to /reports while there was no live screen to
            show. It is now the Live Dashboard: widget-defined columns over the
            live agent list, counted into the pills and tiles beside it. */}
        {/* Live is the END USER's dashboard, not an admin screen: it answers
            "what is my team doing right now" for the person working the
            queue. PortalRoute enforces that — an admin session is sent to its
            own landing screen rather than shown a second dashboard, exactly
            as the widget Dashboard already does. `dashboard` is the portal
            ACL key (portal ACLs are singular: call/report/dashboard, not the
            admin's plural). */}
        <Route
          path="/live"
          element={
            <LiveRoute>
              <Layout>
                <LiveDashboard />
              </Layout>
            </LiveRoute>
          }
        />
        {/* The dashboard lives AT the portal's root, not beside it — see
            PortalRoot. This path is kept so existing links still work. */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route
          path="/my-calls"
          element={
            <DualProtectedRoute aclKey="calls">
              <Layout>
                <PortalCalls />
              </Layout>
            </DualProtectedRoute>
          }
        />
        <Route
          path="/phone"
          element={
            <DualProtectedRoute aclKey="phone">
              <Layout>
                <Phone />
              </Layout>
            </DualProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredAcl="reports">
              <Layout>
                <Reports />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route 
          path="/calls"
          element={
            <ProtectedRoute requiredAcl="calls">
              <Layout>
                <Calls />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute requiredAcl="notifications">
              <Layout>
                <Notifications />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/health-monitor"
          element={
            <ProtectedRoute requiredAcl="monitors">
              <Layout>
                <HealthMonitor />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredAcl="users">
              <Layout>
                <Users />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Layout>
                <Account />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/customer"
          element={
            <ProtectedRoute>
              <Layout>
                <Account />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <ProtectedRoute requiredAcl="accounts">
              <Layout>
                <Accounts />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/acls"
          element={<ProtectedRoute requiredAcl="acls"><Layout><Acls /></Layout></ProtectedRoute>}
        />
        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute requiredAcl="subscriptions">
              <Layout>
                <Subscriptions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute requiredAcl="subscriptions">
              <Layout>
                <Transactions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/providers"
          element={
            <ProtectedRoute requiredAcl="providers">
              <Layout>
                <Providers />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/environments"
          element={
            <ProtectedRoute requiredAcl="environments">
              <Layout>
                <Environments />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/services"
          element={
            <ProtectedRoute requiredAcl="services">
              <Layout>
                <Services />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute requiredAcl="subscriptions">
              <Layout>
                <BillingStudio />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute requiredAcl="logs">
              <Layout>
                <Events />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute requiredAcl="logs">
              <Layout>
                <LogsScreen />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/schema"
          element={
            <ProtectedRoute requiredAcl="schemas">
              <Layout>
                <Schema />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bots"
          element={
            <ProtectedRoute requiredAcl="bots">
              <Layout>
                <Bots />
              </Layout>
            </ProtectedRoute>
          }
        />


        <Route
          path="/calls-log"
          element={
            <ProtectedRoute>
              <Layout>
                <CallsLog />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dids"
          element={
            <ProtectedRoute requiredAcl="dids">
              <Layout>
                <DIDs />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Per-DID edit deep link — editing a DID happens on the visual
            routing flow (React Flow canvas), so forward to it. */}
        <Route path="/dids/:id" element={<DIDEditRedirect />} />
        <Route
          path="/routing"
          element={
            <ProtectedRoute requiredAcl="dids">
              <Layout>
                <RoutingScreen />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-log"
          element={
            <ProtectedRoute requiredAcl="calls">
              <Layout>
                <CommsLog />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/extensions"
          element={
            <ProtectedRoute requiredAcl="extensions">
              <Layout>
                <Extensions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute requiredAcl="messages">
              <Layout>
                <Messages />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <Layout>
                <Monitoring />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute requiredAcl="campaigns">
              <Layout>
                <Campaigns />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute requiredAcl="templates">
              <Layout>
                <Templates />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tariffs"
          element={
            <ProtectedRoute requiredAcl="tariffs">
              <Layout>
                <Tariffs />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/devzone"
          element={
            <ProtectedRoute>
              <Layout>
                <ApiDocs />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/api-docs" element={<Navigate to="/devzone" replace />} />
        <Route
          path="/workflow"
          element={
            <ProtectedRoute requiredAcl="workflows">
              <Layout>
                <Workflows />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai"
          element={
            <ProtectedRoute>
              <Layout>
                <AIChat />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Catch-all 404 — auth-gated like every other route so a hard load of
            an unknown URL cannot mount Layout and fire protected API requests
            before AuthContext has restored the session. */}
        <Route path="*" element={
          <ProtectedRoute>
          <Layout>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2, color: 'var(--theme-text-secondary)' }}>
              <Typography variant="h4" sx={{ fontWeight: 600, color: 'var(--theme-text-primary)' }}>404</Typography>
              <Typography variant="body1">No route matched this URL.</Typography>
              <Button variant="outlined" size="small" onClick={() => window.location.href = '/reports'} sx={{ mt: 1, textTransform: 'none' }}>
                Go to Reports
              </Button>
            </Box>
          </Layout>
          </ProtectedRoute>
        } />
      </Routes>
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <MuiThemeProvider theme={muiTheme}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <UserAuthProvider>
                {/* Mounted above the Router (and above both auth providers, so
                    it can see either session) so SIP registration and any
                    active call survive page navigation — see SoftphoneContext.jsx. */}
                <SoftphoneProvider>
                  <NotificationProvider>
                    <CustomerEnvironmentProvider>
                      <PhoneProvider>
                      <TourProvider>
                        <AppContent />
                        <TourOverlay />
                      </TourProvider>
                      </PhoneProvider>
                    </CustomerEnvironmentProvider>
                  </NotificationProvider>
                </SoftphoneProvider>
              </UserAuthProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </MuiThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
