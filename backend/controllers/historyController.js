const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const File = require('../models/File');
const User = require('../models/User');
const Agent = require('../models/Agent');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Get conversation history with advanced filters
exports.getConversationHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      agentId,
      clientId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tags,
      rating,
      priority
    } = req.query;

    // Build query - incluindo filtro de tenant
    const query = { ...req.tenantFilter || {} };

    // User-specific filters
    if (req.user.role === 'client') {
      query.client = req.user._id;
    } else if (req.user.role === 'agent' && !agentId) {
      query.assignedAgent = req.user._id;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Agent filter
    if (agentId && req.user.role === 'admin') {
      query.assignedAgent = agentId;
    }

    // Client filter
    if (clientId && (req.user.role === 'admin' || req.user.role === 'agent')) {
      query.client = clientId;
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Rating filter
    if (rating) {
      query.rating = parseInt(rating);
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Search in messages if search term provided
    let conversationIds = [];
    if (search) {
      const messageQuery = {
        ...req.tenantFilter || {},
        content: { $regex: search, $options: 'i' }
      };

      const messages = await Message.find(messageQuery)
        .distinct('conversationId');
      
      conversationIds = messages;
      
      if (conversationIds.length > 0) {
        query._id = { $in: conversationIds };
      } else {
        // No messages found, return empty result
        return res.json({
          success: true,
          conversations: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const conversations = await Conversation.find(query)
      .populate('client', 'name email avatar company')
      .populate('assignedAgent', 'name email avatar company')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await Conversation.countDocuments(query);

    // Get last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({
          ...req.tenantFilter || {},
          conversationId: conv._id
        })
          .sort({ createdAt: -1 })
          .populate('sender', 'name');

        const messageCount = await Message.countDocuments({
          ...req.tenantFilter || {},
          conversationId: conv._id
        });

        return {
          ...conv.toObject(),
          lastMessage,
          messageCount
        };
      })
    );

    res.json({
      success: true,
      conversations: conversationsWithLastMessage,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching conversation history'
    });
  }
};

// Get detailed conversation with all messages
exports.getConversationDetail = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { includeFiles = true } = req.query;

    const conversation = await Conversation.findById(conversationId)
      .populate('client', 'name email avatar company')
      .populate('assignedAgent', 'name email avatar company');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check access
    const userId = req.user._id.toString();
    const hasAccess = 
      conversation.client._id.toString() === userId ||
      (conversation.assignedAgent && conversation.assignedAgent._id.toString() === userId) ||
      req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get all messages
    const messages = await Message.find({ 
      ...req.tenantFilter || {},
      conversationId 
    })
      .populate('sender', 'name email avatar')
      .populate('files')
      .sort({ createdAt: 1 });

    // Get files if requested
    let files = [];
    if (includeFiles === 'true') {
      files = await File.find({ 
        ...req.tenantFilter || {},
        conversation: conversationId 
      })
        .populate('uploadedBy', 'name email')
        .sort({ createdAt: -1 });
    }

    res.json({
      success: true,
      conversation,
      messages,
      files
    });
  } catch (error) {
    console.error('Error fetching conversation detail:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching conversation detail'
    });
  }
};

// Export conversation to CSV
exports.exportConversationToCSV = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId)
      .populate('client', 'name email company')
      .populate('assignedAgent', 'name email company');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check access
    const userId = req.user._id.toString();
    const hasAccess = 
      conversation.client._id.toString() === userId ||
      (conversation.assignedAgent && conversation.assignedAgent._id.toString() === userId) ||
      req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get messages
    const messages = await Message.find({ 
      ...req.tenantFilter || {},
      conversationId 
    })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 });

    // Prepare data for CSV
    const csvData = messages.map(msg => ({
      timestamp: msg.createdAt,
      sender: msg.sender.name,
      senderEmail: msg.sender.email,
      senderType: msg.senderType,
      content: msg.content,
      type: msg.type
    }));

    // Create CSV
    const fields = ['timestamp', 'sender', 'senderEmail', 'senderType', 'content', 'type'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(csvData);

    // Set headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.csv"`);

    res.send(csv);
  } catch (error) {
    console.error('Error exporting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Error exporting conversation'
    });
  }
};

// Export conversation to PDF
exports.exportConversationToPDF = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Validate conversation ID
    if (!conversationId || conversationId === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID'
      });
    }

    const conversation = await Conversation.findById(conversationId)
      .populate('client', 'name email company')
      .populate('assignedAgent', 'name email company');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check access
    const userId = req.user._id.toString();
    const hasAccess = 
      (conversation.client && conversation.client._id.toString() === userId) ||
      (conversation.assignedAgent && conversation.assignedAgent._id.toString() === userId) ||
      req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get messages
    const messages = await Message.find({ 
      ...req.tenantFilter || {},
      conversationId 
    })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 });

    // Create PDF
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 50
    });
    
    // Buffer to collect PDF data
    const chunks = [];
    let result;
    
    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    doc.on('end', () => {
      result = Buffer.concat(chunks);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.pdf"`);
      res.setHeader('Content-Length', result.length);
      
      // Send the PDF
      res.send(result);
    });

    // Add header
    doc.fontSize(20).text('Transcrição da Conversa', { align: 'center' });
    doc.moveDown();
    
    // Add conversation info with null checks
    doc.fontSize(12);
    
    const clientName = conversation.client?.name || 'Cliente Desconhecido';
    const clientEmail = conversation.client?.email || 'Sem email';
    const clientCompany = conversation.client?.company || conversation.client?.profile?.company || '';
    doc.text(`Cliente: ${clientName} ${clientCompany ? `(${clientCompany})` : `(${clientEmail})`}`);
    
    if (conversation.assignedAgent) {
      const agentName = conversation.assignedAgent.name || 'Agente Desconhecido';
      const agentEmail = conversation.assignedAgent.email || 'Sem email';
      const agentCompany = conversation.assignedAgent.company || conversation.assignedAgent.profile?.company || '';
      doc.text(`Agente: ${agentName} ${agentCompany ? `(${agentCompany})` : `(${agentEmail})`}`);
    } else {
      doc.text('Agente: Não atribuído');
    }
    
    const statusMap = {
      'active': 'Ativo',
      'waiting': 'Aguardando',
      'closed': 'Fechado'
    };
    doc.text(`Status: ${statusMap[conversation.status] || conversation.status || 'Desconhecido'}`);
    
    if (conversation.createdAt) {
      doc.text(`Criado em: ${new Date(conversation.createdAt).toLocaleString('pt-BR')}`);
    }
    
    if (conversation.closedAt) {
      doc.text(`Fechado em: ${new Date(conversation.closedAt).toLocaleString('pt-BR')}`);
    }
    
    if (conversation.rating) {
      doc.text(`Avaliação: ${conversation.rating}/5`);
    }
    
    doc.moveDown();
    
    // Add messages section
    doc.fontSize(14).text('Mensagens:', { underline: true });
    doc.moveDown(0.5);
    
    if (messages && messages.length > 0) {
      doc.fontSize(10);
      messages.forEach((msg) => {
        try {
          const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleString('pt-BR') : 'Horário desconhecido';
          const senderName = msg.sender?.name || 'Sistema';
          const senderTypeMap = {
            'client': 'Cliente',
            'agent': 'Agente',
            'system': 'Sistema'
          };
          const senderType = senderTypeMap[msg.senderType] || msg.senderType || 'desconhecido';
          const content = msg.content || '[Sem conteúdo]';
          
          // Add message header
          doc.font('Helvetica-Bold')
             .text(`${timestamp} - ${senderName} (${senderType}):`, {
               continued: false
             });
          
          // Add message content
          doc.font('Helvetica')
             .text(content, { 
               indent: 20,
               width: 500
             });
          
          doc.moveDown(0.5);
        } catch (msgError) {
          console.error('Error processing message:', msgError);
          doc.text('[Error processing message]');
          doc.moveDown(0.5);
        }
      });
    } else {
      doc.fontSize(10).text('Nenhuma mensagem nesta conversa.');
    }

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error exporting conversation to PDF:', error);
    
    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Error exporting conversation to PDF: ' + error.message
      });
    }
  }
};

// Get conversation analytics
exports.getConversationAnalytics = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      groupBy = 'day' // day, week, month
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // User-specific filters
    const userFilter = {};
    if (req.user.role === 'client') {
      userFilter.client = req.user._id;
    } else if (req.user.role === 'agent') {
      userFilter.assignedAgent = req.user._id;
    }

    const query = { ...req.tenantFilter || {}, ...dateFilter, ...userFilter };

    // Group format based on groupBy parameter
    let groupFormat;
    switch (groupBy) {
      case 'month':
        groupFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      case 'week':
        groupFormat = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
        break;
      default: // day
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    // Aggregate conversations
    const conversationStats = await Conversation.aggregate([
      { $match: query },
      {
        $group: {
          _id: groupFormat,
          total: { $sum: 1 },
          closed: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          waiting: {
            $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] }
          },
          avgRating: { $avg: '$rating' },
          totalRated: {
            $sum: { $cond: [{ $ne: ['$rating', null] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get response time analytics
    const responseTimeStats = await Message.aggregate([
      {
        $match: {
          ...dateFilter,
          senderType: 'agent'
        }
      },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation'
        }
      },
      { $unwind: '$conversation' },
      {
        $match: userFilter.assignedAgent 
          ? { 'conversation.assignedAgent': userFilter.assignedAgent }
          : {}
      },
      {
        $group: {
          _id: groupFormat,
          totalMessages: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get satisfaction scores
    const satisfactionStats = await Conversation.aggregate([
      {
        $match: {
          ...query,
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Calculate summary statistics
    const totalConversations = await Conversation.countDocuments(query);
    const closedConversations = await Conversation.countDocuments({
      ...query,
      status: 'closed'
    });
    const avgRating = await Conversation.aggregate([
      { $match: { ...query, rating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);

    res.json({
      success: true,
      analytics: {
        timeline: conversationStats,
        responseTime: responseTimeStats,
        satisfaction: satisfactionStats,
        summary: {
          totalConversations,
          closedConversations,
          resolutionRate: totalConversations > 0 
            ? ((closedConversations / totalConversations) * 100).toFixed(2)
            : 0,
          averageRating: avgRating.length > 0 ? avgRating[0].avg.toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching conversation analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching conversation analytics'
    });
  }
};

// Search conversations
exports.searchConversations = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Search in messages
    const messageQuery = {
      ...req.tenantFilter || {},
      content: { $regex: q, $options: 'i' }
    };

    // Get conversation IDs from matching messages
    const conversationIds = await Message.find(messageQuery)
      .distinct('conversationId');

    // Build conversation query
    const conversationQuery = {
      ...req.tenantFilter || {},
      $or: [
        { _id: { $in: conversationIds } },
        { tags: { $regex: q, $options: 'i' } }
      ]
    };

    // Add user-specific filters
    if (req.user.role === 'client') {
      conversationQuery.client = req.user._id;
    } else if (req.user.role === 'agent') {
      conversationQuery.assignedAgent = req.user._id;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Execute search
    const conversations = await Conversation.find(conversationQuery)
      .populate('client', 'name email avatar')
      .populate('assignedAgent', 'name email avatar')
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Conversation.countDocuments(conversationQuery);

    // Get matching messages for each conversation
    const results = await Promise.all(
      conversations.map(async (conv) => {
        const matchingMessages = await Message.find({
          ...req.tenantFilter || {},
          conversationId: conv._id,
          content: { $regex: q, $options: 'i' }
        })
          .limit(3)
          .sort({ createdAt: -1 });

        return {
          conversation: conv,
          matchingMessages
        };
      })
    );

    res.json({
      success: true,
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Error searching conversations'
    });
  }
};
