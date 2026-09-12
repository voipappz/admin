// Customer BRANDING profile parsing (Edit Customer → Branding):
//   logo_icon (favicon), logo_url (main logo), logo_color (accent).
// Defensive: the profile may be an object, a JSON string, or garbage; logo
// values must look like real URLs/paths and the color like a real CSS color,
// otherwise we return null so the UI falls back to the letter avatar + accent.
// (MUI <Avatar> additionally falls back to its children if the image itself
// fails to LOAD — broken links degrade gracefully too.)

const isValidLogoUrl = (v) =>
  typeof v === 'string' && (/^https?:\/\//i.test(v.trim()) || v.trim().startsWith('/'));

const isValidColor = (v) => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)
    || /^rgba?\(/i.test(s)
    || /^hsla?\(/i.test(s);
};

export function parseCustomerBrand(profile) {
  let p = profile;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { p = null; }
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
  const logo = [p.logo_icon, p.logo_url].find(isValidLogoUrl) || null;
  const color = isValidColor(p.logo_color) ? p.logo_color.trim() : null;
  return { logo, color };
}
