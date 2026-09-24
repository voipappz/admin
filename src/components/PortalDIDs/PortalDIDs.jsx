// The portal's Numbers screen (/my-dids).
//
// Deliberately the SAME component as the console's /dids, not a portal copy of
// it: DIDs carries the wizard, seven bridge editors, duplicate and delete, and
// a fork would lose parity with the console within a release. What differs
// between the surfaces is scope and a handful of admin-only deep links, and
// both are handled without a second implementation — scope by
// CustomerEnvironmentContext resolving to the portal user's own environment,
// the deep links by the `portalMode` flag below.
import DIDs from '../DIDs/DIDs.jsx';

const PortalDIDs = () => <DIDs portalMode />;

export default PortalDIDs;
