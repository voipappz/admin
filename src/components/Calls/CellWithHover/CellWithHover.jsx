import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import './CellWithHover.css';

const CellWithHover = ({
  children,
  value,
  onSearch,
  onCopy,
  field,
  searchable = true,
  copyable = true
}) => {
  const handleCopy = (e) => {
    e.stopPropagation();
    if (value) {
      navigator.clipboard.writeText(value.toString());
      if (onCopy) onCopy(value, field);
    }
  };

  const handleSearch = (e) => {
    e.stopPropagation();
    if (value && onSearch) {
      onSearch(value, field);
    }
  };

  return (
    <Box className="cell-with-hover">
      <Box className="cell-content">
        {children}
      </Box>
      {((searchable && onSearch) || copyable) && (
        <Box className="hover-actions">
          {/* No handler means the server has no filter for this field — offering
              a magnifier that leaves the list unchanged is worse than none. */}
          {searchable && onSearch && (
            <Tooltip title={`Search by ${field}`}>
              <IconButton
                size="small"
                onClick={handleSearch}
                sx={{
                  p: 0.25,
                  minWidth: 'auto',
                  '&:hover': {
                    backgroundColor: 'var(--accent-primary-alpha-10)',
                  },
                }}
              >
                <SearchIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          {copyable && (
            <Tooltip title={`Copy ${field}`}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  p: 0.25,
                  minWidth: 'auto',
                  '&:hover': {
                    backgroundColor: 'var(--accent-primary-alpha-10)',
                  },
                }}
              >
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CellWithHover;
