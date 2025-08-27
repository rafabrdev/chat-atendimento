const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const conversationSchema = new mongoose.Schema({
  // Multi-tenant: referência ao tenant (empresa)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
    // index criado automaticamente pelo plugin
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false // Deprecated - usar tenantId
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // contactId removido temporariamente - Contact model não existe ainda
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'closed'],
    default: 'waiting'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  tags: [{
    type: String
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  feedback: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para performance
conversationSchema.index({ status: 1, createdAt: -1 });
conversationSchema.index({ assignedAgent: 1, status: 1 });
conversationSchema.index({ client: 1, createdAt: -1 });


// Aplicar plugin de tenant scope
conversationSchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('Conversation', conversationSchema);
