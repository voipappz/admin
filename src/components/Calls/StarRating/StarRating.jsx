import React from 'react';
import { Box, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import './StarRating.css';
import useStarRating from './useStarRating';

const StarRating = ({ rating, maxRating = 5 }) => {
  useStarRating(); // For future logic/consistency
  return (
    <Box className="star-rating-root">
      {[...Array(maxRating)].map((_, index) => (
        <Box key={index} className={index < rating ? 'star-rating-star-filled' : 'star-rating-star-empty'}>
          {index < rating ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
        </Box>
      ))}
      <Typography variant="body2" sx={{ ml: 1, fontWeight: 500 }}>
        {rating}/{maxRating}
      </Typography>
    </Box>
  );
};

export default StarRating;
