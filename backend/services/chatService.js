const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');

class ChatService {
  async createConversation(data) {
    try {
      // Validar dados obrigatórios
      if (!data.clientId) {
        throw new Error('Client ID is required');
      }
      
      const conversation = await Conversation.create({
        companyId: data.companyId || null, // Opcional
        client: data.clientId,
        priority: data.priority || 'normal',
        tags: data.tags || [],
        status: 'waiting',
        participants: [data.clientId]
      });

      // Popular os dados do cliente
      await conversation.populate('client', 'name email');
      return conversation;
    } catch (error) {
      console.error('Error in createConversation:', error);
      throw error;
    }
  }

  async createConversationWithQueue(data) {
    const conversation = await this.createConversation(data);

    // Adicionar à fila de espera
    await QueueEntry.create({
      conversationId: conversation._id,
      priority: this.getPriorityValue(data.priority || 'normal')
    });

    // Processar fila automaticamente
    setTimeout(() => this.processQueue(), 1000);

    return conversation;
  }

  async sendMessage(data) {
    // Verificar se a conversa existe
    const conversation = await Conversation.findById(data.conversationId);
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Criar mensagem
    const message = await Message.create({
      conversationId: data.conversationId,
      sender: data.senderId,
      senderId: data.senderId,
      senderType: data.senderType,
      content: data.content,
      type: data.type || 'text',
      metadata: data.metadata
    });

    // Atualizar última atividade da conversa
    await Conversation.findByIdAndUpdate(data.conversationId, {
      lastActivity: new Date(),
      lastMessageAt: new Date()
    });

    // Popular dados do sender
    await message.populate('sender', 'name email role');

    return message;
  }

  async getConversationsForUser(userId, userRole, status, assignedAgentId) {
    const query = {};
    
    // Se for cliente, mostrar apenas suas próprias conversas
    if (userRole === 'client') {
      query.client = userId;
    } 
    // Se for agente/admin, mostrar conversas atribuídas ou na fila
    else if (userRole === 'agent' || userRole === 'admin') {
      if (status === 'waiting') {
        // Conversas na fila (sem agente atribuído)
        query.status = 'waiting';
      } else if (status === 'active') {
        // Conversas atribuídas ao agente
        query.assignedAgent = userId;
        query.status = 'active';
      } else if (assignedAgentId) {
        // Filtrar por agente específico
        query.assignedAgent = assignedAgentId;
      } else {
        // Mostrar todas (para admins)
        if (userRole !== 'admin') {
          // Para agentes, mostrar apenas suas conversas ou conversas na fila
          query.$or = [
            { assignedAgent: userId },
            { status: 'waiting' }
          ];
        }
      }
    }
    
    if (status && !['waiting', 'active'].includes(status)) {
      query.status = status;
    }

    const conversations = await Conversation.find(query)
      .populate('client', 'name email role')
      .populate('assignedAgent', 'name email role status')
      .sort({ lastActivity: -1 });

    // Adicionar última mensagem para cada conversa
    for (let conv of conversations) {
      const lastMessage = await Message.findOne({ conversationId: conv._id })
        .populate('sender', 'name email role')
        .sort({ createdAt: -1 });
      
      const messageCount = await Message.countDocuments({ conversationId: conv._id });
      
      conv._doc.lastMessage = lastMessage;
      conv._doc.messageCount = messageCount;
    }

    return conversations;
  }

  // Método antigo mantido para compatibilidade
  async getConversations(companyId, status, assignedAgentId) {
    const query = {};
    
    // Só adicionar companyId se foi fornecido e não for null
    if (companyId && companyId !== 'null' && companyId !== 'undefined') {
      query.companyId = companyId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (assignedAgentId) {
      query.assignedAgentId = assignedAgentId;
    }

    const conversations = await Conversation.find(query)
      .populate('client', 'name email')
      .populate('assignedAgent', 'name email role status')
      .sort({ lastActivity: -1 });

    // Adicionar última mensagem para cada conversa
    for (let conv of conversations) {
      const lastMessage = await Message.findOne({ conversationId: conv._id })
        .populate('sender', 'name email role')
        .sort({ createdAt: -1 });
      
      const messageCount = await Message.countDocuments({ conversationId: conv._id });
      
      conv._doc.lastMessage = lastMessage;
      conv._doc.messageCount = messageCount;
    }

    return conversations;
  }

  async getConversationMessages(conversationId) {
    return Message.find({ conversationId })
      .populate('sender', 'name email role')
      .sort({ createdAt: 1 });
  }

  async assignConversationToAgent(conversationId, agentId) {
    // Verificar se o agente existe e está disponível
    const agent = await User.findOne({
      _id: agentId,
      $or: [{ role: 'agent' }, { role: 'admin' }],
      active: true
    });

    if (!agent) {
      throw new Error('Agent not found or not available');
    }

    // Atualizar conversa
    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        assignedAgentId: agentId,
        assignedAgent: agentId,
        status: 'active',
        $addToSet: { participants: agentId }
      },
      { new: true }
    ).populate('client', 'name email role')
     .populate('assignedAgent', 'name email role status');

    // Remover da fila
    await QueueEntry.deleteOne({ conversationId });

    // Atualizar status do agente
    await User.findByIdAndUpdate(agentId, { status: 'busy' });
    
    // Adicionar última mensagem
    const lastMessage = await Message.findOne({ conversationId: conversation._id })
      .populate('sender', 'name email role')
      .sort({ createdAt: -1 });
    conversation._doc.lastMessage = lastMessage;

    return conversation;
  }

  async processQueue() {
    // Buscar agentes disponíveis
    const availableAgents = await User.find({
      role: 'agent',
      active: true,
      status: 'online'
    });

    if (availableAgents.length === 0) {
      return;
    }

    // Buscar próxima conversa na fila
    const queueEntry = await QueueEntry.findOne()
      .sort({ priority: -1, createdAt: 1 })
      .populate('conversationId');

    if (!queueEntry) {
      return;
    }

    // Atribuir ao primeiro agente disponível
    const agent = availableAgents[0];
    await this.assignConversationToAgent(queueEntry.conversationId._id, agent._id);

    // Continuar processando se houver mais itens na fila
    const remainingQueue = await QueueEntry.countDocuments();
    if (remainingQueue > 0 && availableAgents.length > 1) {
      setTimeout(() => this.processQueue(), 2000);
    }
  }

  async closeConversation(conversationId, closedBy) {
    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        status: 'closed',
        closedAt: new Date(),
        closedBy: closedBy
      },
      { new: true }
    );

    // Se tinha agente atribuído, liberar o agente
    if (conversation.assignedAgentId) {
      await User.findByIdAndUpdate(conversation.assignedAgentId, { status: 'online' });
    }

    // Processar fila novamente
    setTimeout(() => this.processQueue(), 1000);

    return conversation;
  }

  async getQueueStatus(companyId) {
    const queueCount = await QueueEntry.countDocuments();
    
    // Query para buscar agentes - se não tiver companyId, busca todos
    const agentQuery = {
      role: 'agent',
      active: true
    };
    
    if (companyId && companyId !== 'null' && companyId !== 'undefined') {
      agentQuery.companyId = companyId;
    }
    
    const availableAgents = await User.countDocuments({
      ...agentQuery,
      status: 'online'
    });

    const busyAgents = await User.countDocuments({
      ...agentQuery,
      status: 'busy'
    });

    return {
      queueCount,
      availableAgents,
      busyAgents,
      estimatedWait: queueCount > 0 ? Math.ceil(queueCount / Math.max(availableAgents, 1)) * 5 : 0
    };
  }

  getPriorityValue(priority) {
    const priorities = {
      low: 1,
      normal: 2,
      high: 3,
      urgent: 4
    };
    return priorities[priority] || 2;
  }
}

module.exports = new ChatService();
