import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from '@mui/material';
import {
  MoreVert,
  Phone,
  PersonAdd,
  Note,
  ContentCopy,
  History
} from '@mui/icons-material';
import { usePhoneContext } from '../../../context/PhoneContext';
import { useNotification } from '../../../context/NotificationContext';

const CallActions = ({ call, onAddNote }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [noteDialog, setNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  
  const { showPhone } = usePhoneContext();
  const { showNotification } = useNotification();
  
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCallback = () => {
    if (call.caller_number || call.destination_number) {
      const numberToCall = call.direction === 'inbound' ? call.caller_number : call.destination_number;
      
      // Show the phone widget
      showPhone();
      
      // Set the number in the phone (this would need to be implemented in the phone context)
      // For now, we'll just show a notification
      showNotification(`Calling back ${numberToCall}...`, 'info');
      
      console.log('📞 Callback initiated for:', numberToCall);
    }
    handleMenuClose();
  };

  const handleCopyNumber = () => {
    const numberToCopy = call.caller_number || call.destination_number;
    if (numberToCopy) {
      navigator.clipboard.writeText(numberToCopy);
      showNotification(`Number ${numberToCopy} copied to clipboard`, 'success');
    }
    handleMenuClose();
  };

  const handleAddContact = () => {
    // This would integrate with a contacts system
    const number = call.caller_number || call.destination_number;
    console.log('👤 Add to contacts:', number);
    showNotification('Contact integration not implemented yet', 'info');
    handleMenuClose();
  };

  const handleAddNote = () => {
    setNoteDialog(true);
    handleMenuClose();
  };

  const handleSaveNote = () => {
    if (noteText.trim()) {
      onAddNote?.(call.uuid || call.id, noteText.trim());
      showNotification('Note added successfully', 'success');
      setNoteText('');
    }
    setNoteDialog(false);
  };

  const handleShowHistory = () => {
    const number = call.caller_number || call.destination_number;
    console.log('📋 Show history for:', number);
    // This would filter the calls list to show only calls from/to this number
    showNotification(`Showing history for ${number}`, 'info');
    handleMenuClose();
  };

  return (
    <>
      <Tooltip title="Call actions">
        <IconButton size="small" onClick={handleMenuOpen}>
          <MoreVert />
        </IconButton>
      </Tooltip>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { minWidth: 180 }
        }}
      >
        <MenuItem onClick={handleCallback}>
          <ListItemIcon>
            <Phone fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="Call Back" />
        </MenuItem>
        
        <MenuItem onClick={handleCopyNumber}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Copy Number" />
        </MenuItem>
        
        <MenuItem onClick={handleAddContact}>
          <ListItemIcon>
            <PersonAdd fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Add Contact" />
        </MenuItem>
        
        <MenuItem onClick={handleAddNote}>
          <ListItemIcon>
            <Note fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Add Note" />
        </MenuItem>
        
        <MenuItem onClick={handleShowHistory}>
          <ListItemIcon>
            <History fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Show History" />
        </MenuItem>
      </Menu>

      {/* Add Note Dialog */}
      <Dialog open={noteDialog} onClose={() => setNoteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Note"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={`Add a note about this call from ${call.caller_number || call.destination_number || 'Unknown'}...`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveNote} variant="contained" disabled={!noteText.trim()}>
            Save Note
          </Button>
        </DialogActions>
      </Dialog>

    </>
  );
};

export default CallActions;
