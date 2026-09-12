import { describe, it, expect } from 'vitest';
import { extUsernameFromUserDetail } from './QueueBridge.jsx';

describe('extUsernameFromUserDetail — agent extension from /api/users/<uuid>', () => {
  it('reads the username from the type:extension resource', () => {
    const detail = { uuid: 'u1', resources: [
      { type: 'queue', type_uuid: 'q1', name: 'Sales' },
      { type: 'extension', type_uuid: 'e1', username: '1001', name: 'Front desk' },
    ]};
    expect(extUsernameFromUserDetail(detail)).toBe('1001');
  });

  it('falls back to the resource name when it has no username', () => {
    const detail = { resources: [{ type: 'Extension', type_uuid: 'e1', name: '1002' }] };
    expect(extUsernameFromUserDetail(detail)).toBe('1002');
  });

  it('unwraps a { data: {...} } response', () => {
    const detail = { data: { resources: [{ type: 'extension', username: '1003' }] } };
    expect(extUsernameFromUserDetail(detail)).toBe('1003');
  });

  it('falls back to inline user fields when there is no extension resource', () => {
    expect(extUsernameFromUserDetail({ username: '1004', resources: [] })).toBe('1004');
    expect(extUsernameFromUserDetail({ extension: { username: '1005' } })).toBe('1005');
  });

  it('returns empty string when nothing is available', () => {
    expect(extUsernameFromUserDetail(null)).toBe('');
    expect(extUsernameFromUserDetail({})).toBe('');
    expect(extUsernameFromUserDetail({ resources: [{ type: 'queue', name: 'Q' }] })).toBe('');
  });
});
