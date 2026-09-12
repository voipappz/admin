import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  FormControl,
  FormHelperText,
  CircularProgress,
  Alert
} from '@mui/material';
import { useUserLogin } from './UserLogin';
import { loadCustomerPortalData } from '../../services/customerPortalService';
import './Login.css';

// The `/` entry point — end-user (customer) login. Same visual template as
// the admin Login (Login.jsx) so the two surfaces read as one product; the
// only difference is which hook (and which backend endpoints) it's wired to.
const UserLogin = () => {
  const {
    email,
    password,
    showForgetForm,
    forgotEmail,
    forgotSent,
    forgotStep,
    forgotOtpCode,
    newPassword,
    confirmPassword,
    touched,
    loading,
    error,
    otpStep,
    otpCode,
    handleEmailChange,
    handlePasswordChange,
    handleForgotEmailChange,
    handleForgotOtpChange,
    handleNewPasswordChange,
    handleConfirmPasswordChange,
    handleOtpCodeChange,
    handleBlur,
    handleSubmit,
    handleOtpSubmit,
    handleForgotPasswordClick,
    handleBackToLogin,
    handleBackToCredentials,
    handleForgotEmailSubmit,
    handleForgotOtpSubmit,
    handleForgotResetSubmit
  } = useUserLogin();

  // Per-tenant branding (logo, brand colour) for this unauthenticated screen —
  // resolved server-side from the request's origin host. Always fetched
  // fresh (no localStorage cache) — starts as the default VoipAppz look
  // until the network request resolves.
  const [portalData, setPortalData] = useState(null);
  useEffect(() => {
    let alive = true;
    loadCustomerPortalData().then((data) => { if (alive && data) setPortalData(data); });
    return () => { alive = false; };
  }, []);

  const brandLogo = portalData?.logo_url || '/images/VA_logo_white.png';
  const brandLogoLight = portalData?.logo_url || '/images/VA_logo_blue.png';
  const brandName = portalData?.logo_title || 'VoipAppz';
  const brandColor = portalData?.logo_color;

  // Favicon/title only while THIS screen is mounted — the admin console (and
  // its own login at /admin) must keep its own tab identity, not inherit a
  // tenant's portal branding just because a browser also visited /.
  useEffect(() => {
    if (!portalData) return;
    const favicon = document.querySelector('link[rel="icon"]');
    const previousTitle = document.title;
    const previousFaviconHref = favicon?.href;
    if (portalData.logo_title) document.title = portalData.logo_title;
    if (portalData.logo_icon && favicon) favicon.href = portalData.logo_icon;
    return () => {
      document.title = previousTitle;
      if (favicon && previousFaviconHref) favicon.href = previousFaviconHref;
    };
  }, [portalData]);
  // A HINT ONLY — it changes copy, never the flow: the step-1 login response
  // (otp_sent) stays the authority on whether OTP actually happens. Reads the
  // same customer-profile key the server enforces on (login_otp_enabled),
  // with the server's own truthy rule, so the hint can't disagree with the
  // enforcement. No portal data (or an older API) defaults to true, matching
  // the backend's own default when the profile key is unset.
  const expectsOtp = (() => {
    const val = portalData?.login_otp_enabled;
    if (val === undefined || val === null || val === '') return true;
    return ['true', '1', 'yes', 'on', 'enabled'].includes(String(val).trim().toLowerCase());
  })();

  const renderLoginForm = () => (
    <>
      <Typography component="h3" className="form-title">
        Sign In
      </Typography>

      {expectsOtp && (
        <Typography variant="body2" className="forgot-description" data-testid="user-otp-hint">
          You'll be asked for a verification code after signing in.
        </Typography>
      )}

      {error && (
        <Alert severity="error" className="login-alert" data-testid="user-error-message">
          {error}
        </Alert>
      )}

      {/* Distinct field names (portal_email / portal_password) and form id
          from the admin form's plain email/password. Chrome keys saved
          credentials by ORIGIN, so `/` and `/admin` on one host share a
          store no matter what — but its form-signature heuristics weight
          field names heavily, and identical names on both screens is what
          made it offer the admin password on the portal (and overwrite one
          with the other). This separates them as far as a single origin
          allows; genuinely separate credentials would need the portal on
          its own subdomain. */}
      <Box component="form" id="portal-login-form" name="portal-login" onSubmit={handleSubmit} className="login-form" data-testid="user-login-form">
        <FormControl fullWidth className="form-group">
          <TextField
            fullWidth
            id="user-email"
            name="portal_email"
            placeholder="Email or extension"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => handleBlur('email')}
            variant="outlined"
            className="form-control"
            data-testid="user-email-input"
            required
            error={touched.email && email === ''}
            // type="text", not "email": the platform accepts either an email
            // address OR an extension number as the identifier — the same
            // param, dispatched on format server-side (Mediators::User::Login
            // #find_user!). type="email" made the browser reject "2300"
            // before the form could ever be submitted.
            type="text"
            inputMode="email"
            autoComplete="section-portal username"
          />
          {touched.email && email === '' && (
            <FormHelperText error className="help-block">Email or extension is required.</FormHelperText>
          )}
        </FormControl>

        <FormControl fullWidth className="form-group">
          <TextField
            fullWidth
            id="user-password"
            name="portal_password"
            placeholder="Password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            onBlur={() => handleBlur('password')}
            variant="outlined"
            className="form-control"
            data-testid="user-password-input"
            required
            error={touched.password && password === ''}
            autoComplete="section-portal current-password"
          />
          {touched.password && password === '' && (
            <FormHelperText error className="help-block">Password is required.</FormHelperText>
          )}
        </FormControl>

        <Box className="form-actions">
          <Button
            type="submit"
            variant="contained"
            className="login-button"
            data-testid="user-login-button"
            disabled={loading || !email || !password}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>

          <Typography
            variant="body2"
            component="a"
            href="javascript:;"
            className="forgot-password"
            onClick={handleForgotPasswordClick}
            data-testid="user-forgot-password-link"
          >
            Forgot Password?
          </Typography>

          {/* The other door. Stateless on purpose: nothing is remembered about
              who used this browser last, so it reads identically on every
              tenant and every machine. After a failed sign-in the wording
              turns into a fail-forward — an admin who tried the wrong form is
              one click from the right one, with no automatic retry, so the
              lockout counter is never charged twice. */}
          <Typography
            variant="body2"
            component={RouterLink}
            to="/admin"
            className="forgot-password"
            data-testid="user-admin-login-link"
            sx={{ display: 'block', mt: 1, opacity: error ? 1 : 0.7 }}
          >
            {error ? 'Not a user account? Sign in as administrator \u2192' : 'Administrator sign-in \u2192'}
          </Typography>
        </Box>
      </Box>
    </>
  );

  const renderOtpForm = () => (
    <>
      <Typography component="h3" className="form-title">
        Verify Your Identity
      </Typography>

      <Typography component="p" className="forgot-description">
        A 6-digit code has been sent to <strong>{email}</strong>. Enter it below to continue.
      </Typography>

      {error && (
        <Alert severity="error" className="login-alert" data-testid="user-otp-error-message">
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleOtpSubmit} className="login-form" data-testid="user-otp-form">
        <FormControl fullWidth className="form-group">
          <TextField
            fullWidth
            id="user-otp-code"
            name="otp-code"
            placeholder="6-digit code"
            value={otpCode}
            onChange={handleOtpCodeChange}
            variant="outlined"
            className="form-control"
            data-testid="user-otp-input"
            required
            autoFocus
            inputProps={{
              maxLength: 6,
              inputMode: 'numeric',
              pattern: '[0-9]*',
              style: { textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem' }
            }}
            autoComplete="one-time-code"
          />
        </FormControl>

        <Box className="form-actions">
          <Button
            type="button"
            variant="outlined"
            className="back-button"
            onClick={handleBackToCredentials}
            data-testid="user-otp-back-button"
          >
            Back
          </Button>

          <Button
            type="submit"
            variant="contained"
            className="login-button"
            data-testid="user-otp-submit-button"
            disabled={loading || otpCode.length !== 6}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </Box>
      </Box>
    </>
  );

  const renderForgotForm = () => {
    if (forgotStep === 1) {
      return (
        <>
          <Typography component="h3" className="form-title">
            Reset Password
          </Typography>

          <Typography component="p" className="forgot-description">
            Enter your e-mail address below to receive a reset code.
          </Typography>

          {error && (
            <Alert severity="error" className="login-alert" data-testid="user-forgot-error-message">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleForgotEmailSubmit} className="login-form" data-testid="user-forgot-form">
            <FormControl fullWidth className="form-group">
              <TextField
                fullWidth
                id="user-forgot-email"
                name="forgot-email"
                placeholder="Email"
                value={forgotEmail}
                onChange={handleForgotEmailChange}
                onBlur={() => handleBlur('forgotEmail')}
                variant="outlined"
                className="form-control"
                data-testid="user-forgot-email-input"
                required
                error={touched.forgotEmail && forgotEmail === ''}
                type="email"
                autoComplete="off"
              />
              {touched.forgotEmail && forgotEmail === '' && (
                <FormHelperText error className="help-block">Email is required.</FormHelperText>
              )}
            </FormControl>

            <Box className="form-actions">
              <Button
                type="button"
                variant="outlined"
                className="back-button"
                onClick={handleBackToLogin}
                data-testid="user-back-button"
              >
                Back
              </Button>

              <Button
                type="submit"
                variant="contained"
                className="forgot-submit-button"
                data-testid="user-forgot-submit-button"
                disabled={loading || !forgotEmail}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {loading ? 'Sending...' : 'Submit'}
              </Button>
            </Box>
          </Box>
        </>
      );
    }

    if (forgotStep === 2) {
      return (
        <>
          <Typography component="h3" className="form-title">
            Verify Your Email
          </Typography>

          <Typography component="p" className="forgot-description">
            A 6-digit code has been sent to <strong>{forgotEmail}</strong>. Enter it below.
          </Typography>

          {error && (
            <Alert severity="error" className="login-alert" data-testid="user-forgot-otp-error">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleForgotOtpSubmit} className="login-form" data-testid="user-forgot-otp-form">
            <FormControl fullWidth className="form-group">
              <TextField
                fullWidth
                id="user-forgot-otp-code"
                name="forgot-otp-code"
                placeholder="6-digit code"
                value={forgotOtpCode}
                onChange={handleForgotOtpChange}
                variant="outlined"
                className="form-control"
                data-testid="user-forgot-otp-input"
                required
                autoFocus
                inputProps={{
                  maxLength: 6,
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  style: { textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem' }
                }}
                autoComplete="one-time-code"
              />
            </FormControl>

            <Box className="form-actions">
              <Button
                type="button"
                variant="outlined"
                className="back-button"
                onClick={handleBackToLogin}
                data-testid="user-forgot-otp-back-button"
              >
                Back
              </Button>

              <Button
                type="submit"
                variant="contained"
                className="login-button"
                data-testid="user-forgot-otp-submit-button"
                disabled={loading || forgotOtpCode.length !== 6}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
            </Box>
          </Box>
        </>
      );
    }

    return (
      <>
        <Typography component="h3" className="form-title">
          Set New Password
        </Typography>

        <Typography component="p" className="forgot-description">
          Choose a new password (minimum 8 characters).
        </Typography>

        {error && (
          <Alert
            severity={forgotSent ? 'success' : 'error'}
            className="login-alert"
            data-testid="user-forgot-reset-error"
          >
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleForgotResetSubmit} className="login-form" data-testid="user-forgot-reset-form">
          <FormControl fullWidth className="form-group">
            <TextField
              fullWidth
              id="user-new-password"
              name="new-password"
              placeholder="New Password"
              type="password"
              value={newPassword}
              onChange={handleNewPasswordChange}
              variant="outlined"
              className="form-control"
              data-testid="user-new-password-input"
              required
              autoFocus
              autoComplete="new-password"
            />
          </FormControl>

          <FormControl fullWidth className="form-group">
            <TextField
              fullWidth
              id="user-confirm-password"
              name="confirm-password"
              placeholder="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              variant="outlined"
              className="form-control"
              data-testid="user-confirm-password-input"
              required
              error={confirmPassword !== '' && newPassword !== confirmPassword}
              autoComplete="new-password"
            />
            {confirmPassword !== '' && newPassword !== confirmPassword && (
              <FormHelperText error className="help-block">Passwords do not match.</FormHelperText>
            )}
          </FormControl>

          <Box className="form-actions">
            <Button
              type="button"
              variant="outlined"
              className="back-button"
              onClick={handleBackToLogin}
              data-testid="user-forgot-reset-back-button"
            >
              Back
            </Button>

            <Button
              type="submit"
              variant="contained"
              className="login-button"
              data-testid="user-forgot-reset-submit-button"
              disabled={loading || forgotSent || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </Box>
        </Box>
      </>
    );
  };

  return (
    <Box className="login-page" style={brandColor ? { '--accent-color': brandColor } : undefined}>
      <Box className="login-hero">
        <img src={brandLogo} alt={brandName} className="hero-logo" />
        <p className="hero-welcome" data-testid="user-brand-name">Welcome to {brandName}</p>
        <p className="hero-tagline">VoIP Application Platform</p>

        <div className="hero-blocks">
          <div className="block block--orange-lg" />
          <div className="block block--teal" />
          <div className="block block--white-sm" />
          <div className="block block--orange-sm" />
          <div className="block block--navy" />
          <div className="block block--white-lg" />
          <div className="block block--teal-sm" />
        </div>

        <span className="hero-footer">&copy; {new Date().getFullYear()} {brandName}</span>
      </Box>

      <Box className="login-form-panel">
        <img src={brandLogoLight} alt={brandName} className="form-panel-logo" />
        <Paper elevation={0} className="login-paper">
          {showForgetForm
            ? renderForgotForm()
            : otpStep
              ? renderOtpForm()
              : renderLoginForm()
          }
        </Paper>
      </Box>
    </Box>
  );
};

export default UserLogin;
