import React, { createContext, useContext, useState, useCallback } from 'react';

export interface IncomingCall {
  id: string;
  callerId: string;
  callerName: string;
  timestamp: number;
}

interface CallContextType {
  incomingCall: IncomingCall | null;
  setIncomingCall: (call: IncomingCall | null) => void;
  callNotifications: IncomingCall[];
  addCallNotification: (call: IncomingCall) => void;
  removeCallNotification: (id: string) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callNotifications, setCallNotifications] = useState<IncomingCall[]>([]);

  const addCallNotification = useCallback((call: IncomingCall) => {
    setIncomingCall(call);
    setCallNotifications((prev) => [...prev, call]);

    // Auto-remove after 45 seconds
    setTimeout(() => {
      setCallNotifications((prev) => prev.filter((c) => c.id !== call.id));
      setIncomingCall(null);
    }, 45000);
  }, []);

  const removeCallNotification = useCallback((id: string) => {
    setCallNotifications((prev) => prev.filter((c) => c.id !== id));
    setIncomingCall(null);
  }, []);

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        setIncomingCall,
        callNotifications,
        addCallNotification,
        removeCallNotification,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCallNotification = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallNotification must be used within CallProvider');
  }
  return context;
};
