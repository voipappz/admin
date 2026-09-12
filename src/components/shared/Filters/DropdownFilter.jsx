import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

/**
 * Dropdown Filter Component
 *
 * Provides a dropdown select for filtering data by predefined options.
 * Based on AngularJS pattern: <select ng-options="option.uuid as option.name for option in optionsList"
 *                                       ng-model="filter.search.status_uuid">
 *
 * @param {Object} props
 * @param {string} props.field - API field name (e.g., 'status_uuid', 'environment_uuid')
 * @param {string} props.label - Display label for the select
 * @param {string|number} props.value - Current selected value
 * @param {function} props.onChange - Callback: (field, value) => void
 * @param {Array} props.options - Array of option objects: [{value: 'uuid', label: 'Name'}]
 * @param {boolean} props.allowEmpty - Whether to show "All" option (default: true)
 * @param {string} props.emptyLabel - Label for empty/all option (default: 'All')
 * @param {boolean} props.fullWidth - Whether select should be full width (default: true)
 * @param {Object} props.sx - Additional Material-UI sx props
 */
const DropdownFilter = ({
  field,
  label,
  value = '',
  onChange,
  options = [],
  allowEmpty = true,
  emptyLabel = 'All',
  fullWidth = true,
  sx = {}
}) => {
  const handleChange = (event) => {
    onChange(field, event.target.value);
  };

  return (
    <FormControl fullWidth={fullWidth} size="small" sx={sx}>
      <InputLabel id={`${field}-filter-label`}>{label}</InputLabel>
      <Select
        labelId={`${field}-filter-label`}
        id={`${field}-filter`}
        value={value}
        label={label}
        onChange={handleChange}
        sx={{
          backgroundColor: 'background.paper',
        }}
      >
        {allowEmpty && (
          <MenuItem value="">
            <em>{emptyLabel}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default DropdownFilter;
