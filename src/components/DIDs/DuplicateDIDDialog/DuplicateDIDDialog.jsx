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
  Alert,
  Chip
} from '@mui/material';
import { ContentCopy as DuplicateIcon, Phone as PhoneIcon, CheckCircle as ValidIcon, Error as ErrorIcon } from '@mui/icons-material';
import { didsApi } from '../../../services/api/didsApi';

/**
 * DuplicateDIDDialog Component
 * Dialog for duplicating an existing DID with a new number
 * Validates number uniqueness before allowing duplication
 */
const DuplicateDIDDialog = ({
  open,
  onClose,
  onDuplicate,
  did,
  loading
}) => {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [numberExists, setNumberExists] = useState(false);
  const [numberValidated, setNumberValidated] = useState(false);

  // Reset form when dialog opens with a new DID
  useEffect(() => {
    if (open && did) {
      setNumber('');
      setName(`Copy of ${did.name || did.number || ''}`);
      setError('');
      setNumberExists(false);
      setNumberValidated(false);
    }
  }, [open, did]);

  // Debounced number validation
  useEffect(() => {
    if (!number.trim()) {
      setNumberExists(false);
      setNumberValidated(false);
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const exists = await didsApi.checkNumberExists(number.trim());
        setNumberExists(exists);
        setNumberValidated(true);
        if (exists) {
          setError(`Number "${number}" already exists. Please use a different number.`);
        } else {
          setError('');
        }
      } catch (err) {
        console.error('Error validating number:', err);
        setNumberValidated(false);
      } finally {
        setValidating(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [number]);

  const handleSubmit = async () => {
    // Validate number
    if (!number.trim()) {
      setError('Number is required');
      return;
    }

    // Check if number exists (prevent submission if it does)
    if (numberExists) {
      setError(`Number "${number}" already exists. Please use a different number.`);
      return;
    }

    // If not validated yet, do a final check
    if (!numberValidated) {
      setValidating(true);
      try {
        const exists = await didsApi.checkNumberExists(number.trim());
        if (exists) {
          setError(`Number "${number}" already exists. Please use a different number.`);
          setNumberExists(true);
          setNumberValidated(true);
          setValidating(false);
          return;
        }
      } catch (err) {
        // Continue with duplication - server will validate
        console.error('Error in final number check:', err);
      }
      setValidating(false);
    }

    setError('');

    try {
      await onDuplicate(did.id || did.uuid, number.trim(), name.trim() || null);
      onClose();
    } catch (err) {
      // Extract error message from various response formats (including 406)
      let errorMessage = 'Failed to duplicate DID';
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
    setNumber('');
    setName('');
    setError('');
    setNumberExists(false);
    setNumberValidated(false);
    onClose();
  };

  const handleNumberChange = (e) => {
    setNumber(e.target.value);
    setNumberValidated(false);
    setError('');
  };

  // Determine if submit should be disabled
  const isSubmitDisabled = loading || validating || !number.trim() || numberExists;

  // Get number field helper text and status
  const getNumberHelperText = () => {
    if (validating) return 'Checking number availability...';
    if (numberExists) return 'This number is already in use';
    if (numberValidated && !numberExists) return 'Number is available';
    return 'The new DID will be created with this number (must be unique)';
  };

  const getNumberAdornment = () => {
    if (validating) return <CircularProgress size={20} />;
    if (numberValidated && !numberExists && number.trim()) return <ValidIcon color="success" />;
    if (numberExists) return <ErrorIcon color="error" />;
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        'data-testid': 'duplicate-did-dialog'
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DuplicateIcon color="primary" />
        Duplicate DID
      </DialogTitle>

      <DialogContent>
        {did && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Creating a copy of:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <PhoneIcon fontSize="small" color="primary" />
              <Typography variant="body1" fontWeight={600}>
                {did.name || 'Unnamed'} - {did.number}
              </Typography>
            </Box>
            {did.bridge_type && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  Bridge:
                </Typography>
                <Chip
                  label={did.bridge_type}
                  size="small"
                  sx={{ ml: 1 }}
                />
                {did.bridge?.name && (
                  <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                    ({did.bridge.name})
                  </Typography>
                )}
              </Box>
            )}
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
          label="New Number"
          value={number}
          onChange={handleNumberChange}
          placeholder="Enter unique number for the new DID"
          helperText={getNumberHelperText()}
          margin="normal"
          disabled={loading}
          error={numberExists || (error && !number)}
          color={numberValidated && !numberExists && number.trim() ? 'success' : undefined}
          InputProps={{
            endAdornment: getNumberAdornment()
          }}
          inputProps={{
            'data-testid': 'duplicate-did-number-input'
          }}
        />

        <TextField
          fullWidth
          label="New Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name for the new DID"
          helperText="Leave empty to use default: Copy of {original name}"
          margin="normal"
          disabled={loading}
          inputProps={{
            'data-testid': 'duplicate-did-name-input'
          }}
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Note: The duplicated DID will be created with:
          </Typography>
          <Typography variant="body2" color="text.secondary" component="ul" sx={{ mt: 0.5, pl: 2 }}>
            <li>Same application and type ({did?.type || 'sip'})</li>
            <li>Same bridge configuration ({did?.bridge_type || 'none'})</li>
            <li>Disabled by default (for safety)</li>
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
          data-testid="duplicate-did-submit-button"
        >
          {validating ? 'Validating...' : 'Duplicate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DuplicateDIDDialog;
