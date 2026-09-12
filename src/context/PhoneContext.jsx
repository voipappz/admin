import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const PhoneContext = createContext();

export const usePhoneContext = () => {
  const context = useContext(PhoneContext);
  if (!context) {
    throw new Error('usePhoneContext must be used within PhoneProvider');
  }
  return context;
};

export const PhoneProvider = ({ children }) => {
  const [isPhoneEnabled] = useState(false);
  const [isPhoneVisible, setIsPhoneVisible] = useState(false);
  const [sipConfig] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [agentStatus, setAgentStatus] = useState('Available');
  const [registrationStatus] = useState('Disconnected');
  const [webrtcUser, setWebrtcUser] = useState(null);

  const showPhone = useCallback(() => setIsPhoneVisible(true), []);
  const hidePhone = useCallback(() => setIsPhoneVisible(false), []);

  const openWebRTC = useCallback((user) => {
    setWebrtcUser(user);
    setIsPhoneVisible(true);
  }, []);

  const closeWebRTC = useCallback(() => {
    setWebrtcUser(null);
    setIsPhoneVisible(false);
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const changeAgentStatus = useCallback((newStatus) => setAgentStatus(newStatus), []);

  const value = useMemo(() => ({
    isPhoneEnabled,
    isPhoneVisible,
    sipConfig,
    notifications,
    wsConnected: false,
    actionCableConnected: false,
    agentStatus,
    registrationStatus,
    isAutoRegisterEnabled: false,
    audioDevices: { input: [], output: [] },
    selectedAudioDevice: { input: null, output: null },
    configureSIP: () => {},
    togglePhone: () => {},
    showPhone,
    hidePhone,
    webrtcUser,
    openWebRTC,
    closeWebRTC,
    sendNotification: () => {},
    clearNotifications,
    removeNotification,
    changeAgentStatus,
    toggleAutoRegister: () => {},
    manualRegister: () => {},
    updateAudioDevices: () => {},
    selectAudioDevice: () => {},
  }), [
    isPhoneEnabled,
    isPhoneVisible,
    sipConfig,
    notifications,
    agentStatus,
    registrationStatus,
    webrtcUser,
    showPhone,
    hidePhone,
    openWebRTC,
    closeWebRTC,
    clearNotifications,
    removeNotification,
    changeAgentStatus,
  ]);

  return (
    <PhoneContext.Provider value={value}>
      {children}
    </PhoneContext.Provider>
  );
};
