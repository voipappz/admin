import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  setLiveSettingsScope, getLiveSettings, saveLiveSettings, resetLiveSettings,
  statusColor, stateColor, DEFAULT_STATUS_COLORS, DEFAULT_STATE_COLORS,
} from './liveSettings';

/**
 * Display settings live in the browser, not in the live documents: the store
 * holds facts, the client holds how to render them. These pin the behaviours
 * that make that safe — defaults on a cold start, a palette that survives a new
 * status being added, isolation between tenants, and a way back from an
 * unreadable palette.
 */

describe('liveSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    setLiveSettingsScope('env-a');
  });

  it('returns full defaults when nothing has been stored', () => {
    const s = getLiveSettings();
    expect(s.statusColors).toEqual(DEFAULT_STATUS_COLORS);
    expect(s.stateColors).toEqual(DEFAULT_STATE_COLORS);
    expect(s.columns.length).toBeGreaterThan(0);
  });

  it('persists an edited colour and leaves the rest at their defaults', () => {
    saveLiveSettings({ statusColors: { available: '#123456' } });
    const s = getLiveSettings();
    expect(s.statusColors.available).toBe('#123456');
    expect(s.statusColors.on_break).toBe(DEFAULT_STATUS_COLORS.on_break);
  });

  it('merges colour maps key by key, so a status added later still renders', () => {
    // A map stored before `logged_out` existed must not hide its default —
    // replacing the map wholesale would leave that chip unstyled.
    localStorage.setItem(
      'va-live-settings:env-a',
      JSON.stringify({ statusColors: { available: '#111111' } }),
    );
    expect(getLiveSettings().statusColors.logged_out).toBe(DEFAULT_STATUS_COLORS.logged_out);
  });

  it('appends a newly shipped column to a stored column list', () => {
    localStorage.setItem(
      'va-live-settings:env-a',
      JSON.stringify({ columns: [{ key: 'user_name', label: 'Name', visible: true }] }),
    );
    const keys = getLiveSettings().columns.map((c) => c.key);
    expect(keys[0]).toBe('user_name');
    expect(keys).toContain('talking_to_number');
  });

  it('keeps one tenant’s palette out of another’s', () => {
    saveLiveSettings({ statusColors: { available: '#aaaaaa' } });
    setLiveSettingsScope('env-b');
    expect(getLiveSettings().statusColors.available).toBe(DEFAULT_STATUS_COLORS.available);
    setLiveSettingsScope('env-a');
    expect(getLiveSettings().statusColors.available).toBe('#aaaaaa');
  });

  it('resets to defaults — the way back from a palette edited to unreadable', () => {
    saveLiveSettings({ statusColors: { available: '#ffffff', on_break: '#ffffff' } });
    resetLiveSettings();
    expect(getLiveSettings().statusColors).toEqual(DEFAULT_STATUS_COLORS);
  });

  it('falls back to defaults rather than throwing when localStorage is unavailable', () => {
    // Private windows and some embedded contexts throw outright on access. A
    // dashboard that fails to render because a preference could not be read is
    // worse than one rendered with defaults.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => getLiveSettings()).not.toThrow();
    expect(getLiveSettings().statusColors).toEqual(DEFAULT_STATUS_COLORS);
    spy.mockRestore();
  });

  it('survives a corrupt stored value', () => {
    localStorage.setItem('va-live-settings:env-a', '{not json');
    expect(getLiveSettings().statusColors).toEqual(DEFAULT_STATUS_COLORS);
  });

  describe('colour lookup', () => {
    it('resolves a status and a state to their configured colours', () => {
      expect(statusColor('available')).toBe(DEFAULT_STATUS_COLORS.available);
      expect(stateColor('in_a_queue_call')).toBe(DEFAULT_STATE_COLORS.in_a_queue_call);
    });

    it('is case-insensitive', () => {
      expect(statusColor('AVAILABLE')).toBe(DEFAULT_STATUS_COLORS.available);
    });

    it('returns null for an unmapped or empty value, so the chip renders unstyled', () => {
      expect(statusColor('invented_status')).toBeNull();
      expect(statusColor('')).toBeNull();
      expect(statusColor(null)).toBeNull();
    });

    it('keeps status and state as separate vocabularies', () => {
      // The deployed dashboard renders `waiting` blue as a STATE; it is not a
      // status, and must not pick up a status colour by accident.
      expect(statusColor('waiting')).toBeNull();
      expect(stateColor('waiting')).toBe(DEFAULT_STATE_COLORS.waiting);
    });
  });

  afterEach(() => {
    localStorage.clear();
  });
});
