import { describe, it, expect, vi } from 'vitest';
import { buildPortalCommands, looksLikeNumber } from './usePortalCommands';

const on = () => ({ go: vi.fn(), phone: vi.fn(), ask: vi.fn(), dial: vi.fn(), searchCalls: vi.fn(), theme: vi.fn(), density: vi.fn(), logout: vi.fn() });
const labels = (groups, name) => groups.find((g) => g.label === name)?.items.map((i) => i.label) ?? [];

// The line's rows are the portal's whole menu, so what shows is a unit test.
describe('buildPortalCommands', () => {
  it('shows the places this user may go, then the settings, with nothing typed', () => {
    const groups = buildPortalCommands({ query: '', liveAllowed: true, callsAllowed: true, dark: false, compact: false, on: on() });
    expect(groups.map((g) => g.label)).toEqual(['Go to', 'Settings']);
    expect(labels(groups, 'Go to')).toEqual(['Calls', 'Live', 'Phone']);
    expect(labels(groups, 'Settings')).toEqual(['Dark appearance', 'Compact rows', 'Sign out']);
  });

  it('hides Live and Calls for a user without those permissions', () => {
    const groups = buildPortalCommands({ query: '', liveAllowed: false, callsAllowed: false, on: on() });
    expect(labels(groups, 'Go to')).toEqual(['Phone']);
    expect(groups.find((g) => g.label === 'Calls')).toBeUndefined();
  });

  it('offers to call a typed number, and to search calls for it', () => {
    const cb = on();
    const groups = buildPortalCommands({ query: '050-123 4567', callsAllowed: true, on: cb });
    expect(labels(groups, 'Calls')).toEqual(['Call 050-123 4567', 'Search calls for “050-123 4567”']);
    groups.find((g) => g.label === 'Calls').items[0].action();
    expect(cb.dial).toHaveBeenCalledWith('050-123 4567');
  });

  it('offers only a search for typed text', () => {
    const groups = buildPortalCommands({ query: 'dana', callsAllowed: true, on: on() });
    expect(labels(groups, 'Calls')).toEqual(['Search calls for “dana”']);
    expect(labels(groups, 'Go to')).toEqual([]);
  });

  it('opens the phone rather than navigating to it', () => {
    const cb = on();
    const groups = buildPortalCommands({ query: '', callsAllowed: true, on: cb });
    groups.find((g) => g.label === 'Go to').items.find((i) => i.label === 'Phone').action();
    expect(cb.phone).toHaveBeenCalled();
    expect(cb.go).not.toHaveBeenCalled();
  });

  // Anything typed can be a question — it is the only row that reads the words
  // rather than matching them, so it comes first.
  it('offers to ask whatever was typed, above the other rows', () => {
    const cb = on();
    const groups = buildPortalCommands({ query: 'how many calls today', callsAllowed: true, on: cb });
    expect(groups[0].label).toBe('Ask');
    expect(groups[0].items[0].label).toBe('Ask: “how many calls today”');
    groups[0].items[0].action();
    expect(cb.ask).toHaveBeenCalledWith('how many calls today');
  });

  it('offers to ask even where there is no Calls permission', () => {
    const groups = buildPortalCommands({ query: 'devices', callsAllowed: false, on: on() });
    expect(groups.find((g) => g.label === 'Ask')).toBeTruthy();
    expect(groups.find((g) => g.label === 'Calls')).toBeUndefined();
  });

  it('filters places and settings by what is typed', () => {
    const groups = buildPortalCommands({ query: 'dark', liveAllowed: true, callsAllowed: true, dark: false, on: on() });
    expect(labels(groups, 'Settings')).toEqual(['Dark appearance']);
    const dark = buildPortalCommands({ query: 'light', dark: true, on: on() });
    expect(labels(dark, 'Settings')).toEqual(['Light appearance']);
  });
});

describe('looksLikeNumber', () => {
  it('accepts numbers as people type them', () => {
    ['0501234567', '050-123-4567', '+972 50 123 4567', '(03) 555-1234', '1002', '*97'].forEach((n) => {
      // *97 is a feature code, not a number: it is NOT accepted, and that is fine — it is typed on the keypad.
      expect(looksLikeNumber(n)).toBe(n !== '*97');
    });
  });

  it('rejects dates, malformed groups and the too short or too long', () => {
    ['2024-09-24', '2024/09/24', '((123', '12', '1'.repeat(17), 'dana', '050 abc'].forEach((n) => {
      expect(looksLikeNumber(n)).toBe(false);
    });
  });
});
