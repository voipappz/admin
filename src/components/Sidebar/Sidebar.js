// Custom hook for Sidebar component
export const useSidebar = () => {
  const currentYear = new Date().getFullYear();
  
  return {
    currentYear
  };
};
