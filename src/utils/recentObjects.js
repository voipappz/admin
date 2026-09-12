// Recently opened OBJECTS (e.g. users you edited) — shown in the global
// command palette's RECENT section alongside recently visited screens, sorted
// by time. Persisted in localStorage; cleared on customer switch (see
// RecentPagesContext, which owns the switch listener for both stores).

const STORAGE_KEY = 'nimbus_recent_objects';
const CAP = 15;

export function readRecentObjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// entry: { type: 'user', uuid, name, path } — deduped by uuid, newest first.
export function addRecentObject(entry) {
  if (!entry?.uuid) return;
  try {
    const list = [
      { ...entry, timestamp: Date.now() },
      ...readRecentObjects().filter((o) => o.uuid !== entry.uuid),
    ].slice(0, CAP);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota / private mode — non-fatal */ }
}

export function clearRecentObjects() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
}
