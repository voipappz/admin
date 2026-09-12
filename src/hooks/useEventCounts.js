import { useState, useEffect, useCallback } from 'react';
import eventsApi from '../services/api/eventsApi';

/**
 * useEventCounts — one call per list load returns the event count per
 * subject_uuid for a subject type (e.g. 'subscription'), so a list can show a
 * "N events" badge on each row without a request per row. Same idea as the
 * live-registrations map the Extensions list uses.
 *
 * Returns { counts: { <uuid>: <count> }, refresh }.
 * `deps` re-fetches when they change (e.g. selected environment/customer).
 */
export const useEventCounts = (subject, deps = []) => {
  const [counts, setCounts] = useState({});

  const refresh = useCallback(async () => {
    if (!subject) return;
    try {
      const res = await eventsApi.fetchCounts(subject);
      setCounts(res && typeof res === 'object' ? res : {});
    } catch {
      setCounts({}); // counts are a nicety — never break the list on failure
    }
  }, [subject]);

  useEffect(() => { refresh(); }, [refresh, ...deps]);

  return { counts, refresh };
};

export default useEventCounts;
