import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCallNumber, useOpenPhoneAs } from './useCallNumber';

const open = vi.fn();
vi.mock('../context/PortalSidebarContext', () => ({ usePortalSidebar: () => ({ open }) }));

describe('useCallNumber', () => {
  // A click on a number opens the phone on the right with the number in the
  // dialpad. It does not dial: a click in a table is not a decision to call.
  it('opens the phone with the number ready to dial', () => {
    const { result } = renderHook(() => useCallNumber());
    result.current('+972 (3) 555-1234');
    expect(open).toHaveBeenCalledWith('phone', { tab: 'dialpad', number: '+97235551234' });
  });

  it('ignores an empty number', () => {
    open.mockClear();
    const { result } = renderHook(() => useCallNumber());
    result.current('  ');
    expect(open).not.toHaveBeenCalled();
  });
});

describe('useOpenPhoneAs', () => {
  it('opens the phone signed in as a device', () => {
    const { result } = renderHook(() => useOpenPhoneAs());
    const device = { uuid: 'dev-1', username: '201' };
    result.current(device);
    expect(open).toHaveBeenCalledWith('phone', { tab: 'dialpad', device });
  });
});
