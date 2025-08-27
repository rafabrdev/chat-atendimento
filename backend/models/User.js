const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const userSchema = new mongoose.Schema({
  // Multi-tenant: referência ao tenant (empresa)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: function() {
      // Master não precisa de tenant
      return this.role !== 'master';
    }
    // index criado automaticamente pelo plugin
  },
  
  // Manter companyId para compatibilidade (deprecated)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Email inválido'
    ]
  },
  password: {
    type: String,
    required: function() {
      // Senha só é obrigatória se não foi convidado
      return !this.invitedBy;
    },
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    maxlength: [100, 'Nome muito longo']
  },
  company: {
    type: String,
    required: function() {
      // Master não precisa de empresa
      return this.role !== 'master';
    },
    trim: true
  },
  role: {
    type: String,
    enum: ['master', 'admin', 'agent', 'client'],
    default: 'client',
    required: true
  },
  
  // Controle de Hierarquia e Criação
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      // Master não precisa de createdBy
      // Para usuários existentes (migração), não é obrigatório
      if (this.role === 'master') return false;
      
      // Para novos usuários, é obrigatório (exceto durante migração)
      // Verifica se é uma criação nova (não tem _id ainda)
      if (this.isNew && !this._id) {
        return true;
      }
      
      return false;
    }
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invitationToken: {
    type: String,
    select: false
  },
  invitationExpires: {
    type: Date,
    select: false
  },
  invitationAcceptedAt: Date,
  
  // Controle de Permissões Customizadas
  customPermissions: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  
  // Departamento (para agentes)
  department: {
    type: String,
    required: function() {
      return this.role === 'agent';
    }
  },
  status: {
    type: String,
    enum: ['online', 'busy', 'away', 'offline'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: null
  },
  profile: {
    phone: {
      type: String,
      default: ''
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Aplicar plugin de tenant scope
// User é especial: master não precisa de tenant
userSchema.plugin(tenantScopePlugin, {
  required: function() {
    return this.role !== 'master';
  }
});

// Índices compostos para multi-tenancy
// Email único por tenant (exceto master que não tem tenant)
userSchema.index({ tenantId: 1, email: 1 }, { 
  unique: true,
  partialFilterExpression: { tenantId: { $exists: true } }
});

// Índice para performance de busca por status dentro do tenant
userSchema.index({ tenantId: 1, status: 1, lastSeen: -1 });

// Índice para busca por role dentro do tenant
userSchema.index({ tenantId: 1, role: 1 });

// Hash password antes de salvar
userSchema.pre('save', async function(next) {
  // Se a senha não foi modificada, não fazer nada
  if (!this.isModified('password')) return next();
  
  // Se a senha já está em hash (começa com $2), não fazer hash novamente
  if (this.password && this.password.startsWith('$2')) {
    return next();
  }
  
  // Fazer hash apenas se for uma senha plain text
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para verificar senha
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para JSON (remover senha)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
