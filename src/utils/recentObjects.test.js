import { describe, it, expect, beforeEach } from 'vitest';
import { addRecentObject, readRecentObjects, clearRecentObjects } from './recentObjects';
import { splitMatch, timeAgo } from './searchText';

describe('recentObjects store', () => {
  beforeEach(() => clearRecentObjects());

  it('adds an entry with a timestamp, newest first', () => {
    addRecentObject({ type: 'user', uuid: 'a', name: 'Alice', path: '/users' });
    addRecentObject({ type: 'user', uuid: 'b', name: 'Bob', path: '/users' });
    const list = readRecentObjects();
    expect(list.map(o => o.uuid)).toEqual(['b', 'a']);
    expect(list[0].timestamp).toBeTypeOf('number');
  });

  it('dedupes by uuid, moving the entry to the front with the new name', () => {
    addRecentObject({ type: 'user', uuid: 'a', name: 'Old' });
    addRecentObject({ type: 'user', uuid: 'b', name: 'Bob' });
    addRecentObject({ type: 'user', uuid: 'a', name: 'New' });
    const list = readRecentObjects();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ uuid: 'a', name: 'New' });
  });

  it('caps the list at 15', () => {
    for (let i = 0; i < 20; i++) addRecentObject({ type: 'user', uuid: `u${i}`, name: `U${i}` });
    const list = readRecentObjects();
    expect(list).toHaveLength(15);
    expect(list[0].uuid).toBe('u19');
    expect(list.some(o => o.uuid === 'u0')).toBe(false);
  });

  it('ignores entries without a uuid and clears cleanly', () => {
    addRecentObject({ type: 'user', name: 'NoId' });
    expect(readRecentObjects()).toHaveLength(0);
    addRecentObject({ type: 'user', uuid: 'a', name: 'A' });
    clearRecentObjects();
    expect(readRecentObjects()).toEqual([]);
  });

  it('tolerates corrupted storage', () => {
    localStorage.setItem('nimbus_recent_objects', '{not json');
    expect(readRecentObjects()).toEqual([]);
  });
});

describe('splitMatch (Algolia-style highlight)', () => {
  it('splits around a case-insensitive match', () => {
    expect(splitMatch('Test Agent', 'agent')).toEqual(['Test ', 'Agent', '']);
    expect(splitMatch('Reports', 'rep')).toEqual(['', 'Rep', 'orts']);
  });

  it('returns null when there is no match or no query', () => {
    expect(splitMatch('Users', 'xyz')).toBeNull();
    expect(splitMatch('Users', '')).toBeNull();
    expect(splitMatch('', 'a')).toBeNull();
  });
});

describe('timeAgo', () => {
  const NOW = 1_700_000_000_000;
  it('formats minutes/hours buckets', () => {
    expect(timeAgo(NOW - 30_000, NOW)).toBe('just now');
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe('5m ago');
    expect(timeAgo(NOW - 3 * 3_600_000, NOW)).toBe('3h ago');
  });
  it('returns empty for missing timestamps', () => {
    expect(timeAgo(null, NOW)).toBe('');
  });
});
