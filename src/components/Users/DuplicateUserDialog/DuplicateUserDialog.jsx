import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { ContentCopy as DuplicateIcon, CheckCircle as ValidIcon, Error as ErrorIcon } from '@mui/icons-material';
import { usersApi } from '../../../services/api/usersApi';

/**
 * DuplicateUserDialog Component
 * Dialog for duplicating an existing user with a new email
 * Validates email uniqueness before allowing duplication
 */
const DuplicateUserDialog = ({
  open,
  onClose,
  onDuplicate,
  user,
  loading
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [emailValidated, setEmailValidated] = useState(false);

  // Reset form when dialog opens with a new user
  useEffect(() => {
    if (open && user) {
      setEmail('');
      setName(`Copy of ${user.name || ''}`);
      setError('');
      setEmailExists(false);
      setEmailValidated(false);
    }
  }, [open, user]);

  // Validate email format
  const isValidEmail = (emailStr) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  // Debounced email validation
  useEffect(() => {
    if (!email.trim() || !isValidEmail(email.trim())) {
      setEmailExists(false);
      setEmailValidated(false);
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const exists = await usersApi.checkEmailExists(email.trim());
        setEmailExists(exists);
        setEmailValidated(true);
        if (exists) {
          setError(`Email "${email}" already exists. Please use a different email.`);
        } else {
          setError('');
        }
      } catch (err) {
        console.error('Error validating email:', err);
        setEmailValidated(false);
      } finally {
        setValidating(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async () => {
    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if email exists (prevent submission if it does)
    if (emailExists) {
      setError(`Email "${email}" already exists. Please use a different email.`);
      return;
    }

    // If not validated yet, do a final check
    if (!emailValidated) {
      setValidating(true);
      try {
        const exists = await usersApi.checkEmailExists(email.trim());
        if (exists) {
          setError(`Email "${email}" already exists. Please use a different email.`);
          setEmailExists(true);
          setEmailValidated(true);
          setValidating(false);
          return;
        }
      } catch (err) {
        // Continue with duplication - server will validate
        console.error('Error in final email check:', err);
      }
      setValidating(false);
    }

    setError('');

    try {
      await onDuplicate(user.id || user.uuid, email.trim(), name.trim() || null);
      onClose();
    } catch (err) {
      // Extract error message from various response formats (including 406)
      let errorMessage = 'Failed to duplicate user';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (typeof err.response?.data === 'string') {
        errorMessage = err.response.data;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setError('');
    setEmailExists(false);
    setEmailValidated(false);
    onClose();
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setEmailValidated(false);
    setError('');
  };

  // Determine if submit should be disabled
  const isSubmitDisabled = loading || validating || !email.trim() || emailExists || !isValidEmail(email.trim());

  // Get email field helper text and status
  const getEmailHelperText = () => {
    if (validating) return 'Checking email availability...';
    if (emailExists) return 'This email is already in use';
    if (emailValidated && !emailExists) return 'Email is available';
    return 'The new user will be created with this email address';
  };

  const getEmailAdornment = () => {
    if (validating) return <CircularProgress size={20} />;
    if (emailValidated && !emailExists && isValidEmail(email.trim())) return <ValidIcon color="success" />;
    if (emailExists) return <ErrorIcon color="error" />;
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        'data-testid': 'duplicate-user-dialog'
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DuplicateIcon color="primary" />
        Duplicate User
      </DialogTitle>

      <DialogContent>
        {user && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Creating a copy of:
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {user.name} ({user.email})
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          required
          fullWidth
          label="New Email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="Enter unique email for the new user"
          helperText={getEmailHelperText()}
          margin="normal"
          disabled={loading}
          error={emailExists || (error && !email)}
          color={emailValidated && !emailExists && isValidEmail(email.trim()) ? 'success' : undefined}
          InputProps={{
            endAdornment: getEmailAdornment()
          }}
          inputProps={{
            'data-testid': 'duplicate-user-email-input'
          }}
        />

        <TextField
          fullWidth
          label="New Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name for the new user"
          helperText="Leave empty to use default: Copy of {original name}"
          margin="normal"
          disabled={loading}
          inputProps={{
            'data-testid': 'duplicate-user-name-input'
          }}
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Note: The duplicated user will be created with:
          </Typography>
          <Typography variant="body2" color="text.secondary" component="ul" sx={{ mt: 0.5, pl: 2 }}>
            <li>Same application, ACL, and status</li>
            <li>Same profile settings</li>
            <li>Disabled by default (for safety)</li>
            <li>A random password (use reset password to set a new one)</li>
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={isSubmitDisabled}
          startIcon={loading || validating ? <CircularProgress size={20} /> : <DuplicateIcon />}
          data-testid="duplicate-user-submit-button"
        >
          {validating ? 'Validating...' : 'Duplicate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DuplicateUserDialog;
