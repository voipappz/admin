import React from 'react';
import PropTypes from 'prop-types';
import { IconButton, Tooltip } from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';
import { openGuide } from '../../../utils/guides';

/**
 * HelpButton Component
 *
 * A reusable help icon button that opens a Zendesk guide article in a new tab.
 * Use this component in screen headers to provide context-sensitive help.
 *
 * @param {string} guideUrl - The URL of the Zendesk guide article
 * @param {string} tooltip - The tooltip text (default: 'View guide')
 * @param {string} size - IconButton size ('small', 'medium', 'large')
 * @param {object} sx - Additional MUI sx styles
 */
const HelpButton = ({
  guideUrl,
  tooltip = 'View guide',
  size = 'small',
  sx = {},
}) => {
  if (!guideUrl) {
    return null;
  }

  const handleClick = () => {
    openGuide(guideUrl);
  };

  return (
    <Tooltip title={tooltip} placement="top">
      <IconButton
        size={size}
        onClick={handleClick}
        aria-label={tooltip}
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'primary.main',
            backgroundColor: 'action.hover',
          },
          ...sx,
        }}
      >
        <HelpOutlineIcon fontSize={size} />
      </IconButton>
    </Tooltip>
  );
};

HelpButton.propTypes = {
  guideUrl: PropTypes.string,
  tooltip: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  sx: PropTypes.object,
};

export default HelpButton;
