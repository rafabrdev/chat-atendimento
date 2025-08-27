/**
 * useSocketService Hook
 * 
 * React hook for integrating the enhanced SocketService singleton
 * with components, providing:
 * - Automatic connection management based on auth state
 * - Event listener cleanup on unmount
 * - Connection state tracking
 * - Error handling integration
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socketService';
import api from '../config/api';

// Make axios instance available globally for socketService
if (typeof window !== 'undefined') {
  window.axiosInstance = api;
}

export const useSocketService = (options = {}) => {
  const { 
    autoConnect = true,
    reconnectOnTokenRefresh = true,
    debug = false 
  } = options;
  
  const { token, user, tenantId } = useAuth();
  const [connectionState, setConnectionState] = useState({
    connected: false,
    connecting: false,
    socketId: null,
    error: null
  });
  
  const listenersRef = useRef([]);
  const mountedRef = useRef(true);

  /**
   * Update connection state safely
   */
  const updateConnectionState = useCallback((updates) => {
    if (mountedRef.current) {
      setConnectionState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Connect to socket server
   */
  const connect = useCallback(async (forceNew = false) => {
    if (!token || !user) {
      console.log('[useSocketService] Missing auth data, skipping connection');
      return null;
    }

    try {
      updateConnectionState({ connecting: true, error: null });
      
      const socket = await socketService.connect(forceNew);
      
      if (socket && mountedRef.current) {
        updateConnectionState({
          connected: true,
          connecting: false,
          socketId: socket.id,
          error: null
        });
      }
      
      return socket;
    } catch (error) {
      console.error('[useSocketService] Connection failed:', error);
      
      if (mountedRef.current) {
        updateConnectionState({
          connected: false,
          connecting: false,
          socketId: null,
          error: error.message
        });
      }
      
      return null;
    }
  }, [token, user, updateConnectionState]);

  /**
   * Disconnect from socket server
   */
  const disconnect = useCallback(() => {
    socketService.disconnect();
    updateConnectionState({
      connected: false,
      connecting: false,
      socketId: null,
      error: null
    });
  }, [updateConnectionState]);

  /**
   * Emit event with options
   */
  const emit = useCallback((event, data, options = {}) => {
    return socketService.emit(event, data, options);
  }, []);

  /**
   * Add event listener with automatic cleanup
   */
  const on = useCallback((event, callback) => {
    const unsubscribe = socketService.on(event, callback);
    
    // Track listener for cleanup
    listenersRef.current.push(unsubscribe);
    
    return unsubscribe;
  }, []);

  /**
   * Remove event listener
   */
  const off = useCallback((event, callback) => {
    socketService.off(event, callback);
  }, []);

  /**
   * Add one-time event listener
   */
  const once = useCallback((event, callback) => {
    const unsubscribe = socketService.once(event, callback);
    
    // Track listener for cleanup
    listenersRef.current.push(unsubscribe);
    
    return unsubscribe;
  }, []);

  /**
   * Join a room
   */
  const joinRoom = useCallback((room, metadata = {}) => {
    socketService.joinRoom(room, metadata);
  }, []);

  /**
   * Leave a room
   */
  const leaveRoom = useCallback((room) => {
    socketService.leaveRoom(room);
  }, []);

  /**
   * Get current connection state from service
   */
  const getConnectionState = useCallback(() => {
    return socketService.getConnectionState();
  }, []);

  /**
   * Check if socket is ready
   */
  const isReady = useCallback(() => {
    return socketService.isReady();
  }, []);

  /**
   * Chat-specific methods
   */
  const chatMethods = {
    joinConversation: useCallback((conversationId, metadata = {}) => {
      socketService.joinConversation(conversationId, metadata);
    }, []),
    
    leaveConversation: useCallback((conversationId) => {
      socketService.leaveConversation(conversationId);
    }, []),
    
    sendMessage: useCallback((conversationId, content, type = 'text', files = null) => {
      return socketService.sendMessage(conversationId, content, type, files);
    }, []),
    
    startTyping: useCallback((conversationId) => {
      socketService.startTyping(conversationId);
    }, []),
    
    stopTyping: useCallback((conversationId) => {
      socketService.stopTyping(conversationId);
    }, []),
    
    setAgentStatus: useCallback((status) => {
      socketService.setAgentStatus(status);
    }, [])
  };

  /**
   * Setup connection and event listeners
   */
  useEffect(() => {
    mountedRef.current = true;

    // Setup internal event listeners
    const unsubscribers = [];

    // Listen for connection events
    unsubscribers.push(
      socketService.on('socket:connected', (data) => {
        if (debug) console.log('[useSocketService] Socket connected:', data);
        updateConnectionState({
          connected: true,
          connecting: false,
          socketId: data.socketId,
          error: null
        });
      })
    );

    unsubscribers.push(
      socketService.on('socket:disconnected', (data) => {
        if (debug) console.log('[useSocketService] Socket disconnected:', data);
        updateConnectionState({
          connected: false,
          connecting: false,
          socketId: null
        });
      })
    );

    unsubscribers.push(
      socketService.on('socket:error', (data) => {
        if (debug) console.error('[useSocketService] Socket error:', data);
        updateConnectionState({
          error: data.error
        });
      })
    );

    unsubscribers.push(
      socketService.on('socket:reconnected', () => {
        if (debug) console.log('[useSocketService] Socket reconnected');
        const state = socketService.getConnectionState();
        updateConnectionState({
          connected: state.connected,
          connecting: false,
          socketId: state.socketId,
          error: null
        });
      })
    );

    unsubscribers.push(
      socketService.on('auth:error', () => {
        if (debug) console.log('[useSocketService] Auth error detected');
        updateConnectionState({
          connected: false,
          connecting: false,
          error: 'Authentication error'
        });
      })
    );

    unsubscribers.push(
      socketService.on('tenant:disabled', () => {
        if (debug) console.log('[useSocketService] Tenant disabled');
        updateConnectionState({
          connected: false,
          connecting: false,
          error: 'Tenant has been disabled'
        });
      })
    );

    // Store unsubscribers for cleanup
    listenersRef.current = [...listenersRef.current, ...unsubscribers];

    // Auto-connect if enabled and authenticated
    if (autoConnect && token && user) {
      connect();
    }

    // Cleanup function
    return () => {
      mountedRef.current = false;
      
      // Clean up all event listeners
      listenersRef.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      listenersRef.current = [];
      
      // Disconnect if this was the last component using the socket
      // Note: In a singleton pattern, we might want to keep the connection
      // alive across component unmounts. Uncomment if you want to disconnect:
      // disconnect();
    };
  }, []); // Run once on mount

  /**
   * Handle authentication changes
   */
  useEffect(() => {
    if (!autoConnect) return;

    if (token && user && !connectionState.connected && !connectionState.connecting) {
      // Auth available, connect
      connect();
    } else if (!token && connectionState.connected) {
      // Auth lost, disconnect
      disconnect();
    }
  }, [token, user, autoConnect, connectionState.connected, connectionState.connecting, connect, disconnect]);

  /**
   * Handle tenant changes
   */
  useEffect(() => {
    if (!tenantId || !connectionState.connected) return;

    const currentState = socketService.getConnectionState();
    if (currentState.tenantId !== tenantId) {
      if (debug) console.log('[useSocketService] Tenant changed, reconnecting...');
      connect(true); // Force new connection with new tenant
    }
  }, [tenantId, connectionState.connected, connect, debug]);

  return {
    // Connection state
    ...connectionState,
    
    // Connection management
    connect,
    disconnect,
    reconnect: () => connect(true),
    
    // Event methods
    emit,
    on,
    off,
    once,
    
    // Room methods
    joinRoom,
    leaveRoom,
    
    // Utility methods
    getConnectionState,
    isReady,
    
    // Chat-specific methods
    ...chatMethods,
    
    // Direct access to service (for advanced usage)
    service: socketService
  };
};

// Export additional utilities
export const getSocketService = () => socketService;
export const socketConnectionState = () => socketService.getConnectionState();
export default useSocketService;
