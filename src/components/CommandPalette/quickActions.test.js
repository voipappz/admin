import { describe, it, expect, vi } from 'vitest';
import { buildQuickActions } from './quickActions';

const on = () => ({ ask: vi.fn(), call: vi.fn(), openPhone: vi.fn() });

describe('the palette quick actions', () => {
  it('offers the phone when nothing is typed', () => {
    const rows = buildQuickActions({ query: '', on: on() });
    expect(rows.map((r) => r.id)).toEqual(['quick-phone']);
  });

  // Anything typed can be a question: it is the one row that reads the words
  // instead of matching them, so it comes first.
  it('asks what was typed, first', () => {
    const handlers = on();
    const rows = buildQuickActions({ query: 'how many calls today', on: handlers });
    expect(rows[0]).toMatchObject({ id: 'quick-ask', label: 'Ask: “how many calls today”', keepOpen: true });
    rows[0].action();
    expect(handlers.ask).toHaveBeenCalledWith('how many calls today');
  });

  it('offers to call what looks like a number', () => {
    const handlers = on();
    const rows = buildQuickActions({ query: '050-123 4567', on: handlers });
    expect(rows.map((r) => r.id)).toEqual(['quick-ask', 'quick-call']);
    rows[1].action();
    expect(handlers.call).toHaveBeenCalledWith('050-123 4567');
  });

  it('does not offer to call a date', () => {
    const rows = buildQuickActions({ query: '2026-09-24', on: on() });
    expect(rows.map((r) => r.id)).not.toContain('quick-call');
  });

  it('keeps the phone when the words match it', () => {
    const rows = buildQuickActions({ query: 'pho', on: on() });
    expect(rows.map((r) => r.id)).toEqual(['quick-ask', 'quick-phone']);
  });
});
