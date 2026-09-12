// Pure text helpers for the global search (kept dependency-free for unit tests).

// Short "time ago" label for Recent rows (browser-history style):
// "just now", "5m ago", "3h ago", "Tue", "12/03".
export const timeAgo = (ts, now = Date.now()) => {
  if (!ts) return '';
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = new Date(ts);
  if (hr < 24 * 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
};

// Split a label around the first case-insensitive match of the query so the
// renderer can bold the matched part (Algolia-style highlighting).
// Returns [before, match, after] or null when there is no match.
export const splitMatch = (label, query) => {
  const q = (query || '').trim();
  if (!q || !label) return null;
  const text = String(label);
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  return [text.slice(0, idx), text.slice(idx, idx + q.length), text.slice(idx + q.length)];
};
