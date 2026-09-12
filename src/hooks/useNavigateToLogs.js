import { useCallback } from 'react';

/**
 * "View logs" for one record — opens the Logs modal filtered to it.
 *
 * This hook was named useNavigateToLogs but opened the EVENTS modal
 * (subject/subject_uuid, against the Postgres event store). The two are not
 * interchangeable:
 *
 *   logs    the InfluxDB `syslog` stream — every line the app emitted, which is
 *           what you read to work out WHY something failed
 *   events  the Postgres event store — operational records a service acts on
 *           (call state, CDR, the auth rows the login lockout counter reads)
 *
 * A "view logs" action on a DID or a provider wants the first. It was giving the
 * second, on all 14 screens that use it.
 *
 * The filter is the record's uuid as a search needle: Mediators::Log::Insert
 * stamps `type_uuid=<uuid>` onto every log line it writes, and the Logs screen
 * seeds its filters from the URL — so /logs?search=<uuid> lands on that record's
 * lines. `app` narrows further where the caller knows it (auth, workflow, …).
 *
 *   const goToLogs = useNavigateToLogs();
 *   <MenuItem onClick={() => goToLogs('did', did.uuid)}>View Logs</MenuItem>
 */
export const useNavigateToLogs = () => {
  return useCallback(
    (model, uuid, { app, period = '24h' } = {}) => {
      if (!uuid) return;
      const qs = new URLSearchParams({ search: uuid, period });
      if (app) qs.set('app', app);
      // Opens over the current screen instead of navigating away: you read a
      // record's logs to explain the row you're looking at, and losing that
      // row (plus its filters and scroll position) to a full-page trip was
      // the reason "view logs" felt like a dead end. Same modal pattern as
      // useNavigateToEvents; Logs has no sidebar entry for the same reason.
      window.dispatchEvent(new CustomEvent('openLogsModal', { detail: qs.toString() }));
    },
    []
  );
};

/**
 * The operational counterpart — opens the Events modal over the current page,
 * filtered by subject/subject_uuid. This is what useNavigateToLogs used to do;
 * kept because some screens genuinely want the event store rather than the log
 * stream.
 *
 * The model name must match the subject the backend writes into
 * `event_store_events.data->'subject'` — see
 * voipappz-api/lib/endpoints/events.rb for the supported list.
 */
export const useNavigateToEvents = () => {
  return useCallback((model, uuid) => {
    if (!model || !uuid) return;
    const qs = new URLSearchParams({ subject: model, subject_uuid: uuid }).toString();
    window.dispatchEvent(new CustomEvent('openEventsModal', { detail: qs }));
  }, []);
};

export default useNavigateToLogs;
