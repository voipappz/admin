import { useCallback } from 'react';

/**
 * "View events" for one record — opens the Events modal over the current page,
 * filtered by subject/subject_uuid.
 *
 * This file used to also export useNavigateToLogs, a per-record "View Logs"
 * action on ~20 screens. It is gone: app logs are read on the Logs screen
 * (/logs) only, where the filters live. The per-record trail it depended on
 * (a log line stamped with the record's uuid) is no longer something the API
 * offers, so the action could only ever land on an empty modal.
 *
 * Events are the operational half and are unaffected: the Postgres event store
 * holds durable records a service acts on (call state, CDR, the auth rows the
 * login lockout counter reads), and every screen that wants them uses this
 * hook.
 *
 * The model name must match the subject the backend writes into
 * `event_store_events.data->'subject'` — see
 * voipappz-api/lib/endpoints/events.rb for the supported list.
 *
 *   const goToEvents = useNavigateToEvents();
 *   <MenuItem onClick={() => goToEvents('did', did.uuid)}>Events</MenuItem>
 */
export const useNavigateToEvents = () => {
  return useCallback((model, uuid) => {
    if (!model || !uuid) return;
    const qs = new URLSearchParams({ subject: model, subject_uuid: uuid }).toString();
    window.dispatchEvent(new CustomEvent('openEventsModal', { detail: qs }));
  }, []);
};

export default useNavigateToEvents;
