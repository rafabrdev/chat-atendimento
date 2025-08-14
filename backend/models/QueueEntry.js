const mongoose = require('mongoose');

const queueEntrySchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    unique: true
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

module.exports = mongoose.model('QueueEntry', queueEntrySchema);
