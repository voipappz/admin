import { CONFIG } from 'src/app/config';

/**
 * Which build this is, and whose.
 *
 * Every customer gets the same code and a different `CONFIG.API_ENDPOINT`, so
 * two packed .zips are indistinguishable by looking at them. "Which build is
 * installed?" and "is this the nimbus one or the other one?" were answerable
 * only by unpacking the extension or opening devtools on the popup — which is
 * exactly the moment nobody wants to be doing that, because it is during a
 * support call about a portal that moved.
 *
 * So the answer goes on screen, on both the login page and the main popup:
 * the login page because a broken endpoint is the failure you cannot get past
 * to see the main one, and the main popup because that is where someone
 * already is when they call.
 *
 * The version is read from the manifest at RUNTIME rather than duplicated in a
 * TypeScript constant. A second copy is a copy that can disagree with the one
 * Chrome actually installed, and the disagreement would surface as a stamp
 * confidently naming the wrong version.
 */
export function buildStamp(): string {
  return `${CONFIG.CUSTOMER} · v${manifestVersion()}`;
}

/**
 * The stamp plus the address it points at — for a tooltip, where there is room
 * for the thing you actually need during a support call.
 */
export function buildStampDetail(): string {
  return `${buildStamp()} — ${CONFIG.API_ENDPOINT}`;
}

function manifestVersion(): string {
  try {
    // `chrome` exists in the extension and is shimmed under `ng serve`; a
    // build served any other way should show the gap rather than crash the
    // page it is stamped on.
    return (chrome as any)?.runtime?.getManifest?.().version || 'unknown';
  } catch {
    return 'unknown';
  }
}
