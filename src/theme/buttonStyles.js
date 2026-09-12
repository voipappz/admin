/**
 * Global Button Styles
 * Consistent button styling to be used across the entire application
 */

export const primaryButtonStyle = {
  backgroundColor: '#65758E',
  color: 'white',
  fontWeight: 500,
  fontSize: '0.875rem',
  textTransform: 'none',
  px: 2.5,
  py: 0.75,
  fontFamily: 'Rubik, sans-serif',
  borderRadius: '6px',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: '#4FA3A6',
    boxShadow: 'none',
  },
  '&:active': {
    backgroundColor: '#3d9497',
  },
  '&.Mui-disabled': {
    backgroundColor: '#d1d5db',
    color: '#9ca3af',
  }
};

export const secondaryButtonStyle = {
  backgroundColor: '#f3f4f6',
  color: '#374151',
  fontWeight: 500,
  fontSize: '0.875rem',
  textTransform: 'none',
  px: 2.5,
  py: 0.75,
  fontFamily: 'Rubik, sans-serif',
  borderRadius: '6px',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: '#e5e7eb',
    boxShadow: 'none',
  },
  '&:active': {
    backgroundColor: '#d1d5db',
  }
};

export const outlinedButtonStyle = {
  backgroundColor: 'transparent',
  color: '#65758E',
  fontWeight: 500,
  fontSize: '0.875rem',
  textTransform: 'none',
  px: 2.5,
  py: 0.75,
  fontFamily: 'Rubik, sans-serif',
  borderRadius: '6px',
  border: '1px solid #65758E',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: 'rgba(101, 117, 142, 0.04)',
    border: '1px solid #65758E',
    boxShadow: 'none',
  },
  '&:active': {
    backgroundColor: 'rgba(101, 117, 142, 0.12)',
  }
};

export const dangerButtonStyle = {
  backgroundColor: '#ef4444',
  color: 'white',
  fontWeight: 500,
  fontSize: '0.875rem',
  textTransform: 'none',
  px: 2.5,
  py: 0.75,
  fontFamily: 'Rubik, sans-serif',
  borderRadius: '6px',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: '#dc2626',
    boxShadow: 'none',
  },
  '&:active': {
    backgroundColor: '#b91c1c',
  }
};

export const successButtonStyle = {
  backgroundColor: '#10b981',
  color: 'white',
  fontWeight: 500,
  fontSize: '0.875rem',
  textTransform: 'none',
  px: 2.5,
  py: 0.75,
  fontFamily: 'Rubik, sans-serif',
  borderRadius: '6px',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: '#059669',
    boxShadow: 'none',
  },
  '&:active': {
    backgroundColor: '#047857',
  }
};

// Button Group styles for connected buttons
export const buttonGroupStyle = {
  borderRadius: '6px',
  overflow: 'hidden',
  boxShadow: 'none',
  '& .MuiButton-root': {
    ...primaryButtonStyle,
    borderRadius: 0,
    '&:not(:last-child)': {
      borderRight: '1px solid rgba(255, 255, 255, 0.2)',
    }
  }
};

// Icon Button styles
export const iconButtonStyle = {
  color: '#65758E',
  fontFamily: 'Rubik, sans-serif',
  '&:hover': {
    backgroundColor: 'rgba(101, 117, 142, 0.08)',
  }
};

// Small button variant
export const smallButtonStyle = {
  ...primaryButtonStyle,
  fontSize: '0.75rem',
  px: 2,
  py: 0.5,
};

// Large button variant
export const largeButtonStyle = {
  ...primaryButtonStyle,
  fontSize: '1rem',
  px: 3,
  py: 1,
};
