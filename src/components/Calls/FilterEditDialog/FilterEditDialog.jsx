import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  OutlinedInput,
  Checkbox,
  ListItemText,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../../../context/AuthContext';
import { config } from '../../../config';

const FilterEditDialog = ({
  open,
  onClose,
  onSave,
  editingFilter,
  editValue,
  editOperator,
  onValueChange,
  onOperatorChange
}) => {
  const { access } = useAuth();
  const [environments, setEnvironments] = useState([]);
  const [loadingEnvironments, setLoadingEnvironments] = useState(false);
  
  // Fetch environments from API when editing environment filter
  useEffect(() => {
    const fetchEnvironments = async () => {
      if (!access || !editingFilter || editingFilter.type !== 'environment') return;
      
      setLoadingEnvironments(true);
      try {
        const response = await fetch(`${config.api.environments}?page=1&per_page=999`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': access ? `Bearer ${access}` : '',
          },
        });
        
        if (response.ok) {
          const data = await response.json();

          
          if (Array.isArray(data)) {
            // The API returns direct environment objects with uuid, name, and selected properties
            const environmentsArray = data
              .filter(env => env.uuid && env.name) // Filter out any invalid entries
              .map(env => ({
                value: env.uuid,
                label: env.name
              }))
              .sort((a, b) => a.label.localeCompare(b.label));
            

            setEnvironments(environmentsArray);
          } else {
            console.warn('FilterEditDialog - API response is not an array:', data);
            setEnvironments([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch environments:', error);
      } finally {
        setLoadingEnvironments(false);
      }
    };
    
    if (open && editingFilter && editingFilter.type === 'environment') {
      fetchEnvironments();
    }
  }, [open, editingFilter, access]);
  
  if (!editingFilter) return null;

  const getFieldLabel = (type) => {
    switch (type) {
      case 'caller': return 'Agent';
      case 'callee': return 'Phone Number';
      case 'country': return 'Country';
      case 'direction': return 'Direction';
      case 'environment': return 'Application';
      case 'talk_duration': return 'Talk Duration (HH:MM:SS or seconds)';
      case 'cause': return 'Call Result';
      default: return 'Value';
    }
  };

  const renderValueInput = () => {
    switch (editingFilter.type) {
      case 'direction':
        return (
          <FormControl fullWidth>
            <InputLabel>Direction</InputLabel>
            <Select
              value={editValue}
              onChange={(e) => onValueChange(e.target.value)}
              label="Direction"
            >
              <MenuItem value="incoming">Incoming</MenuItem>
              <MenuItem value="outgoing">Outgoing</MenuItem>
            </Select>
          </FormControl>
        );
      
      case 'cause':
        return (
          <FormControl fullWidth>
            <InputLabel>Call Result</InputLabel>
            <Select
              value={editValue}
              onChange={(e) => onValueChange(e.target.value)}
              label="Call Result"
            >
              <MenuItem value="answer">Answer</MenuItem>
              <MenuItem value="no_answer">No Answer</MenuItem>
              <MenuItem value="busy">Busy</MenuItem>
              <MenuItem value="cancel">Cancel</MenuItem>
            </Select>
          </FormControl>
        );
      
      case 'country':
        return (
          <FormControl fullWidth>
            <InputLabel>Country Code</InputLabel>
            <Select
              value={editValue}
              onChange={(e) => onValueChange(e.target.value)}
              label="Country Code"
            >
              <MenuItem value="US">United States</MenuItem>
              <MenuItem value="GB">United Kingdom</MenuItem>
              <MenuItem value="CA">Canada</MenuItem>
              <MenuItem value="AU">Australia</MenuItem>
              <MenuItem value="DE">Germany</MenuItem>
              <MenuItem value="FR">France</MenuItem>
              <MenuItem value="IT">Italy</MenuItem>
              <MenuItem value="ES">Spain</MenuItem>
              <MenuItem value="NL">Netherlands</MenuItem>
              <MenuItem value="BE">Belgium</MenuItem>
              <MenuItem value="CH">Switzerland</MenuItem>
              <MenuItem value="AT">Austria</MenuItem>
              <MenuItem value="SE">Sweden</MenuItem>
              <MenuItem value="NO">Norway</MenuItem>
              <MenuItem value="DK">Denmark</MenuItem>
              <MenuItem value="FI">Finland</MenuItem>
              <MenuItem value="IL">Israel</MenuItem>
              <MenuItem value="JP">Japan</MenuItem>
              <MenuItem value="KR">South Korea</MenuItem>
              <MenuItem value="CN">China</MenuItem>
              <MenuItem value="IN">India</MenuItem>
              <MenuItem value="BR">Brazil</MenuItem>
              <MenuItem value="MX">Mexico</MenuItem>
            </Select>
          </FormControl>
        );
      
      case 'environment':
        return (
          <FormControl fullWidth>
            <InputLabel>Applications</InputLabel>
            <Select
              multiple
              value={Array.isArray(editValue) ? editValue : []}
              onChange={(e) => onValueChange(e.target.value)}
              input={<OutlinedInput label="Applications" />}
              renderValue={(selected) => {
                if (!selected || selected.length === 0) return 'No applications selected';
                if (selected.length === 1) {
                  const env = environments.find(e => e.value === selected[0]);
                  return env ? env.label : selected[0];
                }
                return `${selected.length} applications selected`;
              }}
              disabled={loadingEnvironments}
            >
              {loadingEnvironments ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Loading environments...
                </MenuItem>
              ) : (
                environments.map((env) => (
                  <MenuItem key={env.value} value={env.value}>
                    <Checkbox 
                      checked={Array.isArray(editValue) && editValue.includes(env.value)} 
                      size="small"
                    />
                    <ListItemText primary={env.label} />
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        );
      
      default:
        return (
          <TextField
            fullWidth
            label={getFieldLabel(editingFilter.type)}
            value={editValue}
            onChange={(e) => onValueChange(e.target.value)}
            type="text"
            placeholder={editingFilter.type === 'talk_duration' ? '01:30:45 or 5445' : ''}
            helperText={editingFilter.type === 'talk_duration' ? 'Enter as HH:MM:SS (e.g., 01:30:45) or seconds (e.g., 5445)' : ''}
          />
        );
    }
  };

  const renderOperatorSelect = () => {
    if (editingFilter.type !== 'talk_duration') return null;

    return (
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>Operator</InputLabel>
        <Select
          value={editOperator}
          onChange={(e) => onOperatorChange(e.target.value)}
          label="Operator"
        >
          <MenuItem value="gte">Greater than or equal (≥)</MenuItem>
          <MenuItem value="lte">Less than or equal (≤)</MenuItem>
          <MenuItem value="eq">Equal (=)</MenuItem>
        </Select>
      </FormControl>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Filter</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {renderValueInput()}
          {renderOperatorSelect()}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilterEditDialog;
