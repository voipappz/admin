import React from 'react';
import { Box, Button, Paper, Collapse } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';

/**
 * Filter Bar Container Component
 *
 * Provides a container for filter components with Apply/Clear action buttons.
 * Based on AngularJS pattern with apply/clear functionality.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Filter components to render
 * @param {function} props.onApply - Callback when Apply button clicked
 * @param {function} props.onClear - Callback when Clear button clicked
 * @param {boolean} props.showActions - Whether to show Apply/Clear buttons (default: true)
 * @param {boolean} props.expanded - Whether filter bar is expanded (default: true)
 * @param {boolean} props.loading - Whether filters are being applied (default: false)
 * @param {Object} props.sx - Additional Material-UI sx props
 */
const FilterBar = ({
  children,
  onApply,
  onClear,
  showActions = true,
  expanded = true,
  loading = false,
  sx = {}
}) => {
  return (
    <Collapse in={expanded}>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: 'background.default',
          borderRadius: 1,
          ...sx
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {/* Filter Fields */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)'
              },
              gap: 2
            }}
          >
            {children}
          </Box>

          {/* Action Buttons */}
          {showActions && (
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'flex-end',
                pt: 1
              }}
            >
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={onClear}
                disabled={loading}
                sx={{
                  minWidth: 100
                }}
              >
                Clear
              </Button>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={onApply}
                disabled={loading}
                sx={{
                  minWidth: 100
                }}
              >
                {loading ? 'Applying...' : 'Apply'}
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Collapse>
  );
};

export default FilterBar;
