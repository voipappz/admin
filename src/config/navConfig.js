import AssessmentIcon from '@mui/icons-material/Assessment';
import DevicesIcon from '@mui/icons-material/Devices';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import BadgeIcon from '@mui/icons-material/Badge';
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import HubIcon from '@mui/icons-material/Hub';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import SecurityIcon from '@mui/icons-material/Security';
import ArticleIcon from '@mui/icons-material/Article';
import TimelineIcon from '@mui/icons-material/Timeline';
import DnsIcon from '@mui/icons-material/Dns';
import SchemaIcon from '@mui/icons-material/Schema';
import CallIcon from '@mui/icons-material/Call';
import ChatIcon from '@mui/icons-material/Chat';
import BoltIcon from '@mui/icons-material/Bolt';
import CodeIcon from '@mui/icons-material/Code';
import { canAccessScreen } from '../utils/jwt';

// Sidebar — kept deliberately simple. The Studio is the landing/home and
// consolidates routing/services/billing; environments are picked via the
// environment selector. Everything else stays reachable through the Studio and
// ⌘K search (routes still exist), it's just off the rail.
export const NAV_ITEMS = [
  { text: 'DIDs',          path: '/routing',        iconComponent: SchemaIcon,                aclKey: 'dids',          alwaysShow: true, group: 'MANAGE'   },
  { text: 'Services',      path: '/services',       iconComponent: MiscellaneousServicesIcon, aclKey: 'services',                       group: 'MANAGE'   },
  { text: 'Devices',       path: '/extensions',     iconComponent: DevicesIcon,               aclKey: 'extensions',                     group: 'MANAGE'   },
  { text: 'Subscriptions', path: '/subscriptions',  iconComponent: LoyaltyIcon,               aclKey: 'subscriptions',                  group: 'MANAGE'   },
  // Tariffs sit next to Subscriptions: they're the rate books subscriptions
  // bill against, and were previously only reachable through the picker
  // embedded in other dialogs.
  { text: 'Tariffs',       path: '/tariffs',        iconComponent: RequestQuoteIcon,          aclKey: 'tariffs',                        group: 'MANAGE'   },
  // The end-user portal's widget dashboard, mounted in the console too. Gated
  // on `reports` — the console's ACLs carry no dashboard key.
  { text: 'Dashboard',     path: '/admin/dashboard', iconComponent: HomeIcon,                 aclKey: 'reports',                        group: 'MONITOR'  },
  // Live and Phone are not in this rail: they are user-portal screens only
  // (UserRail.jsx), and App.jsx sends an admin session away from both.
  { text: 'Calls',         path: '/calls',          iconComponent: CallIcon,                  aclKey: 'calls',                          group: 'MONITOR'  },
  { text: 'Messages',      path: '/messages',       iconComponent: ChatIcon,                  aclKey: 'calls',                          group: 'MONITOR'  },
  // Logs has no rail entry on purpose: a log stream is only meaningful next to
  // the record that produced it, so it opens as a modal from a record's
  // "View Logs" action (useNavigateToLogs → openLogsModal). The /logs route
  // still exists for direct URLs and the modal's "Open full page".
  // Events is the operational half of the pair: Logs reads the InfluxDB syslog
  // stream, Events reads the Postgres event store (a log line naming an `action`
  // becomes an event — see config/initializers/log.rb). The route existed at
  // /events but had no rail entry, so the screen was only reachable via ⌘K.
  { text: 'Events',        path: '/events',         iconComponent: BoltIcon,                  aclKey: 'logs',                           group: 'MONITOR'  },
  { text: 'Monitoring',    path: '/monitoring',     iconComponent: TimelineIcon,              aclKey: 'monitors',                       group: 'MONITOR'  },
  // Every node with full CRUD over the nodes API (writes are root-only, so the
  // buttons show for root). Same screen as Monitoring's Nodes section.
  { text: 'Nodes',         path: '/nodes',          iconComponent: DnsIcon,                   aclKey: 'nodes',                          group: 'MONITOR'  },
  { text: 'Reports',       path: '/reports',        iconComponent: AssessmentIcon,            aclKey: 'reports',                        group: 'MONITOR'  },
  { text: 'Users',         path: '/users',          iconComponent: PeopleIcon,                aclKey: 'users',                          group: 'MANAGE'   },
  { text: 'Accounts',      path: '/accounts',       iconComponent: BadgeIcon,                 aclKey: 'accounts',                       group: 'MANAGE'   },
  { text: 'Providers',     path: '/providers',      iconComponent: HubIcon,                   aclKey: 'providers',                      group: 'MANAGE'   },
];

// Professional / configuration screens — rendered as a pinned section at the
// bottom of the left sidebar (no popup). Name kept for back-compat: also consumed
// by global search (CommandPalette) and breadcrumbs (findNavItemByPath).
// Settings is not here — it's a gear button in the topbar (see TopBar.jsx),
// not a left-menu item.
export const TOPBAR_NAV_ITEMS = [
  { text: 'Templates',     path: '/templates',      iconComponent: ArticleIcon,               aclKey: 'templates',                      group: 'ADMIN'    },
  { text: 'API Docs',      path: '/devzone',        iconComponent: CodeIcon,                                                          group: 'ADMIN'    },
  // Moved out of the main NAV_ITEMS list — ACL management isn't a screen an
  // admin browses day-to-day, it belongs in the same pinned/lower-profile
  // section as Templates and API Docs.
  { text: 'ACLs',          path: '/acls',           iconComponent: SecurityIcon,              aclKey: 'acls',                           group: 'ADMIN'    },
];

export function getPermittedNavItems(acl) {
  return NAV_ITEMS.filter(item => {
    if (item.alwaysShow) return true;
    if (!item.aclKey) return true; // utility screens (e.g. Settings) — no ACL gate
    if (!acl) return false;
    return canAccessScreen(acl, item.aclKey);
  });
}

export function getPermittedTopbarItems(acl) {
  return TOPBAR_NAV_ITEMS.filter(item => {
    if (!item.aclKey) return true; // utility screens (e.g. Settings) — no ACL gate
    if (!acl) return false;
    return canAccessScreen(acl, item.aclKey);
  });
}

export function findNavItemByPath(pathname) {
  const all = [...NAV_ITEMS, ...TOPBAR_NAV_ITEMS];
  return all.find(item => item.path === pathname) || null;
}
