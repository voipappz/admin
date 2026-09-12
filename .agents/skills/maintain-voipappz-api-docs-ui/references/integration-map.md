# Nimbus API documentation integration map

- Route registration: `src/App.jsx`, protected `/devzone` route plus a client-side `/api-docs` compatibility redirect. The cloud gateway sends `/api*` to the API, so only `/devzone` is reachable as a Nimbus route there.
- Renderer: `src/components/ApiDocs/ApiDocs.jsx`.
- Component coverage: `src/components/ApiDocs/ApiDocs.test.jsx`.
- Desktop navigation: `src/components/Sidebar/Sidebar.jsx`.
- Mobile overflow navigation: `src/components/TopBar/TopBar.jsx`.
- Navigation/search metadata: `src/config/navConfig.js`.
- Environment selection: `src/config.js`; development can use `VITE_API_BASE_URL`, production defaults to same-origin paths.
- Vite local proxy: `vite.config.js` proxies `/tasks` to the configured API.
- API source of truth: `../voipappz-api/docs/voipappz.openapi.json`.
- Public API endpoint: `GET /tasks/openapi.json` in the current API environment.
- Public Skill catalog: `GET /tasks/agent-skills`.
- Customer Skill: `GET /tasks/agent-skills/use-voipappz-api/SKILL.md`.
- Embedded twelve-topic readiness source: `GET /tasks/agent-skills/use-voipappz-api/references/integration-status.json`.

The UI may replace the document's `servers` array in memory with the current environment for “Try It Out.” It must not rewrite or persist a second copy of the JSON.

External AI actions should open an official assistant page and copy a prompt containing public Skill, readiness, and spec URLs. Do not rely on undocumented URL query parameters, and do not include the active Nimbus token.
