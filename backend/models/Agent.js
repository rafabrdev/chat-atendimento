const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const agentSchema = new mongoose.Schema({
  // Multi-tenant: referência ao tenant (empresa)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
    // index criado automaticamente pelo plugin
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away', 'break'],
    default: 'offline'
  },
  availability: {
    isAvailable: {
      type: Boolean,
      default: false
    },
    maxConcurrentChats: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    currentActiveChats: {
      type: Number,
      default: 0,
      min: 0
    },
    lastStatusChange: {
      type: Date,
      default: Date.now
    }
  },
  skills: [{
    type: String
  }],
  departments: [{
    type: String
  }],
  languages: [{
    type: String,
    default: ['pt']
  }],
  performance: {
    totalConversations: {
      type: Number,
      default: 0
    },
    resolvedConversations: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number, // in seconds
      default: 0
    },
    averageResolutionTime: {
      type: Number, // in minutes
      default: 0
    },
    firstResponseTimes: [{
      time: Number,
      date: Date
    }],
    resolutionTimes: [{
      time: Number,
      date: Date
    }]
  },
  workSchedule: {
    timezone: {
      type: String,
      default: 'America/Sao_Paulo'
    },
    workDays: [{
      type: Number, // 0-6 (Sunday to Saturday)
      min: 0,
      max: 6
    }],
    workHours: {
      start: {
        type: String, // HH:MM format
        default: '09:00'
      },
      end: {
        type: String, // HH:MM format
        default: '18:00'
      }
    },
    breaks: [{
      start: String,
      end: String,
      description: String
    }]
  },
  metrics: {
    daily: [{
      date: {
        type: Date,
        required: true
      },
      conversationsHandled: {
        type: Number,
        default: 0
      },
      messagessSent: {
        type: Number,
        default: 0
      },
      averageResponseTime: {
        type: Number,
        default: 0
      },
      satisfactionScore: {
        type: Number,
        default: 0
      },
      onlineTime: {
        type: Number, // in minutes
        default: 0
      }
    }],
    weekly: [{
      weekStart: Date,
      weekEnd: Date,
      totalConversations: Number,
      resolvedConversations: Number,
      averageRating: Number,
      totalOnlineTime: Number
    }],
    monthly: [{
      month: Number,
      year: Number,
      totalConversations: Number,
      resolvedConversations: Number,
      averageRating: Number,
      totalOnlineTime: Number
    }]
  },
  preferences: {
    notificationSound: {
      type: Boolean,
      default: true
    },
    desktopNotifications: {
      type: Boolean,
      default: true
    },
    autoAcceptChats: {
      type: Boolean,
      default: false
    },
    showTypingIndicator: {
      type: Boolean,
      default: true
    }
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for performance
// Índice único composto: cada usuário só pode ter um agent por tenant
agentSchema.index({ tenantId: 1, user: 1 }, { unique: true });
agentSchema.index({ status: 1, 'availability.isAvailable': 1 });
agentSchema.index({ 'performance.averageRating': -1 });
agentSchema.index({ 'availability.currentActiveChats': 1 });

// Virtual to check if agent can accept new chats
agentSchema.virtual('canAcceptNewChat').get(function() {
  return this.status === 'online' && 
         this.availability.isAvailable && 
         this.availability.currentActiveChats < this.availability.maxConcurrentChats;
});

// Method to update performance metrics
agentSchema.methods.updatePerformanceMetrics = function(conversation, rating) {
  this.performance.totalConversations++;
  
  if (conversation.status === 'closed') {
    this.performance.resolvedConversations++;
  }
  
  if (rating) {
    const totalRating = this.performance.averageRating * this.performance.totalRatings;
    this.performance.totalRatings++;
    this.performance.averageRating = (totalRating + rating) / this.performance.totalRatings;
  }
  
  return this.save();
};

// Method to update response time
agentSchema.methods.updateResponseTime = function(responseTime) {
  this.performance.firstResponseTimes.push({
    time: responseTime,
    date: new Date()
  });
  
  // Keep only last 100 response times
  if (this.performance.firstResponseTimes.length > 100) {
    this.performance.firstResponseTimes = this.performance.firstResponseTimes.slice(-100);
  }
  
  // Calculate average
  const total = this.performance.firstResponseTimes.reduce((acc, curr) => acc + curr.time, 0);
  this.performance.averageResponseTime = total / this.performance.firstResponseTimes.length;
  
  return this.save();
};

// Method to change status
agentSchema.methods.changeStatus = async function(newStatus) {
  const oldStatus = this.status;
  this.status = newStatus;
  this.availability.lastStatusChange = new Date();
  
  if (newStatus === 'online') {
    this.availability.isAvailable = true;
  } else if (newStatus === 'offline') {
    this.availability.isAvailable = false;
    this.availability.currentActiveChats = 0;
  }
  
  await this.save();
  return { oldStatus, newStatus };
};

// Static method to find available agent
agentSchema.statics.findAvailableAgent = async function(criteria = {}) {
  const query = {
    status: 'online',
    'availability.isAvailable': true,
    $expr: {
      $lt: ['$availability.currentActiveChats', '$availability.maxConcurrentChats']
    }
  };
  
  // Add additional criteria if provided
  if (criteria.skills && criteria.skills.length > 0) {
    query.skills = { $in: criteria.skills };
  }
  
  if (criteria.departments && criteria.departments.length > 0) {
    query.departments = { $in: criteria.departments };
  }
  
  if (criteria.languages && criteria.languages.length > 0) {
    query.languages = { $in: criteria.languages };
  }
  
  // Find agents sorted by least active chats and best rating
  return this.find(query)
    .sort({ 
      'availability.currentActiveChats': 1,
      'performance.averageRating': -1
    })
    .populate('user', 'name email avatar')
    .limit(1);
};

// Static method to get agent workload
agentSchema.statics.getWorkloadDistribution = async function() {
  return this.aggregate([
    {
      $match: {
        status: { $in: ['online', 'busy', 'away'] }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalActiveChats: { $sum: '$availability.currentActiveChats' },
        avgActiveChats: { $avg: '$availability.currentActiveChats' }
      }
    }
  ]);
};


// Aplicar plugin de tenant scope
agentSchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('Agent', agentSchema);
