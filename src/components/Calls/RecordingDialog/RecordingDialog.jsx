import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, IconButton, Card, CardContent,
  LinearProgress, Slider, Button, Chip
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CloseIcon from '@mui/icons-material/Close';
import SummaryIcon from '@mui/icons-material/Summarize';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import DownloadIcon from '@mui/icons-material/Download';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { formatDuration } from '../../../utils/phoneUtils';
import { primaryButtonStyle } from '../../../theme/buttonStyles';
import './RecordingDialog.css';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const RecordingDialog = ({ open, selectedRecording, analysisLoading, analysisResult, analysisError, onClose, onAnalyze }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Reset state when recording changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);
  }, [selectedRecording?.url]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [selectedRecording?.url]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => console.error('Play failed:', err));
    }
  }, [isPlaying]);

  const handleSeek = useCallback((_, newValue) => {
    const audio = audioRef.current;
    if (audio && duration > 0) {
      audio.currentTime = (newValue / 100) * duration;
    }
  }, [duration]);

  const handleSkip = useCallback((seconds) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
    }
  }, [duration]);

  const handleVolumeChange = useCallback((_, newValue) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newValue / 100;
      setVolume(newValue / 100);
    }
  }, []);

  const handleSpeedChange = useCallback((speed) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = speed;
      setPlaybackRate(speed);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (selectedRecording?.url) {
      const a = document.createElement('a');
      a.href = selectedRecording.url;
      a.download = `recording-${selectedRecording.callId || 'unknown'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [selectedRecording]);

  const handleClose = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    onClose();
  }, [onClose]);

  if (!selectedRecording) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formattedTime = selectedRecording.createdAt
    ? new Date(selectedRecording.createdAt).toLocaleString()
    : '';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          maxHeight: '90vh',
          fontFamily: 'Rubik, sans-serif',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VolumeUpIcon sx={{ color: 'var(--accent-primary)' }} />
          <Typography variant="h6" sx={{ fontFamily: 'Rubik, sans-serif', fontWeight: 600 }}>
            Call Recording
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Call metadata */}
        <Box className="recording-dialog-meta">
          {selectedRecording.caller && (
            <Box className="recording-dialog-meta-item">
              <Typography variant="caption" sx={{ color: 'var(--text-tertiary)', fontFamily: 'Rubik, sans-serif', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PersonIcon sx={{ fontSize: 14 }} /> Agent
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Rubik, sans-serif' }}>
                {selectedRecording.caller}
              </Typography>
            </Box>
          )}
          {selectedRecording.callee && (
            <Box className="recording-dialog-meta-item">
              <Typography variant="caption" sx={{ color: 'var(--text-tertiary)', fontFamily: 'Rubik, sans-serif', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PhoneIcon sx={{ fontSize: 14 }} /> Client
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Rubik, sans-serif' }}>
                {selectedRecording.callee}
              </Typography>
            </Box>
          )}
          {formattedTime && (
            <Box className="recording-dialog-meta-item">
              <Typography variant="caption" sx={{ color: 'var(--text-tertiary)', fontFamily: 'Rubik, sans-serif', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 14 }} /> Date
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Rubik, sans-serif' }}>
                {formattedTime}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Audio player */}
        {selectedRecording.url ? (
          <Box className="recording-dialog-player">
            <audio ref={audioRef} src={selectedRecording.url} preload="metadata" />

            {/* Controls row */}
            <Box className="recording-dialog-player-controls">
              <IconButton onClick={() => handleSkip(-10)} size="small" sx={{ color: 'var(--accent-primary)' }}>
                <Replay10Icon />
              </IconButton>

              <IconButton
                onClick={handlePlayPause}
                sx={{
                  width: 48,
                  height: 48,
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--bg-primary)',
                  '&:hover': { backgroundColor: 'var(--accent-primary-dark)' },
                }}
              >
                {isPlaying ? <PauseIcon sx={{ fontSize: 28 }} /> : <PlayArrowIcon sx={{ fontSize: 28 }} />}
              </IconButton>

              <IconButton onClick={() => handleSkip(10)} size="small" sx={{ color: 'var(--accent-primary)' }}>
                <Forward10Icon />
              </IconButton>

              {/* Progress bar */}
              <Box className="recording-dialog-player-progress">
                <Slider
                  value={progress}
                  onChange={handleSeek}
                  sx={{
                    color: 'var(--accent-primary)',
                    height: 6,
                    '& .MuiSlider-thumb': {
                      width: 14,
                      height: 14,
                      '&:hover, &.Mui-focusVisible': {
                        boxShadow: '0 0 0 6px var(--accent-primary-alpha-15)',
                      },
                    },
                    '& .MuiSlider-rail': { backgroundColor: 'var(--border-light)' },
                  }}
                />
                <Box className="recording-dialog-player-times">
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'Rubik, sans-serif' }}>
                    {formatDuration(Math.floor(currentTime))}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'Rubik, sans-serif' }}>
                    {duration > 0 ? formatDuration(Math.floor(duration)) : '--:--:--'}
                  </Typography>
                </Box>
              </Box>

              {/* Volume */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 100 }}>
                <VolumeDownIcon sx={{ fontSize: 18, color: 'var(--text-tertiary)' }} />
                <Slider
                  value={volume * 100}
                  onChange={handleVolumeChange}
                  size="small"
                  sx={{
                    width: 60,
                    color: 'var(--accent-primary)',
                    '& .MuiSlider-thumb': { width: 10, height: 10 },
                    '& .MuiSlider-rail': { backgroundColor: 'var(--border-light)' },
                  }}
                />
              </Box>
            </Box>

            {/* Speed controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box className="recording-dialog-speed-controls">
                <Typography variant="caption" sx={{ color: 'var(--text-tertiary)', fontFamily: 'Rubik, sans-serif', mr: 0.5 }}>
                  Speed:
                </Typography>
                {SPEED_OPTIONS.map((speed) => (
                  <Chip
                    key={speed}
                    label={`${speed}x`}
                    size="small"
                    variant={playbackRate === speed ? 'filled' : 'outlined'}
                    onClick={() => handleSpeedChange(speed)}
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontFamily: 'Rubik, sans-serif',
                      fontWeight: playbackRate === speed ? 600 : 400,
                      ...(playbackRate === speed
                        ? { backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)' }
                        : { borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }),
                    }}
                  />
                ))}
              </Box>

              <IconButton onClick={handleDownload} size="small" sx={{ color: 'var(--accent-primary)' }}>
                <DownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No recording available
            </Typography>
          </Box>
        )}

        {/* Analysis section */}
        {analysisLoading && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}
        {analysisError && (
          <Typography color="error" sx={{ mt: 2, fontFamily: 'Rubik, sans-serif' }}>
            Analysis error: {analysisError}
          </Typography>
        )}
        {analysisResult && (
          <Card sx={{ mt: 2, borderRadius: '8px', border: '1px solid var(--border-light)' }} elevation={0}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SummaryIcon sx={{ color: 'var(--accent-primary)' }} />
                <Typography variant="h6" sx={{ fontFamily: 'Rubik, sans-serif', fontWeight: 600 }}>
                  Call Summary
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ lineHeight: 1.6, fontFamily: 'Rubik, sans-serif' }}>
                {analysisResult.summary}
              </Typography>
            </CardContent>
          </Card>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {selectedRecording.url && onAnalyze && (
          <Button
            variant="contained"
            onClick={onAnalyze}
            disabled={analysisLoading}
            startIcon={<SummaryIcon />}
            sx={{ ...primaryButtonStyle }}
          >
            {analysisLoading ? 'Analyzing...' : 'Analyze Recording'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RecordingDialog;
