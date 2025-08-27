const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const queueEntrySchema = new mongoose.Schema({
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
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 4
  },
  estimatedWait: {
    type: Number, // tempo em minutos
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para ordenação da fila
queueEntrySchema.index({ priority: -1, createdAt: 1 });
// Índice único composto: cada conversação só pode ter uma entrada na fila por tenant
queueEntrySchema.index({ tenantId: 1, conversationId: 1 }, { unique: true });


// Aplicar plugin de tenant scope
queueEntrySchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('QueueEntry', queueEntrySchema);
