import { useCallback, useEffect, useMemo, useState } from 'react';

import { ASSISTANT_CAN_ANSWER } from '../../services/portalAssistant';

/**
 * Everything the portal can do, as rows under the line.
 *
 * The portal has no menus. One line to type into; the places, the settings,
 * "ask this question", "call this number" and "search calls for this" are all
 * rows in its results, and Enter does the highlighted one. That is the whole navigation model — a
 * desk phone's: one screen, one line, a few keys.
 *
 * `buildPortalCommands` is pure, so what shows for a given ACL, query and
 * preference set is a unit test. The hook adds only the typed text and the
 * highlighted row.
 */

// A phone number as people type one: an optional leading +, then groups of
// digits joined by at most one space, dot or dash, a group optionally in
// parentheses; 3 to 16 digits in all. "3.14" is two groups but only three
// digits and reads as a number — it is allowed, and the row says "Call 3.14",
// which is honest. A date ("2024-09-24") is excluded by shape: nobody dials
// a four-digit group followed by two two-digit groups with one separator.
const NUMBER_SHAPE = /^\+?(\(\d{1,4}\)|\d{1,4})([ .-]?(\(\d{1,4}\)|\d{1,4}))*$/;
const DATE_SHAPE = /^\d{4}([-./])\d{1,2}\1\d{1,2}$/;
export const looksLikeNumber = (text) => {
  const t = text.trim();
  if (!NUMBER_SHAPE.test(t) || DATE_SHAPE.test(t)) return false;
  const digits = t.replace(/\D/g, '');
  return digits.length >= 3 && digits.length <= 16;
};

const match = (query) => {
  const q = query.trim().toLowerCase();
  return (label) => !q || label.toLowerCase().includes(q);
};

/**
 * @param {object} p
 * @param {string} p.query
 * @param {boolean} p.liveAllowed  the `dashboard` ACL, which gates Live
 * @param {boolean} p.callsAllowed the `calls` ACL
 * @param {boolean} p.dark         current appearance
 * @param {boolean} p.compact      current row density
 * @param {object}  p.on           { go(path), phone(), ask(text), dial(number), searchCalls(text), theme(), density(), logout() }
 */
export function buildPortalCommands({ query = '', liveAllowed, callsAllowed, dark, compact, on }) {
  const q = query.trim();
  const fits = match(q);
  const groups = [];

  const places = [
    callsAllowed && { id: 'go-calls', label: 'Calls', hint: 'Your call history', action: () => on.go('/my-calls') },
    liveAllowed && { id: 'go-live', label: 'Live', hint: 'What is happening right now', action: () => on.go('/live') },
    { id: 'open-phone', label: 'Phone', hint: 'Dial a number', action: () => on.phone() },
  ].filter(Boolean).filter((item) => fits(item.label));
  if (places.length) groups.push({ label: 'Go to', items: places });

  // Anything typed can be a QUESTION. It comes first because it is the only
  // row that reads the words rather than matching them: "how many calls today"
  // is a question, and every other row would have shrugged at it.
  if (q) {
    groups.push({ label: 'Ask', items: [{ id: 'ask', label: `Ask: “${q}”`, hint: `About ${ASSISTANT_CAN_ANSWER}`, action: () => on.ask(q) }] });
  }

  // Typed text is about calls before it is about anything else.
  if (q && callsAllowed) {
    const items = [];
    if (looksLikeNumber(q)) items.push({ id: 'dial', label: `Call ${q}`, hint: 'Through your phone', number: true, action: () => on.dial(q) });
    items.push({ id: 'search-calls', label: `Search calls for “${q}”`, action: () => on.searchCalls(q) });
    groups.push({ label: 'Calls', items });
  }

  const settings = [
    { id: 'set-theme', label: dark ? 'Light appearance' : 'Dark appearance', action: () => on.theme() },
    { id: 'set-density', label: compact ? 'Comfortable rows' : 'Compact rows', action: () => on.density() },
    { id: 'set-logout', label: 'Sign out', action: () => on.logout() },
  ].filter((item) => fits(item.label));
  if (settings.length) groups.push({ label: 'Settings', items: settings });

  return groups;
}

/**
 * Typed text and the highlighted row, on top of the pure builder. Every
 * callback is taken individually and memoised here, so a caller passing fresh
 * arrow functions each render does not rebuild the rows each render.
 */
export function usePortalCommands({ liveAllowed, callsAllowed, dark, compact, go, phone, ask, dial, searchCalls, theme, density, logout }) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const on = useMemo(() => ({ go, phone, ask, dial, searchCalls, theme, density, logout }), [go, phone, ask, dial, searchCalls, theme, density, logout]);
  const groups = useMemo(() => buildPortalCommands({ query, liveAllowed, callsAllowed, dark, compact, on }), [query, liveAllowed, callsAllowed, dark, compact, on]);
  const rows = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => { setHighlight(0); }, [query]);

  // Arrow keys stay inside [0, rows.length - 1]; an empty list keeps 0.
  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((i) => Math.min(i + 1, Math.max(rows.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { const row = rows[highlight]; if (row) { e.preventDefault(); row.action(); } }
  }, [rows, highlight]);

  const reset = useCallback(() => { setQuery(''); setHighlight(0); }, []);

  return { query, setQuery, groups, rows, highlight, setHighlight, onKeyDown, reset };
}
