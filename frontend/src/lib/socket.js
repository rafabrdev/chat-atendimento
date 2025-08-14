import { io } from 'socket.io-client';

class SocketService {
  socket = null;
  pingInterval = null;
  syncInterval = null;
  lastActivity = Date.now();
  
  connect(token) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    // Desconectar socket anterior se existir
    if (this.socket) {
      console.log('Disconnecting old socket');
      this.socket.disconnect();
    }

    // Usar a URL base do servidor sem /api
    const serverUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
    
    console.log('Connecting to socket server:', serverUrl);
    
    // Conectar sem namespace específico
    this.socket = io(serverUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'], // Adicionar polling como fallback
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500, // Reduzir delay de reconexão para 500ms
      reconnectionDelayMax: 2000, // Máximo de 2 segundos
      timeout: 5000, // Timeout de 5 segundos
      forceNew: true, // Forçar nova conexão
      // Otimizações para real-time
      upgrade: true, // Permitir upgrade de polling para websocket
      rememberUpgrade: true, // Lembrar upgrade
      pingInterval: 10000, // Ping a cada 10 segundos
      pingTimeout: 5000 // Timeout de ping em 5 segundos
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server');
      console.log('Socket ID:', this.socket.id);
      
      // Iniciar heartbeat
      this.startHeartbeat();
      
      // Iniciar sincronização automática
      this.startAutoSync();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      this.stopHeartbeat();
      this.stopAutoSync();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      console.error('Error type:', error.type);
    });
    
    // Adicionar listeners de debug
    this.socket.on('joined-conversation', (data) => {
      console.log('✅ Joined conversation:', data.conversationId);
    });
    
    this.socket.on('message-error', (error) => {
      console.error('❌ Message error:', error);
    });
    
    // Listener para pong
    this.socket.on('pong', (data) => {
      // Conexão ainda está viva
      this.lastActivity = Date.now();
    });
    
    // Listener para sincronização
    this.socket.on('sync-required', () => {
      console.log('🔄 Sync required from server');
      // Disparar evento customizado para forçar reload
      window.dispatchEvent(new CustomEvent('force-sync'));
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  joinConversation(conversationId) {
    this.emit('join-conversation', { conversationId });
  }

  leaveConversation(conversationId) {
    this.emit('leave-conversation', { conversationId });
  }

  sendMessage(conversationId, content, type = 'text') {
    console.log('📤 Sending message via socket:', { conversationId, content, type });
    console.log('Socket connected:', this.socket?.connected);
    console.log('Socket ID:', this.socket?.id);
    
    if (!this.socket?.connected) {
      console.error('Socket not connected when trying to send message!');
      return false;
    }
    
    this.emit('send-message', { conversationId, content, type });
    return true;
  }

  startTyping(conversationId) {
    this.emit('typing-start', { conversationId });
  }

  stopTyping(conversationId) {
    this.emit('typing-stop', { conversationId });
  }

  setAgentStatus(status) {
    if (status === 'available') {
      this.emit('agent-available');
    } else if (status === 'busy') {
      this.emit('agent-busy');
    }
  }
  
  // Métodos de heartbeat
  startHeartbeat() {
    this.stopHeartbeat(); // Limpar intervalo anterior
    
    // Enviar ping a cada 15 segundos para manter conexão ativa
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.emit('ping', { timestamp: Date.now() });
      }
    }, 15000);
  }
  
  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  // Métodos de sincronização automática
  startAutoSync() {
    this.stopAutoSync(); // Limpar intervalo anterior
    
    // Verificar a cada 30 segundos se precisa sincronização (mais frequente)
    this.syncInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivity;
      
      // Se não houver atividade por mais de 1 minuto, solicitar sync
      if (timeSinceLastActivity > 60000 && this.socket?.connected) {
        console.log('🔄 Requesting sync due to inactivity');
        this.emit('request-sync');
        this.lastActivity = Date.now(); // Reset activity
      }
    }, 30000);
  }
  
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  // Atualizar atividade
  updateActivity() {
    this.lastActivity = Date.now();
  }
}

export const socketService = new SocketService();
