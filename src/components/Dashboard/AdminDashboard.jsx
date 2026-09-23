// The same live-calls dashboard, for the account console — a pilot. An admin
// session used to be sent away from the widget dashboard on the grounds that
// Calls, Reports and Monitoring answer the same questions; this is the fast
// "is anything happening right now" view instead of a table, scoped to the
// admin's selected customer and environment.
//
// The live channel follows ONE environment (LiveChannel subscribes per
// environment_uuid), so with several selected it follows the first; the recent
// calls list is server-scoped to all of them, like the Calls screen.
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext.jsx';
import { usePermissions } from '../../hooks/usePermissions';
import LiveCallsDashboard from './LiveCallsDashboard.jsx';

export default function AdminDashboard() {
  const { selectedCustomer, selectedEnvironments } = useCustomerEnvironment();
  const { can } = usePermissions();
  const environment = selectedEnvironments?.[0] || null;
  const scope = [selectedCustomer?.name, environment?.name].filter(Boolean).join(' · ');

  return (
    <LiveCallsDashboard
      environmentUuid={environment?.uuid || null}
      title="Dashboard"
      subtitle={scope ? `Live activity for ${scope}` : 'Select an application to see live activity'}
      callsAllowed={can('calls', 'read')}
      historyPath="/calls"
      testId="admin-dashboard-page"
    />
  );
}
