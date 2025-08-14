const jwt = require('jsonwebtoken');
const User = require('../models/User');
const chatService = require('../services/chatService');

class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
    
    // Configurar Socket.IO para baixa latência
    if (this.io.engine) {
      this.io.engine.opts.pingInterval = 10000; // Ping a cada 10 segundos
      this.io.engine.opts.pingTimeout = 5000; // Timeout de 5 segundos
      this.io.engine.opts.upgradeTimeout = 10000; // Timeout de upgrade
    }
  }

  async handleConnection(socket) {
    try {
      // Verificar autenticação
      const token = socket.handshake.auth?.token;
      if (!token) {
        socket.disconnect();
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        socket.disconnect();
        return;
      }

      // Armazenar conexão
      this.connectedUsers.set(socket.id, {
        socket,
        userId: user._id.toString(),
        role: user.role,
        companyId: user.companyId
      });

      // Atualizar status do usuário
      await User.findByIdAndUpdate(user._id, {
        status: 'online',
        lastSeen: new Date()
      });

      // Juntar-se às salas apropriadas
      if (user.companyId) {
        socket.join(`company:${user.companyId}`);
      }
      if (user.role === 'agent') {
        socket.join('agents');
      }

      // Notificar outros usuários
      if (user.companyId) {
        socket.to(`company:${user.companyId}`).emit('user-status-changed', {
          userId: user._id,
          status: 'online'
        });
      }

      console.log(`User ${user._id} connected`);

      // Configurar event handlers
      this.setupEventHandlers(socket);
    } catch (error) {
      console.error('Connection error:', error);
      socket.disconnect();
    }
  }

  setupEventHandlers(socket) {
    socket.on('disconnect', () => this.handleDisconnect(socket));
    socket.on('join-conversation', (data) => this.handleJoinConversation(socket, data));
    socket.on('leave-conversation', (data) => this.handleLeaveConversation(socket, data));
    socket.on('send-message', (data) => this.handleMessage(socket, data));
    socket.on('typing-start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing-stop', (data) => this.handleTypingStop(socket, data));
    socket.on('agent-available', () => this.handleAgentAvailable(socket));
    socket.on('agent-busy', () => this.handleAgentBusy(socket));
    socket.on('ping', (data) => this.handlePing(socket, data));
    socket.on('request-sync', () => this.handleRequestSync(socket));
  }

  async handleDisconnect(socket) {
    const connection = this.connectedUsers.get(socket.id);
    if (connection) {
      // Atualizar status do usuário
      await User.findByIdAndUpdate(connection.userId, {
        status: 'offline',
        lastSeen: new Date()
      });

      // Notificar outros usuários
      if (connection.companyId) {
        socket.to(`company:${connection.companyId}`).emit('user-status-changed', {
          userId: connection.userId,
          status: 'offline'
        });
      }

      this.connectedUsers.delete(socket.id);
      console.log(`User ${connection.userId} disconnected`);
    }
  }

  async handleJoinConversation(socket, data) {
    const connection = this.connectedUsers.get(socket.id);
    if (!connection) {
      console.error('No connection found for join-conversation');
      return;
    }

    console.log(`User ${connection.userId} attempting to join conversation ${data.conversationId}`);

    // Verificar se o usuário tem acesso à conversa
    const Conversation = require('../models/Conversation');
    
    // Admin e agentes podem acessar qualquer conversa
    let conversation;
    if (connection.role === 'admin' || connection.role === 'agent') {
      conversation = await Conversation.findById(data.conversationId);
    } else {
      // Clientes só podem acessar suas próprias conversas
      conversation = await Conversation.findOne({
        _id: data.conversationId,
        client: connection.userId
      });
    }

    if (conversation) {
      socket.join(`conversation:${data.conversationId}`);
      console.log(`User ${connection.userId} successfully joined conversation ${data.conversationId}`);
      
      // Notificar que entrou na sala
      socket.emit('joined-conversation', { conversationId: data.conversationId });
    } else {
      console.error(`User ${connection.userId} denied access to conversation ${data.conversationId}`);
    }
  }

  handleLeaveConversation(socket, data) {
    socket.leave(`conversation:${data.conversationId}`);
  }

  async handleMessage(socket, data) {
    const connection = this.connectedUsers.get(socket.id);
    if (!connection) {
      console.error('No connection found for socket:', socket.id);
      socket.emit('message-error', { error: 'Not authenticated' });
      return;
    }

    console.log('Received message:', { 
      from: connection.userId, 
      conversationId: data.conversationId, 
      content: data.content 
    });

    try {
      const message = await chatService.sendMessage({
        conversationId: data.conversationId,
        senderId: connection.userId,
        content: data.content,
        type: data.type || 'text',
        senderType: (connection.role === 'admin' || connection.role === 'agent') ? 'agent' : 'client'
      });

      console.log('Message saved:', message._id);

      // Emitir mensagem para todos na conversa
      const room = `conversation:${data.conversationId}`;
      console.log('Emitting to room:', room);
      
      // Emitir no namespace root (sem /chat) - IMEDIATAMENTE
      this.io.to(room).emit('new-message', message);
      
      // Confirmar envio ao remetente para feedback instantâneo
      socket.emit('message-sent', { 
        conversationId: data.conversationId,
        messageId: message._id,
        timestamp: Date.now() 
      });
      
      // Emitir atualização da conversa para todos os usuários da empresa
      if (connection.companyId) {
        this.io.to(`company:${connection.companyId}`).emit('conversation-updated', {
          conversationId: data.conversationId,
          lastMessage: message
        });
      }

      // Emitir para agentes se necessário
      if (connection.role === 'client') {
        this.io.to('agents').emit('new-message-notification', {
          conversationId: data.conversationId,
          message
        });
      }
      
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('message-error', { error: error.message });
    }
  }

  handleTypingStart(socket, data) {
    const connection = this.connectedUsers.get(socket.id);
    if (!connection) return;

    socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId: connection.userId,
      isTyping: true
    });
  }

  handleTypingStop(socket, data) {
    const connection = this.connectedUsers.get(socket.id);
    if (!connection) return;

    socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId: connection.userId,
      isTyping: false
    });
  }

  async handleAgentAvailable(socket) {
    const connection = this.connectedUsers.get(socket.id);
    if (!connection || connection.role !== 'agent') return;

    await User.findByIdAndUpdate(connection.userId, { status: 'online' });

    // Processar fila de espera
    await chatService.processQueue();
  }

  async handleAgentBusy(socket) {
    const connection = this.connectedUsers.get(socket.id);
    if (!connection || connection.role !== 'agent') return;

    await User.findByIdAndUpdate(connection.userId, { status: 'busy' });
  }

  // Método para notificar nova conversa atribuída
  async notifyNewConversationAssigned(conversationId, agentId) {
    const agentConnection = Array.from(this.connectedUsers.values()).find(
      conn => conn.userId === agentId.toString()
    );

    if (agentConnection) {
      agentConnection.socket.emit('conversation-assigned', { conversationId });
    }
  }

  // Handler para ping/pong - mantém conexão viva
  handlePing(socket, data) {
    const latency = data ? Date.now() - data.timestamp : 0;
    socket.emit('pong', { 
      timestamp: Date.now(),
      received: data?.timestamp,
      latency // Calcular latência para monitoramento
    });
  }
  
  // Handler para sincronização forçada
  async handleRequestSync(socket) {
    const connection = this.connectedUsers.get(socket.id);
    if (!connection) return;
    
    // Emitir evento de sincronização
    socket.emit('sync-required');
    
    // Se for agente, também emitir atualização de fila
    if (connection.role === 'agent' || connection.role === 'admin') {
      socket.emit('queue-updated');
    }
  }
  
  // Método para notificar atualização de fila
  async notifyQueueUpdate(companyId) {
    this.io.to(`company:${companyId}`).emit('queue-updated');
  }
}

module.exports = SocketHandlers;
