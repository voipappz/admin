import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

/**
 * Boolean Filter Component
 *
 * Provides a dropdown for boolean filtering (Yes/No/All).
 * Based on AngularJS pattern: <select ng-model="filter.search.enabled">
 *                                 <option value="">All</option>
 *                                 <option value="true">Enabled</option>
 *                                 <option value="false">Disabled</option>
 *                             </select>
 *
 * @param {Object} props
 * @param {string} props.field - API field name (e.g., 'enabled', 'active')
 * @param {string} props.label - Display label for the select
 * @param {string|boolean} props.value - Current selected value ('', 'true', 'false', or boolean)
 * @param {function} props.onChange - Callback: (field, value) => void
 * @param {string} props.trueLabel - Label for true value (default: 'Yes')
 * @param {string} props.falseLabel - Label for false value (default: 'No')
 * @param {string} props.allLabel - Label for all/empty option (default: 'All')
 * @param {boolean} props.fullWidth - Whether select should be full width (default: true)
 * @param {Object} props.sx - Additional Material-UI sx props
 */
const BooleanFilter = ({
  field,
  label,
  value = '',
  onChange,
  trueLabel = 'Yes',
  falseLabel = 'No',
  allLabel = 'All',
  fullWidth = true,
  sx = {}
}) => {
  const handleChange = (event) => {
    onChange(field, event.target.value);
  };

  // Convert boolean to string for select value
  const selectValue = value === true ? 'true' : value === false ? 'false' : value.toString();

  return (
    <FormControl fullWidth={fullWidth} size="small" sx={sx}>
      <InputLabel id={`${field}-filter-label`}>{label}</InputLabel>
      <Select
        labelId={`${field}-filter-label`}
        id={`${field}-filter`}
        value={selectValue}
        label={label}
        onChange={handleChange}
        sx={{
          backgroundColor: 'background.paper',
        }}
      >
        <MenuItem value="">
          <em>{allLabel}</em>
        </MenuItem>
        <MenuItem value="true">{trueLabel}</MenuItem>
        <MenuItem value="false">{falseLabel}</MenuItem>
      </Select>
    </FormControl>
  );
};

export default BooleanFilter;
