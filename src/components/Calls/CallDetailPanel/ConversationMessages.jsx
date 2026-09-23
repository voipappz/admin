import React, { useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import MessageIcon from '@mui/icons-material/Message';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneCallbackIcon from '@mui/icons-material/PhoneCallback';
import PhoneMissedIcon from '@mui/icons-material/PhoneMissed';
import VoicemailIcon from '@mui/icons-material/Voicemail';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
// Reuse existing Conversations bubble styling
import '../../Conversations/Conversations.css';

const formatMessageTime = (dateString) =>
  new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getDateSeparator = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

const getInteractionIcon = (type) => {
  switch (type) {
    case 'inbound': return <PhoneCallbackIcon sx={{ color: '#10b981' }} />;
    case 'outbound': return <PhoneIcon sx={{ color: '#3b82f6' }} />;
    case 'missed': return <PhoneMissedIcon sx={{ color: '#ef4444' }} />;
    case 'voicemail': return <VoicemailIcon sx={{ color: '#f59e0b' }} />;
    default: return <MessageIcon sx={{ color: 'var(--mui-palette-text-secondary)' }} />;
  }
};

const ConversationMessages = ({ messages, loading, error, emptyMessage, onRetry }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 5 }}>
        <CircularProgress size={40} sx={{ color: '#65758E' }} />
        <Typography variant="body2" sx={{ fontFamily: 'Rubik, sans-serif', color: 'var(--mui-palette-text-secondary)' }}>
          Loading conversation...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 5 }}>
        <Typography variant="body2" sx={{ fontFamily: 'Rubik, sans-serif', color: '#ef4444' }}>
          {error}
        </Typography>
        {onRetry && <Button onClick={onRetry}>Retry</Button>}
      </Box>
    );
  }

  if (!messages.length) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 5 }}>
        <MessageIcon sx={{ fontSize: 56, color: '#d1d5db' }} />
        <Typography variant="h6" sx={{ fontFamily: 'Rubik, sans-serif', color: 'var(--mui-palette-text-secondary)' }}>
          {emptyMessage || 'No conversation found'}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'Rubik, sans-serif', color: '#d1d5db', textAlign: 'center' }}>
          No conversation is linked to this call
        </Typography>
      </Box>
    );
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = getDateSeparator(message.timestamp || message.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <Box className="chat-messages" sx={{ flex: 1, overflow: 'auto' }}>
      {Object.entries(groupedMessages).map(([date, msgs]) => (
        <Box key={date}>
          <Box className="date-separator">
            <Typography variant="caption" sx={{
              backgroundColor: 'rgba(101, 117, 142,0.1)',
              color: '#65758E',
              padding: '4px 12px',
              borderRadius: '12px',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}>
              {date}
            </Typography>
          </Box>

          {msgs.map((message) => (
            <Box
              key={message.id}
              className={`message ${message.direction === 'outbound' ? 'outbound' : 'inbound'} ${message.type === 'note' ? 'note-message' : ''}`}
            >
              {message.type === 'call' ? (
                <Box className="call-event">
                  {getInteractionIcon(message.callType)}
                  <Typography variant="body2" sx={{ fontFamily: 'Rubik, sans-serif' }}>
                    {message.callType === 'inbound' ? 'Incoming call' :
                     message.callType === 'outbound' ? 'Outgoing call' :
                     message.callType === 'missed' ? 'Missed call' : 'Voicemail'}
                    {message.duration && ` - ${message.duration}`}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {formatMessageTime(message.timestamp || message.created_at)}
                  </Typography>
                </Box>
              ) : (
                <Box className={`message-bubble ${message.type === 'note' ? 'note-bubble' : ''}`}>
                  {message.type === 'note' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <StickyNote2Icon sx={{ fontSize: 12, color: '#f57f17' }} />
                      <Typography variant="caption" sx={{
                        color: '#f57f17',
                        fontFamily: 'Rubik, sans-serif',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                      }}>
                        Private Note
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="body2" sx={{
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {message.body || message.content}
                  </Typography>
                  <Box className="message-time-wrapper">
                    <Typography variant="caption" className="message-time">
                      {formatMessageTime(message.timestamp || message.created_at)}
                    </Typography>
                    {message.direction === 'outbound' && message.type !== 'note' && (
                      <Box className="message-status">
                        {message.status === 'read' ? <DoneAllIcon sx={{ fontSize: 14, color: '#65758E' }} /> :
                         message.status === 'delivered' ? <DoneAllIcon sx={{ fontSize: 14, opacity: 0.6 }} /> :
                         <DoneIcon sx={{ fontSize: 14, opacity: 0.6 }} />}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      ))}
      <div ref={messagesEndRef} />
    </Box>
  );
};

export default ConversationMessages;
