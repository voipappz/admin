import { useCallback } from 'react';

const useRecordingDialog = (onClose) => {
  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  return { handleClose };
};

export default useRecordingDialog;
