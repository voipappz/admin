import { useCallback } from 'react';

const useCustomFooter = (onClearFilter) => {
  const handleClearFilter = useCallback(() => {
    if (onClearFilter) onClearFilter();
  }, [onClearFilter]);

  return { handleClearFilter };
};

export default useCustomFooter;
