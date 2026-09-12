import React from 'react';

/**
 * Shared list/table presentation primitives used across all admin screens so
 * grids stay visually consistent: empty values recede, real data stands out,
 * and rows are easy to scan (zebra striping + clear hover).
 */

// True for values that carry no information and should be de-emphasized.
export const isEmptyDisplayValue = (v) =>
  v === null ||
  v === undefined ||
  v === '' ||
  v === '-' ||
  v === 'N/A' ||
  String(v).toLowerCase() === 'none';

// Faint placeholder so empty/zero cells recede behind real data.
export const EmptyValue = () => (
  <span style={{ color: 'var(--theme-text-tertiary, #9ca3af)', opacity: 0.5 }}>—</span>
);

// Render a value, or a muted em-dash when it is effectively empty.
// Use in table cells: {orEmpty(user.email)} instead of {user.email || '-'}.
export const orEmpty = (value) =>
  isEmptyDisplayValue(value) ? <EmptyValue /> : value;

// Zebra striping + comfortable hover for MUI <TableRow> in a <TableBody> map.
// Spread onto the data row: <TableRow sx={stripedTableRowSx} ...>.
export const stripedTableRowSx = {
  '&:nth-of-type(even)': { backgroundColor: 'var(--theme-bg-secondary)' },
  '&:hover': { backgroundColor: 'var(--theme-hover)' },
};

// Zebra striping + hover for MUI <DataGrid>. Spread into the grid's sx prop.
// Also sets the compact "syslog-style" small type across every list that uses
// this (headers a touch smaller/bolder, cells ~12.8px vs MUI's 14px default).
export const stripedDataGridSx = {
  fontSize: '0.8rem',
  '& .MuiDataGrid-columnHeaderTitle': {
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  '& .MuiDataGrid-cell': {
    fontSize: '0.8rem',
  },
  // Long text ellipsizes instead of breaking the column layout.
  '& .MuiDataGrid-cellContent, & .MuiDataGrid-cell': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& .MuiDataGrid-row:nth-of-type(even)': {
    backgroundColor: 'var(--theme-bg-secondary)',
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'var(--theme-hover)',
  },
};
