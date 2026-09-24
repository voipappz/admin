/**
 * The portal bar's surface, in one place so the bar, its pills, its line and
 * its phone button cannot drift apart on copied hex codes.
 *
 * The colour is the CUSTOMER'S. PortalHeader publishes it as a CSS variable
 * (applyPortalSurface) because it only learns the brand after loading portal
 * data. Every token has a fallback, so anything rendered before the brand
 * arrives — or in a test — still looks right.
 */
export const PORTAL_SURFACE_VAR = '--portal-surface';

// The bar itself.
export const SURFACE = `var(${PORTAL_SURFACE_VAR}, #141414)`;
export const ON_SURFACE = '#fff';
export const ON_SURFACE_MUTED = 'rgba(255,255,255,0.72)';
export const ON_SURFACE_FAINT = 'rgba(255,255,255,0.48)';
export const SURFACE_BORDER = 'rgba(255,255,255,0.18)';

// The bar's two shapes: a pill for the place links, 8px for the line.
export const PILL_RADIUS = '999px';
export const FIELD_RADIUS = '8px';

// The bar's height, which the sidebar and any panel measure against.
export const HEADER_HEIGHT = 72;

// Publish the brand colour for everything that reads the tokens above.
export const applyPortalSurface = (color) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(PORTAL_SURFACE_VAR, color || '#141414');
};
