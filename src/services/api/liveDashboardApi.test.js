import { describe, it, expect } from 'vitest';
import { splitColumn, scopesOf, summarize } from './liveDashboardApi';

/**
 * The pure half of the Live Dashboard's data layer: how a widget definition's
 * column names are read, and how the pills and tiles are counted off the rows.
 *
 * These matter because the same functions serve both data sources. Rows come
 * from the agents endpoint today and from LiveChannel once the va-crystal
 * pipeline lands, and the column vocabulary — `<scope>.<field>` — is what keeps
 * those interchangeable.
 */

describe('splitColumn', () => {
  it('splits a widget column into its scope and field', () => {
    expect(splitColumn('user.status_updated_at')).toEqual({
      scope: 'user',
      field: 'status_updated_at',
    });
    expect(splitColumn('queue.call_count')).toEqual({ scope: 'queue', field: 'call_count' });
  });

  it('splits on the FIRST dot, so a dotted field keeps its own dots', () => {
    // Identity::User::FIELDS really does declare names like `call.number_timezone`.
    expect(splitColumn('user.call.number_timezone')).toEqual({
      scope: 'user',
      field: 'call.number_timezone',
    });
  });

  it('treats an unprefixed name as a field on the widget’s own scope', () => {
    // An older definition may not carry the prefix; dropping the column would
    // silently lose data the dashboard was configured to show.
    expect(splitColumn('status', 'user')).toEqual({ scope: 'user', field: 'status' });
  });

  it('survives a null or missing name rather than throwing mid-render', () => {
    expect(splitColumn(null, 'user')).toEqual({ scope: 'user', field: '' });
    expect(splitColumn(undefined, 'user')).toEqual({ scope: 'user', field: '' });
  });
});

describe('scopesOf', () => {
  it('lists each scope a widget references, once', () => {
    const widget = {
      title: 'user',
      columns: [
        { name: 'user.user_name' },
        { name: 'user.status' },
        { name: 'queue.call_count' },
      ],
    };
    expect(scopesOf(widget)).toEqual(['user', 'queue']);
  });

  it('returns nothing for a widget with no columns', () => {
    expect(scopesOf({ title: 'user' })).toEqual([]);
    expect(scopesOf(null)).toEqual([]);
  });
});

describe('summarize', () => {
  const rows = [
    { status: 'available', state: 'waiting' },
    { status: 'available', state: 'waiting' },
    { status: 'available', state: 'in_a_queue_call' },
    { status: 'on_break', state: '' },
    { status: 'logged_out', state: '' },
  ];

  it('counts the pill row off the rows themselves', () => {
    const s = summarize(rows);
    expect(s.total).toBe(5);
    expect(s.available).toBe(3);
    expect(s.onBreak).toBe(1);
    expect(s.loggedOut).toBe(1);
    expect(s.waiting).toBe(2);
  });

  it('counts an agent on a call from either state the switch reports', () => {
    expect(summarize([{ status: 'available', state: 'in_a_queue_call' }]).onCall).toBe(1);
    expect(summarize([{ status: 'available', state: 'answer' }]).onCall).toBe(1);
  });

  it('is case-insensitive, since status casing varies by source', () => {
    expect(summarize([{ status: 'Available', state: 'WAITING' }]).available).toBe(1);
  });

  it('reports 0% utilization for an empty environment rather than NaN', () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.utilization).toBe(0);
  });

  it('computes utilization as the share of agents on a call', () => {
    expect(summarize(rows).utilization).toBe(20); // 1 of 5
  });
});
