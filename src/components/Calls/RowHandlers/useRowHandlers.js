import { useCallback, useMemo, useEffect, useRef } from 'react';

const useRowHandlers = (allRows, filteredRows, isClientFiltered, hasNextPage, loadingMore, loadMoreCalls, dateRange) => {
  const scrollContainerRef = useRef(null);

  // Custom scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    if (!hasNextPage || loadingMore || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current.querySelector('.MuiDataGrid-virtualScroller');
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrolledPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // Trigger load more when scrolled 90% or more
    if (scrolledPercentage >= 0.9) {
      loadMoreCalls(dateRange);
    }
  }, [hasNextPage, loadingMore, loadMoreCalls, dateRange]);

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current?.querySelector('.MuiDataGrid-virtualScroller');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  // Legacy onRowsScrollEnd handler (as fallback)
  const handleRowsScrollEnd = useCallback((params) => {
    
    if (!hasNextPage || loadingMore) {

      return;
    }

    const { viewportEndRowIndex, visibleRowCount } = params;
    const totalRows = allRows.length;
    
    // Calculate threshold for triggering load more
    const threshold = Math.max(5, Math.floor(visibleRowCount * 0.5)); // Load when 50% of visible rows from bottom
    const shouldLoad = viewportEndRowIndex >= (totalRows - threshold);
    
    if (shouldLoad && hasNextPage && !loadingMore) {
      loadMoreCalls(dateRange);
    }
  }, [hasNextPage, loadingMore, loadMoreCalls, dateRange, allRows.length]);

  // Memoize rows for better performance - use filtered or all rows
  const rows = useMemo(() => {
    const dataToUse = isClientFiltered ? filteredRows : allRows;
    return dataToUse.map((call, index) => ({
      id: call.uuid || index,
      ...call,
    }));
  }, [allRows, filteredRows, isClientFiltered]);

  // Handle copy to clipboard
  const handleCopyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return {
    rows,
    handleRowsScrollEnd,
    handleCopyToClipboard,
    scrollContainerRef
  };
};

export default useRowHandlers;
