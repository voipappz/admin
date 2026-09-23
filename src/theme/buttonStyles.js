/**
 * Shared button sx presets, on the theme palette (no hex here: the palette
 * flips with dark mode, a literal does not). Prefer <Button variant color>
 * from the theme; these exist for the four callers that predate it.
 */
const base = {
  fontWeight: 500,
  fontSize: '0.875rem',
  textTransform: 'none',
  px: 2.5,
  py: 0.75,
  borderRadius: 1.5,
  boxShadow: 'none',
  '&:hover': { boxShadow: 'none' },
};

export const primaryButtonStyle = {
  ...base,
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none' },
  '&:active': { bgcolor: 'primary.dark' },
  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' },
};

export const secondaryButtonStyle = {
  ...base,
  bgcolor: 'surface.muted',
  color: 'text.primary',
  '&:hover': { bgcolor: 'surface.sunken', boxShadow: 'none' },
  '&:active': { bgcolor: 'surface.sunken' },
};

export const outlinedButtonStyle = {
  ...base,
  bgcolor: 'transparent',
  color: 'primary.main',
  border: 1,
  borderColor: 'primary.main',
  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', boxShadow: 'none' },
  '&:active': { bgcolor: 'action.selected' },
};

export const dangerButtonStyle = {
  ...base,
  bgcolor: 'error.main',
  color: 'error.contrastText',
  '&:hover': { bgcolor: 'error.dark', boxShadow: 'none' },
  '&:active': { bgcolor: 'error.dark' },
};

export const successButtonStyle = {
  ...base,
  bgcolor: 'success.main',
  color: 'success.contrastText',
  '&:hover': { bgcolor: 'success.dark', boxShadow: 'none' },
  '&:active': { bgcolor: 'success.dark' },
};

export const buttonGroupStyle = {
  '& .MuiButton-root': { textTransform: 'none', fontWeight: 500 },
};

export const iconButtonStyle = {
  color: 'primary.main',
  '&:hover': { bgcolor: 'action.hover' },
};

export const smallButtonStyle = { fontSize: '0.75rem', px: 1.5, py: 0.5 };
export const largeButtonStyle = { fontSize: '1rem', px: 3.5, py: 1 };
