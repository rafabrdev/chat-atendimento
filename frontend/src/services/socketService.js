/**
 * Socket Service - Enhanced Singleton for Socket.IO
 * 
 * Features:
 * - Singleton pattern for global socket instance
 * - Authentication integration with auto-refresh
 * - Tenant-aware connections and events
 * - Automatic reconnection after token refresh
 * - Event queue during disconnection
 * - Connection state management
 * - Error handling and retry logic
 */

import { io } from 'socket.io-client';
import authService from './authService';

class SocketService {
  constructor() {
    // Socket instance
    this.socket = null;
    
    // Connection state
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
    
    // Authentication
    this.currentToken = null;
    this.currentTenantId = null;
    this.currentUserId = null;
    
    // Event management
    this.eventListeners = new Map();
    this.eventQueue = [];
    this.roomsJoined = new Set();
    
    // Heartbeat
    this.pingInterval = null;
    this.pongTimeout = null;
    this.lastPong = Date.now();
    
    // Auto-sync
    this.syncInterval = null;
    this.lastActivity = Date.now();
    
    // Debug mode
    this.debug = import.meta.env.DEV;
  }

  /**
   * Initialize socket connection with authentication
   */
  async connect(forceNew = false) {
    // Prevent multiple simultaneous connections
    if (this.isConnecting && !forceNew) {
      this.log('Connection already in progress');
      return this.socket;
    }

    // If already connected and not forcing new connection
    if (this.socket?.connected && !forceNew) {
      this.log('Socket already connected');
      return this.socket;
    }

    // Get authentication data
    const token = authService.getAccessToken();
    const tenantId = authService.getTenantId();
    const user = authService.getUser();

    if (!token) {
      this.logError('No authentication token available');
      return null;
    }

    // Check if token is expired
    if (authService.isTokenExpired(token)) {
      this.log('Token expired, refreshing before connecting...');
      try {
        // Note: We need axios instance here, will be passed from component
        await authService.refreshAccessToken(window.axiosInstance);
        return this.connect(forceNew); // Retry with new token
      } catch (error) {
        this.logError('Failed to refresh token:', error);
        return null;
      }
    }

    this.isConnecting = true;
    
    // Disconnect existing socket if forcing new connection
    if (forceNew && this.socket) {
      this.disconnect();
    }

    // Store current auth data
    this.currentToken = token;
    this.currentTenantId = tenantId;
    this.currentUserId = user?.id || user?._id;

    // Configure socket URL
    const serverUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
    
    this.log(`Connecting to socket server: ${serverUrl}`);

    // Create socket connection with authentication
    this.socket = io(serverUrl, {
      auth: {
        token: this.currentToken,
        tenantId: this.currentTenantId,
        userId: this.currentUserId
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      forceNew: true,
      
      // Performance optimizations
      upgrade: true,
      rememberUpgrade: true,
      pingInterval: 25000,
      pingTimeout: 10000,
      
      // Custom query params for tenant isolation
      query: {
        tenantId: this.currentTenantId,
        userId: this.currentUserId,
        timestamp: Date.now()
      }
    });

    // Setup event handlers
    this.setupEventHandlers();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.isConnecting = false;
        reject(new Error('Connection timeout'));
      }, 15000);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(this.socket);
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        this.isConnecting = false;
        this.isConnected = false;
        reject(error);
      });
    });
  }

  /**
   * Setup core event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.log('✅ Connected to server');
      this.log('Socket ID:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Start heartbeat and sync
      this.startHeartbeat();
      this.startAutoSync();
      
      // Rejoin rooms
      this.rejoinRooms();
      
      // Process queued events
      this.processEventQueue();
      
      // Emit connection event for listeners
      this.emitToListeners('socket:connected', { 
        socketId: this.socket.id,
        tenantId: this.currentTenantId 
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.log('❌ Disconnected:', reason);
      this.isConnected = false;
      
      // Stop heartbeat and sync
      this.stopHeartbeat();
      this.stopAutoSync();
      
      // Emit disconnection event
      this.emitToListeners('socket:disconnected', { reason });
      
      // Handle reconnection based on reason
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, might be auth issue
        this.handleAuthDisconnect();
      } else {
        // Client side disconnect, attempt reconnection
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.logError('Connection error:', error.message);
      this.isConnected = false;
      
      // Check if it's an auth error
      if (error.message?.includes('auth') || error.message?.includes('token')) {
        this.handleAuthError();
      }
      
      this.emitToListeners('socket:error', { error: error.message });
    });

    // Authentication events
    this.socket.on('auth-error', (data) => {
      this.logError('Authentication error:', data);
      this.handleAuthError();
    });

    this.socket.on('token-refreshed', (data) => {
      this.log('Token refreshed from server');
      if (data.token) {
        authService.setAccessToken(data.token);
        this.currentToken = data.token;
      }
    });

    // Tenant events
    this.socket.on('tenant-changed', (data) => {
      this.log('Tenant changed:', data);
      this.currentTenantId = data.tenantId;
      authService.setTenantId(data.tenantId);
      
      // Reconnect with new tenant
      this.reconnect();
    });

    this.socket.on('tenant-disabled', () => {
      this.logError('Tenant has been disabled');
      this.emitToListeners('tenant:disabled');
      this.disconnect();
    });

    // Heartbeat events
    this.socket.on('pong', (data) => {
      this.lastPong = Date.now();
      this.lastActivity = Date.now();
      
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
    });

    // Sync events
    this.socket.on('sync-required', () => {
      this.log('🔄 Sync required from server');
      this.emitToListeners('sync:required');
      window.dispatchEvent(new CustomEvent('force-sync'));
    });

    // Room events
    this.socket.on('joined-room', (data) => {
      this.log('✅ Joined room:', data.room);
      this.roomsJoined.add(data.room);
    });

    this.socket.on('left-room', (data) => {
      this.log('👋 Left room:', data.room);
      this.roomsJoined.delete(data.room);
    });

    // Error handling
    this.socket.on('error', (error) => {
      this.logError('Socket error:', error);
      this.emitToListeners('socket:error', { error });
    });
  }

  /**
   * Handle authentication disconnection
   */
  async handleAuthDisconnect() {
    this.log('Handling auth disconnect...');
    
    try {
      // Try to refresh token
      if (window.axiosInstance) {
        await authService.refreshAccessToken(window.axiosInstance);
        this.reconnect();
      } else {
        // No axios instance available, redirect to login
        this.handleAuthError();
      }
    } catch (error) {
      this.logError('Failed to handle auth disconnect:', error);
      this.handleAuthError();
    }
  }

  /**
   * Handle authentication errors
   */
  handleAuthError() {
    this.log('Authentication error, clearing auth data...');
    authService.clearAuthData();
    this.disconnect();
    
    // Emit auth error event
    this.emitToListeners('auth:error');
    
    // Redirect to login
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logError('Max reconnection attempts reached');
      this.emitToListeners('socket:reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  /**
   * Reconnect with current authentication
   */
  async reconnect() {
    this.log('Attempting to reconnect...');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      await this.connect(true);
      this.log('✅ Reconnected successfully');
      this.emitToListeners('socket:reconnected');
    } catch (error) {
      this.logError('Reconnection failed:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    this.log('Disconnecting socket...');
    
    if (this.socket) {
      // Remove all listeners
      this.socket.removeAllListeners();
      
      // Disconnect
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear timers
    this.stopHeartbeat();
    this.stopAutoSync();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset state
    this.isConnected = false;
    this.isConnecting = false;
    this.roomsJoined.clear();
    this.eventQueue = [];
  }

  /**
   * Emit event with authentication and tenant context
   */
  emit(event, data = {}, options = {}) {
    if (!this.socket) {
      this.logError('Socket not initialized');
      
      // Queue event if configured
      if (options.queue) {
        this.queueEvent(event, data, options);
      }
      
      return false;
    }

    if (!this.isConnected && options.queue) {
      this.queueEvent(event, data, options);
      return false;
    }

    // Add tenant context to all events
    const enrichedData = {
      ...data,
      _metadata: {
        tenantId: this.currentTenantId,
        userId: this.currentUserId,
        timestamp: Date.now(),
        socketId: this.socket.id
      }
    };

    this.socket.emit(event, enrichedData);
    this.lastActivity = Date.now();
    
    if (this.debug) {
      this.log(`📤 Emitted: ${event}`, enrichedData);
    }
    
    return true;
  }

  /**
   * Listen to events
   */
  on(event, callback) {
    if (!this.socket) {
      this.logError('Socket not initialized');
      
      // Store listener for later
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }
      this.eventListeners.get(event).add(callback);
      
      return () => this.off(event, callback);
    }

    // Add to socket
    this.socket.on(event, callback);
    
    // Store for reconnection
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
      
      if (this.eventListeners.get(event).size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Once event listener
   */
  once(event, callback) {
    if (!this.socket) {
      this.logError('Socket not initialized');
      return () => {};
    }

    this.socket.once(event, callback);
    
    // Return unsubscribe function
    return () => this.socket?.off(event, callback);
  }

  /**
   * Join a room (tenant-aware)
   */
  joinRoom(room, metadata = {}) {
    const tenantRoom = `${this.currentTenantId}:${room}`;
    
    this.emit('join-room', { 
      room: tenantRoom,
      originalRoom: room,
      ...metadata 
    });
    
    this.roomsJoined.add(tenantRoom);
    this.log(`Joining room: ${tenantRoom}`);
  }

  /**
   * Leave a room (tenant-aware)
   */
  leaveRoom(room) {
    const tenantRoom = `${this.currentTenantId}:${room}`;
    
    this.emit('leave-room', { 
      room: tenantRoom,
      originalRoom: room
    });
    
    this.roomsJoined.delete(tenantRoom);
    this.log(`Leaving room: ${tenantRoom}`);
  }

  /**
   * Rejoin all rooms after reconnection
   */
  rejoinRooms() {
    if (this.roomsJoined.size > 0) {
      this.log('Rejoining rooms:', Array.from(this.roomsJoined));
      
      this.roomsJoined.forEach(room => {
        this.socket.emit('join-room', { room });
      });
    }
  }

  /**
   * Queue events while disconnected
   */
  queueEvent(event, data, options) {
    this.eventQueue.push({
      event,
      data,
      options,
      timestamp: Date.now()
    });
    
    this.log(`Event queued: ${event}`);
    
    // Limit queue size
    if (this.eventQueue.length > 100) {
      this.eventQueue.shift();
    }
  }

  /**
   * Process queued events after reconnection
   */
  processEventQueue() {
    if (this.eventQueue.length === 0) return;
    
    this.log(`Processing ${this.eventQueue.length} queued events`);
    
    const queue = [...this.eventQueue];
    this.eventQueue = [];
    
    queue.forEach(({ event, data, options }) => {
      // Skip old events
      if (Date.now() - options.timestamp > 60000) return;
      
      this.emit(event, data, { ...options, queue: false });
    });
  }

  /**
   * Emit to local listeners
   */
  emitToListeners(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logError(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Chat-specific methods
   */
  
  joinConversation(conversationId, metadata = {}) {
    this.joinRoom(`conversation:${conversationId}`, metadata);
    this.emit('join-conversation', { conversationId, ...metadata });
  }

  leaveConversation(conversationId) {
    this.leaveRoom(`conversation:${conversationId}`);
    this.emit('leave-conversation', { conversationId });
  }

  sendMessage(conversationId, content, type = 'text', files = null) {
    return this.emit('send-message', {
      conversationId,
      content,
      type,
      files
    }, { queue: true });
  }

  startTyping(conversationId) {
    this.emit('typing-start', { conversationId });
  }

  stopTyping(conversationId) {
    this.emit('typing-stop', { conversationId });
  }

  setAgentStatus(status) {
    this.emit('agent-status', { status });
  }

  /**
   * Heartbeat methods
   */
  
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
        
        // Set timeout for pong response
        this.pongTimeout = setTimeout(() => {
          this.log('⚠️ Pong timeout, connection may be lost');
          
          // Check if we should reconnect
          if (Date.now() - this.lastPong > 60000) {
            this.log('No pong for 60s, reconnecting...');
            this.reconnect();
          }
        }, 5000);
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * Auto-sync methods
   */
  
  startAutoSync() {
    this.stopAutoSync();
    
    this.syncInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivity;
      
      if (timeSinceLastActivity > 120000 && this.socket?.connected) {
        this.log('🔄 Requesting sync due to inactivity');
        this.emit('request-sync');
        this.lastActivity = Date.now();
      }
    }, 60000);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  /**
   * Utility methods
   */
  
  isReady() {
    return this.socket && this.isConnected;
  }

  getSocketId() {
    return this.socket?.id;
  }

  getConnectionState() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      socketId: this.socket?.id,
      tenantId: this.currentTenantId,
      userId: this.currentUserId,
      roomsJoined: Array.from(this.roomsJoined),
      queuedEvents: this.eventQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Debug logging
   */
  
  log(...args) {
    if (this.debug) {
      console.log('[SocketService]', ...args);
    }
  }

  logError(...args) {
    console.error('[SocketService]', ...args);
  }
}

// Create singleton instance
const socketService = new SocketService();

// Expose to window for debugging in development
if (import.meta.env.DEV) {
  window.socketService = socketService;
}

export default socketService;
