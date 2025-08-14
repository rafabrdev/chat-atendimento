const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');

// Aplicar middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Criar nova conversa
router.post('/conversations', async (req, res) => {
  try {
    const { initialMessage, ...conversationBody } = req.body;
    
    // Usar o ID do usuário e empresa do usuário autenticado
    const conversationData = {
      ...conversationBody,
      companyId: req.user.companyId || req.user._id, // Se não tiver empresa, usa o próprio ID
      clientId: req.user._id
    };
    
    const conversation = await chatService.createConversation(conversationData);
    
    // Se tem mensagem inicial, criar ela também
    if (initialMessage) {
      const Message = require('../models/Message');
      const message = await Message.create({
        conversationId: conversation._id,
        sender: req.user._id,
        senderType: req.user.role === 'agent' ? 'agent' : 'client',
        content: initialMessage,
        type: 'text'
      });
      
      // Atualizar conversa com última mensagem
      conversation.lastMessage = message._id;
      conversation.lastActivity = new Date();
      await conversation.save();
    }
    
    // Notificar via WebSocket que há nova conversa na fila
    const io = req.app.get('io');
    if (io) {
      io.emit('queue-updated');
      io.emit('new-conversation', conversation);
    }
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Listar conversas
router.get('/conversations', async (req, res) => {
  try {
    const { status, assignedAgentId } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    // Para clientes, mostrar apenas suas próprias conversas
    // Para agentes, mostrar conversas atribuídas ou na fila
    const conversations = await chatService.getConversationsForUser(
      userId,
      userRole,
      status,
      assignedAgentId
    );
    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(400).json({ error: error.message });
  }
});

// Buscar mensagens de uma conversa
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const messages = await chatService.getConversationMessages(req.params.id);
    res.json(messages);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Atribuir conversa a um agente
router.patch('/conversations/:id/assign', async (req, res) => {
  try {
    const { agentId } = req.body;
    const conversation = await chatService.assignConversationToAgent(
      req.params.id,
      agentId
    );
    
    // Notificar via WebSocket
    const io = req.app.get('io');
    if (io && conversation) {
      // Buscar informações do agente
      const User = require('../models/User');
      const agent = await User.findById(agentId).select('name email');
      
      // Emitir evento de conversa atribuída
      io.emit('conversation-assigned', {
        conversationId: req.params.id,
        agent: {
          _id: agentId,
          name: agent?.name || 'Agente',
          email: agent?.email
        }
      });
      
      // Notificar especificamente o cliente
      if (conversation.client) {
        io.to(`user-${conversation.client}`).emit('conversation-status-changed', {
          conversationId: req.params.id,
          status: 'active',
          assignedAgent: {
            _id: agentId,
            name: agent?.name || 'Agente'
          }
        });
      }
    }
    
    res.json(conversation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Aceitar conversa (para agentes)
router.patch('/conversations/:id/accept', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const conversation = await chatService.assignConversationToAgent(
      conversationId,
      req.user._id
    );
    
    // Notificar via WebSocket
    const io = req.app.get('io');
    
    // Notificar todos na conversa
    io.to(conversationId).emit('conversation-accepted', {
      conversationId,
      agentId: req.user._id,
      agentName: req.user.name,
      conversation
    });
    
    // Notificar o cliente específico para atualizar sua lista
    if (conversation.client) {
      io.to(`user-${conversation.client}`).emit('conversation-status-changed', {
        conversationId,
        status: 'active',
        assignedAgent: {
          _id: req.user._id,
          name: req.user.name
        }
      });
    }
    
    // Notificar todos os agentes para atualizar a fila
    io.emit('queue-updated');
    
    res.json(conversation);
  } catch (error) {
    console.error('Erro ao aceitar conversa:', error);
    res.status(400).json({ error: error.message });
  }
});

// Fechar conversa
router.patch('/conversations/:id/close', async (req, res) => {
  try {
    // Verificar se a conversa já está fechada
    const existingConversation = await Conversation.findById(req.params.id);
    if (existingConversation && existingConversation.status === 'closed') {
      return res.status(400).json({ error: 'Conversa já está encerrada' });
    }
    
    const conversation = await chatService.closeConversation(
      req.params.id,
      req.user._id
    );
    
    // Notificar via WebSocket
    const io = req.app.get('io');
    io.to(req.params.id).emit('conversation-closed', {
      conversationId: req.params.id
    });
    
    // Notificar atualização da fila
    io.emit('queue-updated');
    
    res.json(conversation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Avaliar conversa (apenas para clientes)
router.post('/conversations/:id/rate', async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const conversationId = req.params.id;
    
    // Verificar se o usuário é o cliente da conversa
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }
    
    if (conversation.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Você não pode avaliar esta conversa' });
    }
    
    // Atualizar avaliação
    conversation.rating = rating;
    conversation.ratingComment = comment;
    conversation.ratedAt = new Date();
    await conversation.save();
    
    // Notificar via WebSocket
    const io = req.app.get('io');
    io.emit('conversation-rated', {
      conversationId,
      rating,
      comment
    });
    
    res.json({ 
      success: true, 
      message: 'Avaliação registrada com sucesso',
      conversation 
    });
  } catch (error) {
    console.error('Erro ao avaliar conversa:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reabrir conversa (apenas para agentes)
router.patch('/conversations/:id/reopen', async (req, res) => {
  try {
    // Verificar se o usuário é agente ou admin
    if (req.user.role !== 'agent' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas agentes podem reabrir conversas' });
    }
    
    const conversation = await Conversation.findById(req.params.id)
      .populate('client', 'name email')
      .populate('assignedAgent', 'name email');
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }
    
    if (conversation.status !== 'closed') {
      return res.status(400).json({ error: 'Conversa não está fechada' });
    }
    
    // Reabrir conversa
    conversation.status = 'active';
    conversation.closedAt = null;
    conversation.closedBy = null;
    conversation.lastActivity = new Date();
    
    // Se não tem agente atribuído, atribuir ao agente que está reabrindo
    if (!conversation.assignedAgent) {
      conversation.assignedAgent = req.user._id;
    }
    
    await conversation.save();
    
    // Notificar via WebSocket
    const io = req.app.get('io');
    io.to(req.params.id).emit('conversation-reopened', {
      conversationId: req.params.id,
      status: 'active'
    });
    
    // Notificar atualização da fila
    io.emit('queue-updated');
    
    res.json(conversation);
  } catch (error) {
    console.error('Erro ao reabrir conversa:', error);
    res.status(400).json({ error: error.message });
  }
});

// Status da fila
router.get('/queue/status', async (req, res) => {
  try {
    // Usa o ID do usuário como fallback se não tiver companyId
    const companyId = req.user.companyId || req.user._id;
    const queueStatus = await chatService.getQueueStatus(companyId);
    res.json(queueStatus);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(400).json({ error: error.message });
  }
});

// Processar fila manualmente
router.post('/queue/process', async (req, res) => {
  try {
    await chatService.processQueue();
    res.json({ message: 'Queue processing started' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obter estatísticas do agente
router.get('/agent/stats', async (req, res) => {
  try {
    const agentId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Buscar conversas do agente hoje
    const todayConversations = await Conversation.find({
      assignedAgent: agentId,
      updatedAt: { $gte: today }
    });
    
    // Calcular estatísticas
    const stats = {
      totalToday: todayConversations.length,
      resolved: todayConversations.filter(c => c.status === 'closed').length,
      avgResponseTime: 0, // Implementar cálculo se necessário
      satisfaction: 0 // Implementar sistema de avaliação se necessário
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
