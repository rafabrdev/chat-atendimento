const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/authMiddleware');
const { conditionalLoadTenant } = require('../middleware/conditionalTenant');
const Conversation = require('../models/Conversation');

// Aplicar middleware de autenticação para todas as rotas
router.use(authMiddleware);
router.use(conditionalLoadTenant);

/**
 * @swagger
 * /api/chat/conversations:
 *   post:
 *     tags: [Chat]
 *     summary: Criar nova conversa
 *     description: Cria uma nova conversa de chat. Clientes podem criar conversas que entram na fila de atendimento.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *                 example: Dúvida sobre produto
 *               initialMessage:
 *                 type: string
 *                 example: Olá, gostaria de saber mais sobre o produto X
 *               department:
 *                 type: string
 *                 example: vendas
 *     responses:
 *       201:
 *         description: Conversa criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 */
router.post('/conversations', async (req, res) => {
  try {
    const { initialMessage, ...conversationBody } = req.body;
    
    // Usar o ID do usuário e tenant do usuário autenticado
    // O tenantId pode vir do middleware ou do próprio usuário
    const tenantId = req.tenantId || 
                     (req.user.tenantId?._id || req.user.tenantId) || 
                     null;
    
    if (!tenantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tenant ID é obrigatório para criar conversa' 
      });
    }
    
    const conversationData = {
      ...conversationBody,
      tenantId: tenantId,
      clientId: req.user._id
    };
    
    const conversation = await chatService.createConversation(conversationData);
    
    // Se tem mensagem inicial, criar ela também
    if (initialMessage) {
      const Message = require('../models/Message');
      const message = await Message.create({
        tenantId: tenantId,  // Usar o mesmo tenantId da conversa
        conversationId: conversation._id,
        sender: req.user._id,
        senderType: (req.user.role === 'agent' || req.user.role === 'admin') ? 'agent' : 'client',
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

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     tags: [Chat]
 *     summary: Listar conversas
 *     description: Retorna lista de conversas do usuário. Clientes veem apenas suas próprias conversas, agentes veem conversas atribuídas ou na fila.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, active, closed]
 *         description: Filtrar por status da conversa
 *       - in: query
 *         name: assignedAgentId
 *         schema:
 *           type: string
 *         description: Filtrar por ID do agente atribuído
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Itens por página
 *     responses:
 *       200:
 *         description: Lista de conversas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Chat'
 *       401:
 *         description: Não autorizado
 */
router.get('/conversations', async (req, res) => {
  try {
    const { status, assignedAgentId } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.tenantId || (req.user.tenantId?._id || req.user.tenantId);
    
    // Para clientes, mostrar apenas suas próprias conversas
    // Para agentes, mostrar conversas atribuídas ou na fila
    const conversations = await chatService.getConversationsForUser(
      userId,
      userRole,
      status,
      assignedAgentId,
      tenantId
    );
    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/chat/conversations/{id}/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Buscar mensagens de uma conversa
 *     description: Retorna todas as mensagens de uma conversa específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Mensagens por página
 *     responses:
 *       200:
 *         description: Lista de mensagens
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       400:
 *         description: ID inválido
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Conversa não encontrada
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const messages = await chatService.getConversationMessages(req.params.id);
    res.json(messages);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/chat/conversations/{id}/assign:
 *   patch:
 *     tags: [Chat]
 *     summary: Atribuir conversa a um agente
 *     description: Atribui uma conversa a um agente específico (Apenas administradores)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentId
 *             properties:
 *               agentId:
 *                 type: string
 *                 example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Conversa atribuída com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Sem permissão - Apenas administradores
 *       404:
 *         description: Conversa ou agente não encontrado
 */
router.patch('/conversations/:id/assign', requireRole('admin'), async (req, res) => {
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

/**
 * @swagger
 * /api/chat/conversations/{id}/accept:
 *   patch:
 *     tags: [Chat]
 *     summary: Aceitar conversa
 *     description: Agente aceita uma conversa da fila de atendimento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *     responses:
 *       200:
 *         description: Conversa aceita com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Erro ao aceitar conversa
 *       403:
 *         description: Sem permissão - Apenas agentes e administradores
 *       404:
 *         description: Conversa não encontrada
 */
router.patch('/conversations/:id/accept', async (req, res) => {
  try {
    console.log('📌 Accept route hit');
    console.log('📌 User:', req.user?.email, 'Role:', req.user?.role);
    console.log('📌 Conversation ID:', req.params.id);
    
    // Verificar se é agente ou admin
    if (req.user.role !== 'agent' && req.user.role !== 'admin') {
      console.log('❌ User is not agent/admin:', req.user.role);
      return res.status(403).json({ 
        error: 'Apenas agentes e administradores podem aceitar conversas' 
      });
    }
    
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

/**
 * @swagger
 * /api/chat/conversations/{id}/close:
 *   patch:
 *     tags: [Chat]
 *     summary: Fechar conversa
 *     description: Encerra uma conversa de atendimento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *     responses:
 *       200:
 *         description: Conversa fechada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Conversa já está encerrada
 *       404:
 *         description: Conversa não encontrada
 */
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

/**
 * @swagger
 * /api/chat/conversations/{id}/rate:
 *   post:
 *     tags: [Chat]
 *     summary: Avaliar conversa
 *     description: Cliente avalia o atendimento recebido
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: Atendimento excelente!
 *     responses:
 *       200:
 *         description: Avaliação registrada com sucesso
 *       403:
 *         description: Apenas o cliente da conversa pode avaliar
 *       404:
 *         description: Conversa não encontrada
 */
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

// Reabrir conversa - Apenas agentes e admin
router.patch('/conversations/:id/reopen', async (req, res) => {
  try {
    // Verificar se o usuário é agente ou admin
    if (req.user.role !== 'agent' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas agentes e admin podem reabrir conversas' });
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

// Status da fila - Apenas agentes e admin podem ver status da fila
router.get('/queue/status', async (req, res) => {
  // Verificar se é agente ou admin
  if (req.user.role !== 'agent' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
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

// Processar fila manualmente - Apenas admin
router.post('/queue/process', requireRole('admin'), async (req, res) => {
  try {
    await chatService.processQueue();
    res.json({ message: 'Queue processing started' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obter estatísticas do agente - Apenas agentes e admin
router.get('/agent/stats', async (req, res) => {
  // Verificar se é agente ou admin
  if (req.user.role !== 'agent' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    const agentId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Buscar conversas do agente hoje
    const todayConversations = await Conversation.find({
      assignedAgent: agentId,
      updatedAt: { $gte: today }
    });
    
    // Calcular estatísticas incluindo avaliações
    const closedConversations = todayConversations.filter(c => c.status === 'closed');
    const ratedConversations = closedConversations.filter(c => c.rating);
    
    // Calcular média de satisfação
    let avgSatisfaction = 0;
    if (ratedConversations.length > 0) {
      const totalRating = ratedConversations.reduce((sum, conv) => sum + (conv.rating || 0), 0);
      avgSatisfaction = (totalRating / ratedConversations.length).toFixed(1);
    }
    
    const stats = {
      totalToday: todayConversations.length,
      resolved: closedConversations.length,
      avgResponseTime: 0, // TODO: Implementar cálculo de tempo de resposta
      satisfaction: avgSatisfaction,
      totalRatings: ratedConversations.length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
