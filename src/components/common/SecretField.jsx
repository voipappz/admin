import React from 'react';
import { TextField } from '@mui/material';

// Can this browser mask a TEXT input? (Chrome, Edge, Safari, current Firefox.)
const CAN_MASK_TEXT = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
  && CSS.supports('-webkit-text-security', 'disc');

/**
 * A secret that is NOT the signed-in admin's own login: a device's SIP
 * password, a password set for someone else, a provider API key.
 *
 * A `type="password"` input makes the browser offer "Save password?" whenever
 * its form is submitted or the field disappears after a request — which is
 * every dialog save in this admin — and `autoComplete="new-password"` does
 * not stop that. So this is a TEXT input masked with CSS, which browsers and
 * password managers do not treat as a password. Where a browser cannot mask a
 * text input it falls back to a real password input: a secret is never shown
 * in the clear just to avoid a prompt.
 *
 * Drop-in for TextField. `revealed` shows the value (the eye toggle).
 * The admin's own sign-in (Login.jsx) keeps a real password field, where
 * saving it is the point.
 */
const SecretField = ({ revealed = false, inputProps, ...props }) => {
  const mask = !revealed && CAN_MASK_TEXT;
  return (
    <TextField
      {...props}
      type={!revealed && !CAN_MASK_TEXT ? 'password' : 'text'}
      autoComplete="off"
      inputProps={{
        ...inputProps,
        autoCapitalize: 'off',
        spellCheck: false,
        // Password managers that ignore autocomplete honour these.
        'data-1p-ignore': 'true',
        'data-lpignore': 'true',
        'data-bwignore': 'true',
        'data-form-type': 'other',
        'data-secret-field': mask ? 'masked' : (revealed ? 'revealed' : 'password'),
        style: { ...(inputProps?.style || {}), ...(mask ? { WebkitTextSecurity: 'disc' } : {}) },
      }}
    />
  );
};

export default SecretField;
