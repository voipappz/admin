import { describe, it, expect } from 'vitest';
import { getPermittedNavItems, getPermittedTopbarItems, findNavItemByPath } from './navConfig';

// The nodes list (MonitoringNodes) has its own sidebar entry and its own ACL
// key, "nodes" (it used to ride on "monitors"; the API's
// `rake va:acl_grant_nodes` gave existing ACLs the same access).
describe('navConfig Nodes entry', () => {
  const withNodes = { data: { nodes: { main: ['read', 'write'] } } };
  const withOnlyMonitors = { data: { monitors: { main: ['read', 'write'] } } };

  it('lists Nodes at /nodes for an account with nodes access', () => {
    const paths = getPermittedNavItems(withNodes).map((item) => item.path);
    expect(paths).toContain('/nodes');
    expect(findNavItemByPath('/nodes')).toMatchObject({ text: 'Nodes', aclKey: 'nodes' });
  });

  it('hides Nodes from an account without nodes access', () => {
    const paths = getPermittedNavItems(withOnlyMonitors).map((item) => item.path);
    expect(paths).not.toContain('/nodes');
  });
});
// Live is back in the account console (it was portal-only from 8cc1555). Gated
// on `reports`: the console's ACLs carry no `dashboard` key.
describe('navConfig Live entry', () => {
  it('lists Live at /live, above Calls, for an account with reports access', () => {
    const acl = { data: { reports: { main: ['read'] }, calls: { main: ['read'] } } };
    const paths = getPermittedNavItems(acl).map((item) => item.path);
    expect(paths).toContain('/live');
    expect(paths.indexOf('/live')).toBeLessThan(paths.indexOf('/calls'));
    expect(findNavItemByPath('/live')).toMatchObject({ text: 'Live', aclKey: 'reports' });
  });

  it('hides Live from an account without reports access', () => {
    const acl = { data: { calls: { main: ['read'] } } };
    expect(getPermittedNavItems(acl).map((item) => item.path)).not.toContain('/live');
  });
});

// A portal user signs in to the same console, and shares the account's ACL
// model: the same items, filtered by the user's ACL, strictly — an item with
// no ACL key (or alwaysShow) is an account affordance and is not shown.
describe('navConfig for a user session (strict)', () => {
  // Portal ACLs spell keys singular; the check falls back to that spelling.
  const userAcl = { data: { call: { main: ['read'] }, report: { main: ['read'] } } };

  it('shows the items the user ACL grants', () => {
    const paths = getPermittedNavItems(userAcl, { strict: true }).map((i) => i.path);
    expect(paths).toContain('/calls');
    expect(paths).toContain('/live');
  });

  it('hides alwaysShow and key-less items, and what the ACL does not grant', () => {
    const paths = getPermittedNavItems(userAcl, { strict: true }).map((i) => i.path);
    expect(paths).not.toContain('/routes');      // alwaysShow for an account
    expect(paths).not.toContain('/extensions');  // not granted
    expect(getPermittedTopbarItems(userAcl, { strict: true }).map((i) => i.path)).not.toContain('/devzone'); // no key
  });

  it('shows nothing without an ACL', () => {
    expect(getPermittedNavItems(null, { strict: true })).toEqual([]);
  });
});
