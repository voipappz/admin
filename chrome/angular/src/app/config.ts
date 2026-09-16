export const CONFIG = {
    // THE ONE KNOB. Every request the extension makes goes to the Elixir
    // portal: it performs the login (relaying to the API), serves /ws/events,
    // and forwards /api. There is no second host to configure, which is why
    // the login form no longer asks for a domain.
    //
    // A deployment changes this line and nothing else. `localStorage._domain`
    // overrides it at runtime — that is how the e2e specs point the extension
    // at a fake node, and how you aim a packed build somewhere else without a
    // rebuild.
    API_ENDPOINT:  "https://nimbus-connectix.voipappz.io",
    // WHOSE DEPLOYMENT THIS BUILD IS FOR. Every customer gets the same code
    // and a different API_ENDPOINT, so a packed .zip is indistinguishable from
    // any other by looking at it — and "which build is installed?" was
    // answerable only by unpacking it. This is stamped into the UI beside the
    // version (see `buildStamp()`), so the answer is on screen.
    //
    // It travels WITH the address: change one and change the other.
    CUSTOMER: "nimbus",
    // WEBSOCKETS_URL and WEBSOCKETS_DASHBOARD_URL were here, pointing at
    // callcenter.nimbusip.com and 900.nimbusip.com. Nothing read them: the one
    // socket this extension opens is the portal's /ws/events, built from
    // API_ENDPOINT above. They were a second address to keep in step with
    // nothing, and a reader had to grep the whole bundle to find that out.
    PAGE_TITLE: "Nimbus",
    GOOGLE_CLIENT_ID: "CAHNGE_ME",
    FACEBOOK_KEY: "CAHNGE_ME",
    ITEMS_PER_PAGE: 50,
    ENV: 'dev'
  };
  