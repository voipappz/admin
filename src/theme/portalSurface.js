/**
 * The portal's shared surface: the header bar and the phone dock are one
 * shell, so they read from one set of tokens instead of two palettes that
 * drifted apart (near-black header with white pills, slate-blue phone with an
 * orange accent, sitting edge to edge).
 *
 * The colour is the CUSTOMER'S. PortalHeader publishes it as a CSS variable
 * (applyPortalSurface) because it only learns the brand after loading portal
 * data, and the phone panel is rendered elsewhere in the tree — a variable on
 * :root is what lets both follow the same brand without threading a prop
 * through the layout. Every token has a fallback, so anything rendered before
 * the brand arrives (or in a test) still looks right.
 */
export const PORTAL_SURFACE_VAR = '--portal-surface';
export const PORTAL_SURFACE_RAISED_VAR = '--portal-surface-raised';

// The bar, and the phone's header strip: the same colour, so the two top
// edges read as one piece.
export const SURFACE = `var(${PORTAL_SURFACE_VAR}, #141414)`;
// One step lifted: the phone's body, and any well inside the bar.
export const SURFACE_RAISED = `var(${PORTAL_SURFACE_RAISED_VAR}, #1f1f1f)`;

export const ON_SURFACE = '#fff';
export const ON_SURFACE_MUTED = 'rgba(255,255,255,0.72)';
export const ON_SURFACE_FAINT = 'rgba(255,255,255,0.48)';
export const SURFACE_HOVER = 'rgba(255,255,255,0.09)';
export const SURFACE_ACTIVE = 'rgba(255,255,255,0.16)';
export const SURFACE_BORDER = 'rgba(255,255,255,0.18)';

// Shapes the bar already used, now shared: nav pills and the call button are
// the same pill, inputs and panels the same 8px.
export const PILL_RADIUS = '999px';
export const FIELD_RADIUS = '8px';

// One row height for the bar and for the dock's header strip, so they align.
export const HEADER_HEIGHT = 72;

// Green stays green: a call button is a convention, not a brand decision.
export const CALL_GREEN = '#34c759';
export const CALL_GREEN_HOVER = '#28b14c';
export const DANGER = '#f87171';

/**
 * Publish the brand colour for everything that reads the tokens above.
 * `raised` is the same hue, lifted — computed here rather than hard-coded so a
 * customer's colour stays a single source.
 */
export const applyPortalSurface = (color) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const base = color || '#141414';
  root.style.setProperty(PORTAL_SURFACE_VAR, base);
  root.style.setProperty(PORTAL_SURFACE_RAISED_VAR, raise(base));
};

/** A lighter step of the same colour: a white veil, so any hue works. */
export const raise = (color) => `color-mix(in srgb, ${color} 88%, #ffffff)`;
