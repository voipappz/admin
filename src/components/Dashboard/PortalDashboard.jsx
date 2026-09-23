// The end user's landing screen: the live-calls dashboard scoped to the
// portal user's own environment. The body lives in LiveCallsDashboard.
import { canAccessScreen } from '../../utils/jwt';
import { useUserAuth } from '../../context/UserAuthContext.jsx';
import LiveCallsDashboard from './LiveCallsDashboard.jsx';

export default function PortalDashboard() {
  const { user, acl } = useUserAuth();
  return (
    <LiveCallsDashboard
      environmentUuid={user?.environment?.uuid || user?.environment_uuid || null}
      title={user?.name ? `Hello, ${user.name}` : 'Dashboard'}
      callsAllowed={canAccessScreen(acl, 'calls')}
      historyPath="/my-calls"
    />
  );
}
