import { useState, useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Button,
  Paper,
  Typography,
  IconButton,
  Divider,
} from '@mui/material';
import {
  KeyboardArrowRight as RightIcon,
  KeyboardArrowLeft as LeftIcon,
  KeyboardDoubleArrowRight as AllRightIcon,
  KeyboardDoubleArrowLeft as AllLeftIcon,
  DragIndicator as DragIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
} from '@mui/icons-material';

/**
 * TransferList Component
 * A two-column list for selecting items from available to selected
 * Supports reordering of selected items
 *
 * @param {Object} props
 * @param {Array} props.available - Array of available items [{id, name}]
 * @param {Array} props.selected - Array of selected item IDs
 * @param {Function} props.onChange - Callback when selection changes (selectedIds)
 * @param {string} props.availableTitle - Title for available list
 * @param {string} props.selectedTitle - Title for selected list
 * @param {boolean} props.allowReorder - Allow reordering in selected list
 * @param {number} props.height - Height of the lists in pixels
 */
const TransferList = ({
  available = [],
  selected = [],
  onChange,
  availableTitle = 'Available',
  selectedTitle = 'Selected',
  allowReorder = false,
  height = 250,
}) => {
  const [checkedLeft, setCheckedLeft] = useState([]);
  const [checkedRight, setCheckedRight] = useState([]);

  // Get items that are not selected (left list)
  const leftItems = available.filter(item => !selected.includes(item.id));
  // Get items that are selected (right list) - maintain order
  const rightItems = selected.map(id => available.find(item => item.id === id)).filter(Boolean);

  const handleToggleLeft = useCallback((id) => {
    setCheckedLeft(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleToggleRight = useCallback((id) => {
    setCheckedRight(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  // Move checked items from left to right
  const handleMoveRight = useCallback(() => {
    const newSelected = [...selected, ...checkedLeft];
    onChange(newSelected);
    setCheckedLeft([]);
  }, [selected, checkedLeft, onChange]);

  // Move all items from left to right
  const handleMoveAllRight = useCallback(() => {
    const newSelected = [...selected, ...leftItems.map(item => item.id)];
    onChange(newSelected);
    setCheckedLeft([]);
  }, [selected, leftItems, onChange]);

  // Move checked items from right to left
  const handleMoveLeft = useCallback(() => {
    const newSelected = selected.filter(id => !checkedRight.includes(id));
    onChange(newSelected);
    setCheckedRight([]);
  }, [selected, checkedRight, onChange]);

  // Move all items from right to left
  const handleMoveAllLeft = useCallback(() => {
    onChange([]);
    setCheckedRight([]);
  }, [onChange]);

  // Move item up in the selected list
  const handleMoveUp = useCallback((id) => {
    const index = selected.indexOf(id);
    if (index > 0) {
      const newSelected = [...selected];
      [newSelected[index - 1], newSelected[index]] = [newSelected[index], newSelected[index - 1]];
      onChange(newSelected);
    }
  }, [selected, onChange]);

  // Move item down in the selected list
  const handleMoveDown = useCallback((id) => {
    const index = selected.indexOf(id);
    if (index < selected.length - 1) {
      const newSelected = [...selected];
      [newSelected[index], newSelected[index + 1]] = [newSelected[index + 1], newSelected[index]];
      onChange(newSelected);
    }
  }, [selected, onChange]);

  const renderList = (items, checked, onToggle, isRight = false) => (
    <Paper
      variant="outlined"
      sx={{
        width: '100%',
        height,
        overflow: 'auto',
        bgcolor: 'background.paper',
      }}
    >
      <List dense sx={{ p: 0 }}>
        {items.length === 0 ? (
          <ListItem>
            <ListItemText
              primary={
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No items
                </Typography>
              }
            />
          </ListItem>
        ) : (
          items.map((item, index) => (
            <ListItem
              key={item.id}
              disablePadding
              secondaryAction={
                isRight && allowReorder ? (
                  <Box sx={{ display: 'flex' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleMoveUp(item.id)}
                      disabled={index === 0}
                    >
                      <UpIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleMoveDown(item.id)}
                      disabled={index === items.length - 1}
                    >
                      <DownIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : null
              }
            >
              <ListItemButton onClick={() => onToggle(item.id)} dense>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={checked.includes(item.id)}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                  />
                </ListItemIcon>
                {isRight && allowReorder && (
                  <DragIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                )}
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                  sx={{ minWidth: 0 }}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
    </Paper>
  );

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
      {/* Left list - Available */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" gutterBottom color="text.secondary">
          {availableTitle} ({leftItems.length})
        </Typography>
        {renderList(leftItems, checkedLeft, handleToggleLeft, false)}
      </Box>

      {/* Transfer buttons */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 0.5,
          px: 0.5,
        }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={handleMoveAllRight}
          disabled={leftItems.length === 0}
          sx={{ minWidth: 36, p: 0.5 }}
        >
          <AllRightIcon fontSize="small" />
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleMoveRight}
          disabled={checkedLeft.length === 0}
          sx={{ minWidth: 36, p: 0.5 }}
        >
          <RightIcon fontSize="small" />
        </Button>
        <Divider sx={{ my: 0.5 }} />
        <Button
          variant="outlined"
          size="small"
          onClick={handleMoveLeft}
          disabled={checkedRight.length === 0}
          sx={{ minWidth: 36, p: 0.5 }}
        >
          <LeftIcon fontSize="small" />
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleMoveAllLeft}
          disabled={rightItems.length === 0}
          sx={{ minWidth: 36, p: 0.5 }}
        >
          <AllLeftIcon fontSize="small" />
        </Button>
      </Box>

      {/* Right list - Selected */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" gutterBottom color="text.secondary">
          {selectedTitle} ({rightItems.length})
        </Typography>
        {renderList(rightItems, checkedRight, handleToggleRight, true)}
      </Box>
    </Box>
  );
};

export default TransferList;
