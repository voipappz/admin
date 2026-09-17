import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatIcon from '@mui/icons-material/Chat';
import NoteIcon from '@mui/icons-material/StickyNote2';

const DRAFT_KEY_PREFIX = 'conv_draft_';

const MessageInput = ({ conversationId, onSend, onSendNote }) => {
  const [messageType, setMessageType] = useState('reply');
  const [messageInput, setMessageInput] = useState('');

  // Load draft from localStorage
  useEffect(() => {
    if (!conversationId) return;
    const draft = localStorage.getItem(`${DRAFT_KEY_PREFIX}${conversationId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setMessageInput(parsed.content || '');
        setMessageType(parsed.type || 'reply');
      } catch {
        setMessageInput('');
      }
    } else {
      setMessageInput('');
    }
  }, [conversationId]);

  // Save draft to localStorage
  useEffect(() => {
    if (!conversationId) return;
    if (messageInput.trim()) {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${conversationId}`, JSON.stringify({ content: messageInput, type: messageType }));
    } else {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${conversationId}`);
    }
  }, [messageInput, messageType, conversationId]);

  const handleSend = useCallback(() => {
    if (!messageInput.trim() || !conversationId) return;
    if (messageType === 'note') {
      onSendNote?.(conversationId, messageInput.trim());
    } else {
      onSend?.(conversationId, messageInput.trim());
    }
    setMessageInput('');
    localStorage.removeItem(`${DRAFT_KEY_PREFIX}${conversationId}`);
  }, [messageInput, conversationId, messageType, onSend, onSendNote]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isNote = messageType === 'note';

  return (
    <Box sx={{ borderTop: '1px solid var(--mui-palette-divider)', backgroundColor: isNote ? '#fffde7' : '#f0f2f5' }}>
      {/* Reply/Note Toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1, gap: 1 }}>
        <ToggleButtonGroup
          size="small"
          value={messageType}
          exclusive
          onChange={(e, val) => { if (val) setMessageType(val); }}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '0.75rem',
              py: 0.25,
              px: 1,
              border: '1px solid var(--mui-palette-divider)',
              '&.Mui-selected': {
                backgroundColor: isNote ? '#fff8e1' : 'rgba(101, 117, 142, 0.1)',
                color: isNote ? '#f57f17' : '#65758E',
                borderColor: isNote ? '#ffecb3' : 'rgba(101, 117, 142, 0.3)',
              }
            }
          }}
        >
          <ToggleButton value="reply">
            <ChatIcon sx={{ fontSize: 14, mr: 0.5 }} /> Reply
          </ToggleButton>
          <ToggleButton value="note">
            <NoteIcon sx={{ fontSize: 14, mr: 0.5 }} /> Note
          </ToggleButton>
        </ToggleButtonGroup>
        {isNote && (
          <Typography variant="caption" sx={{ color: '#f57f17', fontFamily: 'Rubik, sans-serif' }}>
            Only visible to your team
          </Typography>
        )}
      </Box>

      {/* Input */}
      <Box sx={{ p: '8px 16px 12px' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder={isNote ? 'Add a private note...' : 'Type a message...'}
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={handleKeyPress}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '24px',
              backgroundColor: 'var(--mui-palette-background-paper)',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '0.9rem',
              '& fieldset': { border: '1px solid var(--mui-palette-divider)' },
              '&:hover fieldset': { borderColor: isNote ? '#f57f17' : '#65758E' },
              '&.Mui-focused fieldset': { borderColor: isNote ? '#f57f17' : '#65758E' }
            },
            '& .MuiOutlinedInput-input': {
              padding: '10px 14px'
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSend}
                  disabled={!messageInput.trim()}
                  sx={{
                    color: messageInput.trim() ? (isNote ? '#f57f17' : '#65758E') : '#d1d5db',
                    '&:hover': {
                      backgroundColor: isNote ? 'rgba(245, 127, 23, 0.08)' : 'rgba(101, 117, 142, 0.08)'
                    }
                  }}
                >
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Box>
  );
};

export default MessageInput;
