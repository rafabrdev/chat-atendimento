import { useEffect, useRef } from 'react';
import { socketService } from '../lib/socket';

export const useSocket = (token, user) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (token && user) {
      socketRef.current = socketService.connect(token);
    }

    return () => {
      if (socketRef.current) {
        socketService.disconnect();
      }
    };
  }, [token, user]);

  return socketRef.current;
};
