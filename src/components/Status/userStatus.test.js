import { describe, expect, it } from 'vitest';
import { findCurrentUserStatus, mergeLiveUserStatus, normalizeUserStatus } from './userStatus';

describe('user status normalization', () => {
  it('reads the va-crystal user state fields without changing their meaning', () => {
    expect(normalizeUserStatus({
      uuid: 'u-9019', status_name: 'Available', state: 'waiting', call_counter: '7',
      last_call_at: '1786525074', talking_to_number: '2335550100', active_queue_name: 'Support',
    })).toMatchObject({
      uuid: 'u-9019', availability: 'Available', state: 'waiting', callCount: 7,
      lastCallAt: '1786525074', talkingTo: '2335550100', queue: 'Support',
    });
  });

  it('selects the signed-in user rather than another live agent', () => {
    const rows = [{ uuid: 'u-1', call_counter: 10 }, { uuid: 'u-9019', call_counter: 3 }];
    expect(findCurrentUserStatus(rows, { user_uuid: 'u-9019' })?.callCount).toBe(3);
  });
});

describe('mergeLiveUserStatus', () => {
  const polled = {
    uuid: 'u1', extension: '3005', availability: 'Available', availabilityType: 'available',
    state: 'waiting', callCount: 7, talkingTo: '', queue: 'support',
  };

  it('returns the polled row untouched when no live view has arrived', () => {
    expect(mergeLiveUserStatus(polled, {})).toBe(polled);
    expect(mergeLiveUserStatus(polled, null)).toBe(polled);
  });

  it('lets a live field win over the polled one', () => {
    const merged = mergeLiveUserStatus(polled, { state: 'in_a_queue_call', talking_to_number: '0501234567' });
    expect(merged.state).toBe('in_a_queue_call');
    expect(merged.talkingTo).toBe('0501234567');
  });

  it('does not blank polled fields the live frame did not carry', () => {
    // A `user.state_change` event carries one field. Normalizing it fills the
    // rest with defaults, and writing those would erase what polling had right.
    const merged = mergeLiveUserStatus(polled, { state: 'receiving' });
    expect(merged.extension).toBe('3005');
    expect(merged.callCount).toBe(7);
    expect(merged.availability).toBe('Available');
  });

  it('accumulates the counter the server fold produced', () => {
    const merged = mergeLiveUserStatus(polled, { state: 'waiting', call_counter: '9' });
    expect(merged.callCount).toBe(9);
  });
});
