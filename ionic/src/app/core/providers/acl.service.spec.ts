import { AclService } from './acl.service';

describe('AclService', () => {
  let svc: AclService;

  beforeEach(() => {
    svc = new AclService();
  });

  it('denies everything before abilities are set', () => {
    expect(svc.can('go_to_page', 'calls')).toBe(false);
  });

  it('allows go_to_page when the page main includes "read"', () => {
    svc.setAbilities({ calls: { main: ['read', 'write'] } });
    expect(svc.can('go_to_page', 'calls')).toBe(true);
  });

  it('denies go_to_page for a page without read', () => {
    svc.setAbilities({ calls: { main: ['write'] }, dids: {} });
    expect(svc.can('go_to_page', 'calls')).toBe(false);
    expect(svc.can('go_to_page', 'dids')).toBe(false);
    expect(svc.can('go_to_page', 'unknown')).toBe(false);
  });

  it('access_in_page checks the component action', () => {
    svc.setAbilities({ calls: { edit_btn: ['read', 'write'] } });
    expect(svc.can('access_in_page', 'calls', 'write', 'edit_btn')).toBe(true);
    expect(svc.can('access_in_page', 'calls', 'delete', 'edit_btn')).toBe(false);
    expect(svc.can('access_in_page', 'calls', 'write', 'missing')).toBe(false);
  });

  it('handles null/undefined abilities gracefully', () => {
    svc.setAbilities(null);
    expect(svc.can('go_to_page', 'calls')).toBe(false);
    svc.setAbilities(undefined);
    expect(svc.can('access_in_page', 'calls', 'read', 'x')).toBe(false);
  });

  it('returns false for unknown ability types', () => {
    svc.setAbilities({ calls: { main: ['read'] } });
    expect(svc.can('do_magic', 'calls')).toBe(false);
  });
});
