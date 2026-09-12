import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  RecordVoiceOver as TTSIcon,
  PlayArrow as PlayIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { announcementsApi } from '../../../services/api/announcementsApi.js';

/**
 * TTSGenerator Component
 * Text-to-speech audio generator for announcements
 *
 * Based on legacy AngularJS patterns from:
 * - /opt/src/va-voipbox-admin/src/views/announcements/new.html (TTS section)
 * - /opt/src/va-voipbox-admin/src/scripts/controllers/announcements/new.js (generateFile function)
 *
 * Features:
 * - TTS Provider selection (required - Google Cloud TTS)
 * - Text input with character limit
 * - Language selection
 * - Audio generation and preview
 * - Visual feedback for generation status
 */
export const TTSGenerator = ({
  onGenerate,
  previewUrl = null,
  generating = false,
  error = null,
  maxLength = 500,
  disabled = false
}) => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('he-IL'); // Hebrew default for Google TTS (must match option value)
  const [providerUuid, setProviderUuid] = useState('');
  const [ttsProviders, setTTSProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Fetch TTS providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      setLoadingProviders(true);
      try {
        const providers = await announcementsApi.getTTSProviders();
        setTTSProviders(providers);
        // Auto-select first provider if only one available
        if (providers.length === 1) {
          setProviderUuid(providers[0].uuid);
        }
      } catch (err) {
        console.error('Error fetching TTS providers:', err);
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchProviders();
  }, []);

  // Available languages for Google TTS
  const languages = [
    { code: 'he-IL', name: 'Hebrew (Israel)' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'fr-FR', name: 'French (France)' },
    { code: 'de-DE', name: 'German (Germany)' },
    { code: 'it-IT', name: 'Italian (Italy)' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'ar-XA', name: 'Arabic' },
    { code: 'ru-RU', name: 'Russian' },
    { code: 'zh-CN', name: 'Chinese (Mandarin)' },
    { code: 'ja-JP', name: 'Japanese' }
  ];

  // Handle generate button click
  const handleGenerate = () => {
    if (!text.trim() || !providerUuid) {
      return;
    }

    onGenerate(text.trim(), language, providerUuid);
  };

  // Check if generate button should be disabled
  const isGenerateDisabled = disabled || generating || !text.trim() || text.length > maxLength || !providerUuid;

  return (
    <Box>
      {/* No TTS Providers Warning */}
      {!loadingProviders && ttsProviders.length === 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>No TTS providers configured.</strong> To use Text-to-Speech, you need to create a TTS provider
            with Google Cloud credentials in the Providers screen first.
          </Typography>
        </Alert>
      )}

      {/* TTS Provider Selection */}
      <FormControl fullWidth sx={{ mb: 2 }} disabled={disabled || generating || loadingProviders} required>
        <InputLabel>TTS Provider *</InputLabel>
        <Select
          value={providerUuid}
          onChange={(e) => setProviderUuid(e.target.value)}
          label="TTS Provider *"
        >
          {loadingProviders ? (
            <MenuItem disabled>Loading providers...</MenuItem>
          ) : ttsProviders.length === 0 ? (
            <MenuItem disabled>No TTS providers available</MenuItem>
          ) : (
            ttsProviders.map((provider) => (
              <MenuItem key={provider.uuid} value={provider.uuid}>
                {provider.name}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* Text Input */}
      <TextField
        label="Text to Convert"
        value={text}
        onChange={(e) => setText(e.target.value)}
        multiline
        rows={4}
        fullWidth
        required
        disabled={disabled || generating || ttsProviders.length === 0}
        placeholder="Enter the text you want to convert to speech..."
        helperText={`${text.length}/${maxLength} characters`}
        error={text.length > maxLength}
        sx={{ mb: 2 }}
      />

      {/* Language Selection */}
      <FormControl fullWidth sx={{ mb: 2 }} disabled={disabled || generating || ttsProviders.length === 0}>
        <InputLabel>Language</InputLabel>
        <Select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          label="Language"
        >
          {languages.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              {lang.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Generate Button */}
      <Button
        variant="contained"
        onClick={handleGenerate}
        disabled={isGenerateDisabled || ttsProviders.length === 0}
        fullWidth
        startIcon={generating ? <CircularProgress size={20} /> : <TTSIcon />}
        sx={{ mb: 2 }}
      >
        {generating ? 'Generating Audio...' : 'Generate Audio'}
      </Button>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Audio Preview */}
      {previewUrl && !generating && (
        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <PlayIcon color="primary" />
            <Typography variant="subtitle2" fontWeight="medium">
              Audio Preview
            </Typography>
          </Box>

          <audio
            controls
            src={previewUrl}
            style={{ width: '100%', marginTop: '8px' }}
          >
            Your browser does not support the audio element.
          </audio>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            This is a preview of the generated audio. You can listen to it before creating the announcement.
          </Typography>
        </Paper>
      )}

      {/* Info Box */}
      {!previewUrl && !generating && ttsProviders.length > 0 && (
        <Alert severity="info" icon={<TTSIcon />}>
          <Typography variant="body2">
            Select a TTS provider, enter text and choose a language, then click "Generate Audio" to create a preview.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default TTSGenerator;
