import { describe, it, expect } from 'vitest';
import { getPermittedNavItems, findNavItemByPath } from './navConfig';

// The nodes list (MonitoringNodes) used to be reachable only as a section at
// the bottom of Monitoring. It has its own sidebar entry, gated like Monitoring.
describe('navConfig Nodes entry', () => {
  const withMonitors = { data: { monitors: { main: ['read', 'write'] } } };
  const withoutMonitors = { data: { calls: { main: ['read'] } } };

  it('lists Nodes at /nodes for an account that can open Monitoring', () => {
    const paths = getPermittedNavItems(withMonitors).map((item) => item.path);
    expect(paths).toContain('/nodes');
    expect(findNavItemByPath('/nodes')).toMatchObject({ text: 'Nodes', aclKey: 'monitors' });
  });

  it('hides Nodes from an account without monitors access', () => {
    const paths = getPermittedNavItems(withoutMonitors).map((item) => item.path);
    expect(paths).not.toContain('/nodes');
  });
});
