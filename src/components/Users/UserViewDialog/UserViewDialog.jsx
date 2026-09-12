import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import {
  Person as PersonIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  AccountCircle as AccountCircleIcon
} from '@mui/icons-material';
import { usersApi } from '../../../services/api/usersApi';
import { Z } from '../../../utils/zIndex.js';

/**
 * UserViewDialog Component
 * Modal dialog for viewing user details from queue agent selection
 */
export const UserViewDialog = ({ open, onClose, userUuid }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      if (!userUuid || !open) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        console.log('UserViewDialog: Loading user:', userUuid);
        const userData = await usersApi.getUser(userUuid);
        console.log('UserViewDialog: User loaded:', userData);
        setUser(userData);
      } catch (err) {
        console.error('UserViewDialog: Error loading user:', err);
        setError(err.message || 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userUuid, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setUser(null);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: Z.L3.DIALOG }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon />
            <Typography variant="h6">User Details</Typography>
          </Box>
          <Button onClick={onClose} size="small" sx={{ minWidth: 'auto' }}>
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        ) : user ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            {/* Name */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Name
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ pl: 3.5 }}>
                {user.name || 'N/A'}
              </Typography>
            </Box>

            {/* Email */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Email
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ pl: 3.5 }}>
                {user.email || 'N/A'}
              </Typography>
            </Box>

            {/* Username */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <AccountCircleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Username
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ pl: 3.5 }}>
                {user.username || 'N/A'}
              </Typography>
            </Box>

            {/* Status */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                Status
              </Typography>
              <Chip
                label={user.enabled ? 'Enabled' : 'Disabled'}
                color={user.enabled ? 'success' : 'default'}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Box>

            {/* Environment (if available) */}
            {user.environment?.name && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                  Application
                </Typography>
                <Typography variant="body1">
                  {user.environment.name}
                </Typography>
              </Box>
            )}

            {/* UUID (for debugging/reference) */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                UUID
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                {user.uuid}
              </Typography>
            </Box>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserViewDialog;
