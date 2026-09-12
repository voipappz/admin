import React from 'react';
import PropTypes from 'prop-types';
import { Button, IconButton, Tooltip } from '@mui/material';
import { PlayCircleOutline as PlayIcon } from '@mui/icons-material';
import { useTour } from '../../context/TourContext';

/**
 * TourButton Component
 *
 * A button to manually start a tour. Can be icon-only or a full button.
 *
 * @param {string} tourId - The tour ID to start
 * @param {string} tooltip - Tooltip text
 * @param {boolean} iconOnly - Show only an icon button
 * @param {string} label - Button label (when not iconOnly)
 * @param {string} variant - MUI Button variant
 * @param {string} size - Button size
 */
const TourButton = ({
  tourId,
  tooltip = 'Start guided tour',
  iconOnly = true,
  label = 'Start Tour',
  variant = 'text',
  size = 'small',
}) => {
  const { startTour, activeTour } = useTour();

  const handleClick = () => {
    startTour(tourId, true); // Force start
  };

  // Don't show if a tour is already active
  if (activeTour) {
    return null;
  }

  if (iconOnly) {
    return (
      <Tooltip title={tooltip}>
        <IconButton
          size={size}
          onClick={handleClick}
          aria-label={tooltip}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          <PlayIcon fontSize={size} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltip}>
      <Button
        variant={variant}
        size={size}
        startIcon={<PlayIcon />}
        onClick={handleClick}
        sx={{ textTransform: 'none' }}
      >
        {label}
      </Button>
    </Tooltip>
  );
};

TourButton.propTypes = {
  tourId: PropTypes.string.isRequired,
  tooltip: PropTypes.string,
  iconOnly: PropTypes.bool,
  label: PropTypes.string,
  variant: PropTypes.string,
  size: PropTypes.string,
};

export default TourButton;
