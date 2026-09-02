// Same-origin base for routes the Elixir portal serves itself (as opposed to
// the mothership routes it forwards, which `api.ts` reaches at a bare relative
// path).
//
// The `/portal` prefix exists only in development, and only to keep Vite's
// proxy from shadowing the SPA's own pages: `/dashboard` and `/calls` are React
// routes as well as backend paths, so a proxy rule on either would stop the
// page from loading. Production serves both from one origin and needs no
// prefix.
export const PORTAL_API_BASE = import.meta.env.VITE_PORTAL_API_BASE ??
  (import.meta.env.DEV ? '/portal' : '');
