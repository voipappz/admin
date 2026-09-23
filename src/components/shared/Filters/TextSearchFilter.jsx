import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

/**
 * Text Search Filter Component
 *
 * Provides a text input field with search icon for filtering data.
 * Based on AngularJS pattern: <input type="search" ng-model="filter.search.name" st-search="name">
 *
 * @param {Object} props
 * @param {string} props.field - API field name (e.g., 'name', 'email')
 * @param {string} props.label - Display label for the input
 * @param {string} props.value - Current filter value
 * @param {function} props.onChange - Callback: (field, value) => void
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.fullWidth - Whether input should be full width (default: true)
 * @param {Object} props.sx - Additional Material-UI sx props
 */
const TextSearchFilter = ({
  field,
  label,
  value = '',
  onChange,
  placeholder = `Search by ${label?.toLowerCase() || field}...`,
  fullWidth = true,
  sx = {},
  inputRef,
  inputProps,
  endAdornment
}) => {
  const handleChange = (event) => {
    onChange(field, event.target.value);
  };

  return (
    <TextField
      label={label}
      value={value}
      inputRef={inputRef}
      inputProps={inputProps}
      onChange={handleChange}
      placeholder={placeholder}
      fullWidth={fullWidth}
      size="small"
      variant="outlined"
      InputProps={{
        endAdornment,
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'background.paper',
        },
        ...sx
      }}
    />
  );
};

export default TextSearchFilter;
