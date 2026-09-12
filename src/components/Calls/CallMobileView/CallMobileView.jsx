import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useInView } from 'react-intersection-observer';
import CallMobileCard from '../CallMobileCard/CallMobileCard';

const CallMobileView = ({ rows, onOpenRecording, onRowClick, hasNextPage, loadingMore, onLoadMore }) => {
  // Intersection observer for lazy loading
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px', // Load more when user is 100px away from the bottom
  });

  // Trigger load more when the sentinel comes into view
  React.useEffect(() => {
    if (inView && hasNextPage && !loadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [inView, hasNextPage, loadingMore, onLoadMore]);

  if (!rows || rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', mt: 4, px: 2 }}>
        <Typography variant="h6" color="text.secondary">
          No call data available.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Try adjusting your filters or date range.
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      className="calls-mobile-view" 
      sx={{ 
        px: { xs: 1, sm: 2 }, 
        pb: 2,
        '& .agent-card': {
          mb: 1
        }
      }}
    >
      {rows.map((call) => (
        <CallMobileCard
          key={call.uuid || call.id || Math.random()}
          call={call}
          onOpenRecording={onOpenRecording}
          onRowClick={onRowClick}
        />
      ))}
      
      {/* Loading sentinel for lazy loading */}
      {hasNextPage && (
        <Box
          ref={loadMoreRef}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 3,
            minHeight: '60px'
          }}
        >
          {loadingMore && <CircularProgress size={30} />}
        </Box>
      )}
      
      {/* End of data indicator */}
      {!hasNextPage && rows.length > 0 && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No more calls to load
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CallMobileView;