import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  TextField,
  Divider,
  IconButton,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Avatar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import './TicketDetailView.css';

/**
 * Get color for status chip
 */
const getStatusColor = (status) => {
  switch (status) {
    case 'new':
      return 'info';
    case 'open':
      return 'warning';
    case 'pending':
      return 'default';
    case 'hold':
      return 'secondary';
    case 'solved':
      return 'success';
    case 'closed':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Get color for priority chip
 */
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent':
      return 'error';
    case 'high':
      return 'warning';
    case 'normal':
      return 'primary';
    case 'low':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Format relative time
 */
const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * TicketDetailView Component
 * Shows ticket details, comments thread, and reply form
 */
const TicketDetailView = ({
  ticket,
  comments,
  loading,
  onClose,
  onUpdateTicket,
  onAddComment,
}) => {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStatusEdit, setShowStatusEdit] = useState(false);
  const [showPriorityEdit, setShowPriorityEdit] = useState(false);

  if (!ticket) {
    return (
      <Paper className="ticket-detail-view" elevation={3}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <Typography color="text.secondary">Select a ticket to view details</Typography>
          )}
        </Box>
      </Paper>
    );
  }

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(ticket.id, replyText.trim());
      setReplyText('');
    } catch {
      // Error handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (event) => {
    const newStatus = event.target.value;
    setShowStatusEdit(false);
    try {
      await onUpdateTicket(ticket.id, { status: newStatus });
    } catch {
      // Error handled in parent
    }
  };

  const handlePriorityChange = async (event) => {
    const newPriority = event.target.value;
    setShowPriorityEdit(false);
    try {
      await onUpdateTicket(ticket.id, { priority: newPriority });
    } catch {
      // Error handled in parent
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmitReply();
    }
  };

  return (
    <Paper className="ticket-detail-view" elevation={3}>
      {/* Header */}
      <Box className="ticket-detail-header">
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Ticket #{ticket.id}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5, lineHeight: 1.3 }}>
              {ticket.subject}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Status and Priority */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {showStatusEdit ? (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={ticket.status}
                onChange={handleStatusChange}
                autoFocus
                onBlur={() => setShowStatusEdit(false)}
              >
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="hold">On Hold</MenuItem>
                <MenuItem value="solved">Solved</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
          ) : (
            <Chip
              label={ticket.status?.charAt(0).toUpperCase() + ticket.status?.slice(1) || 'Unknown'}
              color={getStatusColor(ticket.status)}
              size="small"
              onClick={() => setShowStatusEdit(true)}
              sx={{ cursor: 'pointer' }}
            />
          )}

          {showPriorityEdit ? (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={ticket.priority}
                onChange={handlePriorityChange}
                autoFocus
                onBlur={() => setShowPriorityEdit(false)}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
          ) : (
            <Chip
              label={ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1) || 'Normal'}
              color={getPriorityColor(ticket.priority)}
              size="small"
              variant="outlined"
              onClick={() => setShowPriorityEdit(true)}
              sx={{ cursor: 'pointer' }}
            />
          )}

          {(ticket.requester_email || ticket.requester_name) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {ticket.requester_email || ticket.requester_name}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            <ScheduleIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              Updated {formatRelativeTime(ticket.updated_at)}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Description */}
      <Box className="ticket-detail-description">
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Description
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {ticket.description || 'No description provided.'}
        </Typography>
      </Box>

      <Divider />

      {/* Comments Section */}
      <Box className="ticket-detail-comments">
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Conversation ({comments?.length || 0})
        </Typography>

        {loading && comments?.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : comments?.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No comments yet
          </Typography>
        ) : (
          <Box className="comments-list">
            {comments?.map((comment, index) => (
              <Box
                key={comment.id || index}
                className={`comment-item ${comment.public === false ? 'internal' : ''}`}
              >
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: comment.public === false ? 'grey.400' : 'primary.main' }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {comment.author?.name || comment.author_name || 'Support'}
                      </Typography>
                      {comment.public === false && (
                        <Chip label="Internal" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatRelativeTime(comment.created_at)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        color: 'text.primary',
                        lineHeight: 1.5,
                      }}
                    >
                      {comment.body || comment.plain_body || comment.html_body?.replace(/<[^>]*>/g, '') || ''}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Reply Form */}
      <Box className="ticket-detail-reply">
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="Type your reply... (Ctrl+Enter to send)"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting || ticket.status === 'closed'}
          size="small"
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            variant="contained"
            endIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleSubmitReply}
            disabled={!replyText.trim() || isSubmitting || ticket.status === 'closed'}
          >
            {isSubmitting ? 'Sending...' : 'Send Reply'}
          </Button>
        </Box>
        {ticket.status === 'closed' && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            This ticket is closed. Reopen it to add replies.
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default TicketDetailView;
