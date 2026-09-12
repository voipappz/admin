const useColumnSelector = (onToggle, onClose) => {
  const handleToggle = (field) => {
    if (onToggle) onToggle(field);
  };
  const handleClose = () => {
    if (onClose) onClose();
  };
  return { handleToggle, handleClose };
};

export default useColumnSelector;
