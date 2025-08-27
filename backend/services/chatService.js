const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');
const lockService = require('./lockService');

class ChatService {
  async createConversation(data) {
    try {
      // Validar dados obrigatórios
      if (!data.clientId) {
        throw new Error('Client ID is required');
      }
      
      if (!data.tenantId) {
        throw new Error('Tenant ID is required');
      }
      
      const conversation = await Conversation.create({
        tenantId: data.tenantId,  // Usar tenantId em vez de companyId
        client: data.clientId,
        priority: data.priority || 'normal',
        tags: data.tags || [],
        status: 'waiting',
        participants: [data.clientId],
        subject: data.subject || '',
        department: data.department || 'general'
      });

      // Popular os dados do cliente
      await conversation.populate('client', 'name email company');
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

    // Mapear tipo para valores válidos do enum
    let messageType = data.type || 'text';
    if (!['text', 'image', 'file', 'audio', 'video', 'document', 'system'].includes(messageType)) {
      // Se o tipo não é válido, usar 'file' como padrão para arquivos
      messageType = 'file';
    }
    
    // Preparar dados da mensagem
    const messageData = {
      tenantId: conversation.tenantId,  // Usar o tenantId da conversa
      conversationId: data.conversationId,
      sender: data.senderId,
      senderId: data.senderId,
      senderType: data.senderType,
      content: data.content,
      type: messageType,
      metadata: data.metadata
    };

    // Adicionar arquivos se houver
    if (data.files && data.files.length > 0) {
      // Não salvar attachments, apenas metadados dos arquivos no campo metadata
      messageData.metadata = {
        ...messageData.metadata,
        files: data.files.map(file => ({
          _id: file._id,
          originalName: file.originalName || file.name,
          url: file.url,
          fileType: file.fileType || file.type,
          size: file.size,
          mimetype: file.mimetype || file.type
        }))
      };
    }

    // Criar mensagem
    const message = await Message.create(messageData);

    // Atualizar última atividade da conversa
    await Conversation.findByIdAndUpdate(data.conversationId, {
      lastActivity: new Date(),
      lastMessageAt: new Date()
    });

    // Popular dados do sender e arquivos
    await message.populate('sender', 'name email role');
    if (message.files && message.files.length > 0) {
      await message.populate('files');
    }
    
    // Converter para objeto e garantir estrutura de files
    const msgObj = message.toObject();
    
    // Se tem metadata.files, copiar para files no nível raíz para compatibilidade com frontend
    if (msgObj.metadata && msgObj.metadata.files) {
      msgObj.files = msgObj.metadata.files;
    }
    // Se tem attachments mas não tem files, criar estrutura
    else if (msgObj.attachments && msgObj.attachments.length > 0) {
      msgObj.files = msgObj.attachments.map(att => ({
        _id: att._id,
        originalName: att.name,
        url: att.url,
        fileType: att.type,
        size: att.size,
        mimetype: att.type
      }));
    }

    return msgObj;
  }

  async getConversationsForUser(userId, userRole, status, assignedAgentId, tenantId) {
    const query = {};
    
    // IMPORTANTE: Sempre filtrar por tenantId para garantir isolamento
    if (tenantId) {
      query.tenantId = tenantId;
    }
    
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
      .populate('client', 'name email role company')
      .populate('assignedAgent', 'name email role status company')
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
      .populate('client', 'name email company')
      .populate('assignedAgent', 'name email role status company')
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
    const messages = await Message.find({ conversationId })
      .populate('sender', 'name email role')
      .populate('files') // Popular arquivos se houver
      .sort({ createdAt: 1 });
    
    // Para cada mensagem, garantir que os files estejam disponíveis
    return messages.map(msg => {
      const msgObj = msg.toObject();
      
      // Se tem metadata.files, copiar para files no nível raíz
      if (msgObj.metadata && msgObj.metadata.files) {
        msgObj.files = msgObj.metadata.files;
      }
      // Se tem attachments mas não tem files, criar estrutura de files
      else if (msgObj.attachments && msgObj.attachments.length > 0 && (!msgObj.files || msgObj.files.length === 0)) {
        msgObj.files = msgObj.attachments.map(att => ({
          _id: att._id,
          originalName: att.name,
          url: att.url,
          fileType: att.type,
          size: att.size,
          mimetype: att.type
        }));
      }
      
      return msgObj;
    });
  }

  async assignConversationToAgent(conversationId, agentId, tenantId = null) {
    // Resource key para o lock - incluir tenantId para evitar conflitos entre tenants
    const lockResource = tenantId 
      ? `tenant:${tenantId}:conversation:${conversationId}`
      : `conversation:${conversationId}`;
    const lockHolder = `agent:${agentId}`;
    
    // Configurações do lock
    const lockOptions = {
      ttl: 10000, // 10 segundos de timeout
      retry: true,
      maxRetries: 3,
      retryDelay: 200 // 200ms entre tentativas
    };

    // Tentar adquirir o lock
    const lockResult = await lockService.acquire(lockResource, lockHolder, lockOptions);
    
    if (!lockResult.success) {
      // Lock não adquirido - outro agente já está processando
      const errorMsg = lockResult.holder === 'timeout' 
        ? 'Timeout ao tentar aceitar a conversa. Por favor, tente novamente.'
        : `Conversa já foi aceita por outro agente`;
      
      // Buscar informações atualizadas da conversa
      const currentConversation = await Conversation.findById(conversationId)
        .populate('assignedAgent', 'name email');
      
      if (currentConversation?.assignedAgent) {
        throw new Error(`Conversa já foi aceita por ${currentConversation.assignedAgent.name}`);
      }
      
      throw new Error(errorMsg);
    }

    try {
      // Verificar novamente se a conversa ainda está disponível (double-check)
      const currentConversation = await Conversation.findById(conversationId);
      
      if (!currentConversation) {
        throw new Error('Conversa não encontrada');
      }
      
      if (currentConversation.status !== 'waiting') {
        // Se já não está mais esperando, pode ter sido aceita por outro agente
        if (currentConversation.assignedAgent) {
          const assignedAgent = await User.findById(currentConversation.assignedAgent).select('name');
          throw new Error(`Conversa já foi aceita por ${assignedAgent?.name || 'outro agente'}`);
        }
        throw new Error('Conversa não está mais disponível');
      }

      // Validar tenantId se fornecido
      if (tenantId && currentConversation.tenantId?.toString() !== tenantId.toString()) {
        throw new Error('Conversa não pertence ao tenant do usuário');
      }

      // Verificar se o agente existe e está disponível
      const agent = await User.findOne({
        _id: agentId,
        $or: [{ role: 'agent' }, { role: 'admin' }],
        active: true
      });

      if (!agent) {
        throw new Error('Agente não encontrado ou não disponível');
      }
      
      // Validar que o agente pertence ao mesmo tenant se aplicável
      if (tenantId && agent.tenantId?.toString() !== tenantId.toString()) {
        throw new Error('Agente não pertence ao tenant da conversa');
      }

      // Usar transação para garantir atomicidade
      const session = await Conversation.startSession();
      let conversation;
      
      try {
        await session.startTransaction();
        
        // Preparar filtro com tenantId se fornecido
        const updateFilter = {
          _id: conversationId,
          status: 'waiting' // Garantir que ainda está esperando
        };
        
        // Adicionar tenantId ao filtro se fornecido
        if (tenantId) {
          updateFilter.tenantId = tenantId;
        }
        
        // Atualizar conversa atomicamente
        conversation = await Conversation.findOneAndUpdate(
          updateFilter,
          {
            assignedAgentId: agentId,
            assignedAgent: agentId,
            status: 'active',
            $addToSet: { participants: agentId }
          },
          { 
            new: true,
            session
          }
        ).populate('client', 'name email role company')
         .populate('assignedAgent', 'name email role status company');

        if (!conversation) {
          throw new Error('Conversa já foi aceita por outro agente');
        }

        // Remover da fila
        await QueueEntry.deleteOne({ conversationId }, { session });

        // Atualizar status do agente
        await User.findByIdAndUpdate(
          agentId, 
          { status: 'busy' },
          { session }
        );
        
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
      
      // Adicionar última mensagem (fora da transação para não afetar performance)
      const lastMessage = await Message.findOne({ conversationId: conversation._id })
        .populate('sender', 'name email role')
        .sort({ createdAt: -1 });
      conversation._doc.lastMessage = lastMessage;

      // Log de sucesso
      console.log(`✅ Conversa ${conversationId} aceita com sucesso pelo agente ${agent.name}`);

      return conversation;
      
    } finally {
      // Sempre liberar o lock
      await lockService.release(lockResource, lockResult.token);
    }
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
