const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');
const crypto = require('crypto');

const invitationSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
    // index criado automaticamente pelo plugin
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['agent', 'client', 'admin'],
    required: true
  },
  department: {
    type: String,
    required: function() {
      return this.role === 'agent';
    }
  },
  token: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    }
  },
  usedAt: {
    type: Date
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'cancelled'],
    default: 'pending'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Gerar token único antes de salvar
invitationSchema.pre('save', function(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Método para verificar se o convite está válido
invitationSchema.methods.isValid = function() {
  return this.status === 'pending' && 
         this.expiresAt > Date.now();
};

// Método para aceitar convite
invitationSchema.methods.accept = async function(userId) {
  if (!this.isValid()) {
    throw new Error('Convite inválido ou expirado');
  }
  
  this.status = 'accepted';
  this.usedAt = Date.now();
  this.usedBy = userId;
  await this.save();
  
  return this;
};

// Método para cancelar convite
invitationSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  await this.save();
  return this;
};

// Método estático para limpar convites expirados
invitationSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: Date.now() }
    },
    {
      status: 'expired'
    }
  );
  return result;
};

// Índices
invitationSchema.index({ tenantId: 1, email: 1 });
invitationSchema.index({ status: 1, expiresAt: 1 });


// Aplicar plugin de tenant scope
invitationSchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('Invitation', invitationSchema);
