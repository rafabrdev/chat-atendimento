const Agent = require('../models/Agent');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Get agent profile
exports.getAgentProfile = async (req, res) => {
  try {
    const agentId = req.params.agentId || req.user._id;
    
    const agent = await Agent.findOne({ user: agentId })
      .populate('user', 'name email avatar role');
    
    if (!agent) {
      // Create agent profile if doesn't exist for agent users
      const user = await User.findById(agentId);
      if (user && user.role === 'agent') {
        const newAgent = await Agent.create({ user: agentId });
        return res.json({
          success: true,
          agent: await newAgent.populate('user', 'name email avatar role')
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error fetching agent profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching agent profile'
    });
  }
};

// Update agent status
exports.updateAgentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['online', 'offline', 'busy', 'away', 'break'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    let agent = await Agent.findOne({ user: req.user._id });
    
    if (!agent) {
      // Create agent profile if doesn't exist
      agent = await Agent.create({ user: req.user._id });
    }
    
    const statusChange = await agent.changeStatus(status);
    
    // Emit status change to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('agent:statusChanged', {
        agentId: req.user._id,
        ...statusChange
      });
    }
    
    res.json({
      success: true,
      message: `Status changed from ${statusChange.oldStatus} to ${statusChange.newStatus}`,
      agent
    });
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating agent status'
    });
  }
};

// Update agent availability settings
exports.updateAgentAvailability = async (req, res) => {
  try {
    const { maxConcurrentChats, skills, departments, languages } = req.body;
    
    let agent = await Agent.findOne({ user: req.user._id });
    
    if (!agent) {
      agent = await Agent.create({ user: req.user._id });
    }
    
    if (maxConcurrentChats !== undefined) {
      agent.availability.maxConcurrentChats = Math.min(20, Math.max(1, maxConcurrentChats));
    }
    
    if (skills) {
      agent.skills = skills;
    }
    
    if (departments) {
      agent.departments = departments;
    }
    
    if (languages) {
      agent.languages = languages;
    }
    
    await agent.save();
    
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error updating agent availability:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating agent availability'
    });
  }
};

// Get all agents with status
exports.getAllAgents = async (req, res) => {
  try {
    const { status, available, department, skill } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (available === 'true') {
      query['availability.isAvailable'] = true;
      query.$expr = {
        $lt: ['$availability.currentActiveChats', '$availability.maxConcurrentChats']
      };
    }
    
    if (department) {
      query.departments = department;
    }
    
    if (skill) {
      query.skills = skill;
    }
    
    const agents = await Agent.find(query)
      .populate('user', 'name email avatar')
      .sort({ 'performance.averageRating': -1 });
    
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching agents'
    });
  }
};

// Get agent performance metrics
exports.getAgentPerformance = async (req, res) => {
  try {
    const agentId = req.params.agentId || req.user._id;
    const { period = 'week', startDate, endDate } = req.query;
    
    const agent = await Agent.findOne({ user: agentId });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    // Calculate date range
    let dateFilter = {};
    const now = new Date();
    
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      switch (period) {
        case 'day':
          dateFilter.createdAt = {
            $gte: new Date(now.setHours(0, 0, 0, 0))
          };
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          dateFilter.createdAt = { $gte: weekAgo };
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          dateFilter.createdAt = { $gte: monthAgo };
          break;
      }
    }
    
    // Get conversation statistics
    const conversations = await Conversation.find({
      assignedAgent: agentId,
      ...dateFilter
    });
    
    const totalConversations = conversations.length;
    const closedConversations = conversations.filter(c => c.status === 'closed').length;
    const avgRating = conversations
      .filter(c => c.rating)
      .reduce((acc, c) => acc + c.rating, 0) / conversations.filter(c => c.rating).length || 0;
    
    // Get message statistics
    const messages = await Message.find({
      sender: agentId,
      ...dateFilter
    });
    
    // Calculate response times
    const responseTimes = [];
    for (const conv of conversations) {
      const firstClientMessage = await Message.findOne({
        conversationId: conv._id,
        senderType: 'client'
      }).sort({ createdAt: 1 });
      
      if (firstClientMessage) {
        const firstAgentMessage = await Message.findOne({
          conversationId: conv._id,
          senderType: 'agent',
          createdAt: { $gt: firstClientMessage.createdAt }
        }).sort({ createdAt: 1 });
        
        if (firstAgentMessage) {
          const responseTime = (firstAgentMessage.createdAt - firstClientMessage.createdAt) / 1000; // in seconds
          responseTimes.push(responseTime);
        }
      }
    }
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    res.json({
      success: true,
      performance: {
        period,
        totalConversations,
        closedConversations,
        openConversations: totalConversations - closedConversations,
        averageRating: avgRating.toFixed(2),
        totalMessages: messages.length,
        averageResponseTime: Math.round(avgResponseTime),
        resolutionRate: totalConversations > 0 
          ? ((closedConversations / totalConversations) * 100).toFixed(2) 
          : 0,
        agentProfile: agent.performance
      }
    });
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching agent performance'
    });
  }
};

// Get workload distribution
exports.getWorkloadDistribution = async (req, res) => {
  try {
    const workload = await Agent.getWorkloadDistribution();
    
    const totalAgents = await Agent.countDocuments();
    const onlineAgents = await Agent.countDocuments({ status: 'online' });
    const availableAgents = await Agent.countDocuments({
      status: 'online',
      'availability.isAvailable': true,
      $expr: {
        $lt: ['$availability.currentActiveChats', '$availability.maxConcurrentChats']
      }
    });
    
    res.json({
      success: true,
      workload: {
        distribution: workload,
        summary: {
          totalAgents,
          onlineAgents,
          availableAgents,
          offlineAgents: totalAgents - onlineAgents
        }
      }
    });
  } catch (error) {
    console.error('Error fetching workload distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching workload distribution'
    });
  }
};

// Auto-assign conversation to available agent
exports.autoAssignAgent = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const { skills, department, language } = req.query;
    
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    if (conversation.assignedAgent) {
      return res.status(400).json({
        success: false,
        error: 'Conversation already assigned'
      });
    }
    
    // Find available agent based on criteria
    const criteria = {};
    if (skills) criteria.skills = skills.split(',');
    if (department) criteria.departments = [department];
    if (language) criteria.languages = [language];
    
    const availableAgents = await Agent.findAvailableAgent(criteria);
    
    if (availableAgents.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No available agents found'
      });
    }
    
    const selectedAgent = availableAgents[0];
    
    // Assign agent to conversation
    conversation.assignedAgent = selectedAgent.user._id;
    conversation.assignedAgentId = selectedAgent.user._id;
    conversation.status = 'active';
    await conversation.save();
    
    // Update agent's active chats count
    selectedAgent.availability.currentActiveChats++;
    await selectedAgent.save();
    
    // Emit assignment event
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation:assigned', {
        conversationId,
        agent: selectedAgent.user
      });
      
      io.to(`user:${selectedAgent.user._id}`).emit('conversation:newAssignment', {
        conversationId,
        conversation
      });
    }
    
    res.json({
      success: true,
      message: 'Agent assigned successfully',
      agent: selectedAgent.user,
      conversation
    });
  } catch (error) {
    console.error('Error auto-assigning agent:', error);
    res.status(500).json({
      success: false,
      error: 'Error auto-assigning agent'
    });
  }
};

// Update agent preferences
exports.updateAgentPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    
    let agent = await Agent.findOne({ user: req.user._id });
    
    if (!agent) {
      agent = await Agent.create({ user: req.user._id });
    }
    
    if (preferences) {
      agent.preferences = { ...agent.preferences, ...preferences };
    }
    
    await agent.save();
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: agent.preferences
    });
  } catch (error) {
    console.error('Error updating agent preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating agent preferences'
    });
  }
};
