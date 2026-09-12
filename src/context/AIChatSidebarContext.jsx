import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const AIChatSidebarContext = createContext({
  aiDrawerOpen: false,
  openAIDrawer: () => {},
  closeAIDrawer: () => {},
  toggleAIDrawer: () => {},
  aiSidebarOpen: true,
  toggleAISidebar: () => {},
});

export const AIChatSidebarProvider = ({ children }) => {
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(true);

  const openAIDrawer = useCallback(() => setAiDrawerOpen(true), []);
  const closeAIDrawer = useCallback(() => setAiDrawerOpen(false), []);
  const toggleAIDrawer = useCallback(() => setAiDrawerOpen(prev => !prev), []);
  const toggleAISidebar = useCallback(() => setAiSidebarOpen(prev => !prev), []);

  const value = useMemo(() => ({
    aiDrawerOpen, openAIDrawer, closeAIDrawer, toggleAIDrawer,
    aiSidebarOpen, toggleAISidebar
  }), [aiDrawerOpen, openAIDrawer, closeAIDrawer, toggleAIDrawer, aiSidebarOpen, toggleAISidebar]);

  return (
    <AIChatSidebarContext.Provider value={value}>
      {children}
    </AIChatSidebarContext.Provider>
  );
};

export const useAIChatSidebar = () => useContext(AIChatSidebarContext);
