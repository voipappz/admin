import { describe, expect, it } from 'vitest';
import { canUserEnterRoute } from './App';

describe('user route guard policy', () => {
  const canAccess = (key) => key === 'calls';

  it('admits a route granted by the user ACL', () => {
    expect(canUserEnterRoute('calls', canAccess)).toBe(true);
  });

  it('denies an ACL key the user lacks and every key-less account route', () => {
    expect(canUserEnterRoute('settings', canAccess)).toBe(false);
    expect(canUserEnterRoute(undefined, canAccess)).toBe(false);
  });
});
