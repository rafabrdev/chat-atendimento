const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const messageSchema = new mongoose.Schema({
  // Multi-tenant: referência ao tenant (empresa)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
    // index criado automaticamente pelo plugin
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  senderType: {
    type: String,
    enum: ['client', 'agent', 'admin'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video', 'document', 'system'],
    default: 'text'
  },
  attachments: [{
    url: String,
    type: String,
    name: String,
    size: Number
  }],
  files: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices compostos para multi-tenancy e performance
// Índice principal para buscar mensagens de uma conversa dentro do tenant
messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: -1 });

// Índice para buscar mensagens por remetente dentro do tenant
messageSchema.index({ tenantId: 1, sender: 1, createdAt: -1 });

// Índice para buscar mensagens não lidas dentro do tenant
messageSchema.index({ tenantId: 1, isRead: 1, createdAt: -1 });

// Índice para buscar por tipo de mensagem
messageSchema.index({ tenantId: 1, type: 1, createdAt: -1 });


// Aplicar plugin de tenant scope
messageSchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('Message', messageSchema);
