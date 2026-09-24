import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import Login from './Login.jsx';
import UserLogin from './UserLogin.jsx';

const KEY = 'sign_in_as';
const readLast = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/**
 * The one sign-in page, at `/`: a user or an account, toggled.
 *
 * Two logins, not one: the user login (/auth/user_login -> UserAuthContext)
 * and the account login (/auth/login -> AuthContext) are different JWTs with
 * different permissions, and each keeps its own form, OTP and password reset.
 * The choice is explicit — never "try one endpoint, then the other", which
 * would send a password to the wrong door and blur the error.
 *
 * `?as=account` opens on the account login (the old /admin links); otherwise
 * the last choice made in this browser, then the user login.
 */
export default function SignIn() {
  const [params] = useSearchParams();
  const asked = params.get('as');
  const [as, setAs] = useState(() => (asked === 'account' || asked === 'user' ? asked : readLast() === 'account' ? 'account' : 'user'));

  const choose = (_, next) => {
    if (!next) return;
    setAs(next);
    try { localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
  };

  const switcher = (
    <ToggleButtonGroup
      value={as} exclusive onChange={choose} fullWidth size="small" aria-label="Sign in as"
      data-testid="sign-in-as" sx={{ mb: 2, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}
    >
      <ToggleButton value="user">User</ToggleButton>
      <ToggleButton value="account">Account</ToggleButton>
    </ToggleButtonGroup>
  );

  return as === 'account' ? <Login switcher={switcher} /> : <UserLogin switcher={switcher} />;
}
