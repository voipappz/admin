import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, Box, Typography, IconButton, Avatar,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MessageIcon from '@mui/icons-material/Message';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneCallbackIcon from '@mui/icons-material/PhoneCallback';
import PhoneMissedIcon from '@mui/icons-material/PhoneMissed';
import VoicemailIcon from '@mui/icons-material/Voicemail';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import conversationService from '../../../services/conversationService';
import { useAuth } from '../../../context/AuthContext';
// Reuse the existing Conversations bubble styling
import '../../Conversations/Conversations.css';
import './ConversationDialog.css';

const ConversationDialog = ({ open, onClose, callUuid, callerName, calleeName }) => {
  const { access } = useAuth();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!open || !callUuid) return;

    const fetchConversation = async () => {
      setLoading(true);
      setError(null);
      setMessages([]);
      setConversation(null);

      try {
        // Fetch conversation by call UUID
        const conv = await conversationService.getConversationByCallId(callUuid, access);
        if (!conv) {
          setLoading(false);
          return;
        }

        setConversation(conv);
        const convId = conv.id || conv.uuid;

        // Fetch messages for the conversation
        const msgData = await conversationService.getMessages(convId, access);
        const msgArray = Array.isArray(msgData) ? msgData
          : msgData?.data ? msgData.data
          : msgData?.messages ? msgData.messages
          : [];
        setMessages(msgArray);
      } catch (err) {
        console.error('Error loading conversation:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [open, callUuid, access]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Helper functions (reused from Conversations.jsx pattern)
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
      default: return <MessageIcon sx={{ color: '#6b7280' }} />;
    }
  };

  // Group messages by date (reused from Conversations.jsx)
  const groupedMessages = messages.reduce((groups, message) => {
    const date = getDateSeparator(message.timestamp || message.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});

  const contactName = conversation?.contactName || callerName || 'Unknown';
  const contactInitial = contactName?.charAt(0)?.toUpperCase() || '?';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      className="conversation-dialog"
    >
      {/* Header */}
      <Box className="conversation-dialog-header">
        <Avatar sx={{
          background: 'linear-gradient(135deg, #65758E, #4FA3A6)',
          color: 'white',
          fontWeight: 600,
          width: 40,
          height: 40,
        }}>
          {contactInitial}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{
            fontWeight: 600,
            fontFamily: 'Rubik, sans-serif',
          }}>
            {contactName}
          </Typography>
          <Typography variant="caption" sx={{
            color: '#9ca3af',
            fontFamily: 'Rubik, sans-serif',
          }}>
            {calleeName || conversation?.phoneNumber || ''}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <Box className="conversation-dialog-loading">
            <CircularProgress size={40} sx={{ color: '#65758E' }} />
            <Typography variant="body2" sx={{ fontFamily: 'Rubik, sans-serif' }}>
              Loading conversation...
            </Typography>
          </Box>
        ) : !conversation && !error ? (
          <Box className="conversation-dialog-empty">
            <MessageIcon sx={{ fontSize: 56, color: '#d1d5db' }} />
            <Typography variant="h6" sx={{
              fontFamily: 'Rubik, sans-serif',
              color: '#9ca3af',
            }}>
              No conversation found
            </Typography>
            <Typography variant="body2" sx={{
              fontFamily: 'Rubik, sans-serif',
              color: '#d1d5db',
              textAlign: 'center',
            }}>
              No conversation is linked to this call
            </Typography>
          </Box>
        ) : error ? (
          <Box className="conversation-dialog-empty">
            <Typography variant="body2" sx={{
              fontFamily: 'Rubik, sans-serif',
              color: '#ef4444',
            }}>
              Failed to load conversation: {error}
            </Typography>
          </Box>
        ) : (
          /* Messages - reuses .chat-messages and .message classes from Conversations.css */
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConversationDialog;
