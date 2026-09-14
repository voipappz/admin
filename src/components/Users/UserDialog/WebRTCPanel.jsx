import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Slide
} from '@mui/material';
import {
  Phone,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { usePhoneContext } from '../../../context/PhoneContext';
import { extensionsApi } from '../../../services/api/devicesApi';

const extUuidOf = (u) => u?.extension?.uuid || u?.extension?.id || u?.uuid || null;

/**
 * WebRTCPanel Component
 * Fixed-position chat-widget-style side panel for WebRTC phone.
 * Reads state from PhoneContext — no props needed.
 *
 * Before framing the phone we mint a short-lived (5-min) access token bound to
 * the extension — the page no longer carries a forever-static secret, so phone
 * access expires. Refresh / pop-out mint a fresh token.
 */
const WebRTCPanel = () => {
  const { isPhoneVisible, webrtcUser, closeWebRTC } = usePhoneContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [webrtcUrl, setWebrtcUrl] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);

  // Mint a token, then build the iframe URL. Returns the URL (or null).
  const mintUrl = useCallback(async () => {
    const extensionUuid = extUuidOf(webrtcUser);
    if (!extensionUuid) {
      setError('No device found for this user.');
      return null;
    }
    try {
      const res = await extensionsApi.getWebrtcToken(extensionUuid);
      const token = res?.token;
      if (!token) throw new Error('no token');
      return `/tasks/webrtc?extension_uuid=${extensionUuid}&va_token=${encodeURIComponent(token)}`;
    } catch {
      setError('Could not authorize the phone. Please try again.');
      return null;
    }
  }, [webrtcUser]);

  // (Re)load the phone whenever it opens for a user.
  useEffect(() => {
    let cancelled = false;
    if (isPhoneVisible && webrtcUser) {
      setLoading(true);
      setError(null);
      setWebrtcUrl(null);
      mintUrl().then((url) => {
        if (cancelled) return;
        setWebrtcUrl(url);
        setLoading(false);
      });
    }
    return () => { cancelled = true; };
  }, [isPhoneVisible, webrtcUser, iframeKey, mintUrl]);

  const handleRefresh = () => {
    setIframeKey(k => k + 1); // re-mints a fresh token via the effect
  };

  const handlePopOut = async () => {
    const url = await mintUrl(); // pop-out gets its own short-lived token
    if (url) {
      window.open(url, '_blank', 'width=400,height=600,menubar=no,toolbar=no,location=no,status=no');
    }
  };

  return (
    <Slide direction="up" in={isPhoneVisible && !!webrtcUser} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: { xs: 0, sm: 16 },
          right: { xs: 0, sm: 16 },
          width: { xs: '100%', sm: 380 },
          height: { xs: '70vh', sm: 520 },
          zIndex: 1300,
          borderRadius: { xs: '12px 12px 0 0', sm: '12px' },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 1,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            minHeight: 48
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
            <Phone fontSize="small" />
            <Typography variant="subtitle2" noWrap>
              {webrtcUser?.name || 'WebRTC Phone'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={handleRefresh} sx={{ color: 'inherit' }} title="Refresh">
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handlePopOut} sx={{ color: 'inherit' }} title="Pop out">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={closeWebRTC} sx={{ color: 'inherit' }} title="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, position: 'relative', bgcolor: '#fff' }}>
          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {loading && !error && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">Loading WebRTC...</Typography>
            </Box>
          )}

          {!loading && !error && webrtcUrl && (
            <iframe
              key={iframeKey}
              src={webrtcUrl}
              title="WebRTC Phone"
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="microphone; camera; autoplay"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          )}
        </Box>
      </Paper>
    </Slide>
  );
};

export default WebRTCPanel;
