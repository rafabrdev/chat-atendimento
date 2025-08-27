const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Informações básicas da empresa
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  domain: {
    type: String,
    unique: true,
    sparse: true, // Permite null mas garante unicidade quando existe
    lowercase: true
  },
  
  // Informações de contato
  contactEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  contactPhone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Brasil' }
  },
  
  // Configurações de módulos
  modules: {
    chat: {
      enabled: { type: Boolean, default: false },
      maxAgents: { type: Number, default: 5 },
      maxConcurrentChats: { type: Number, default: 10 },
      features: {
        fileUpload: { type: Boolean, default: true },
        videoCall: { type: Boolean, default: false },
        voiceCall: { type: Boolean, default: false },
        chatbot: { type: Boolean, default: false },
        analytics: { type: Boolean, default: true }
      }
    },
    crm: {
      enabled: { type: Boolean, default: false },
      maxContacts: { type: Number, default: 1000 },
      features: {
        pipeline: { type: Boolean, default: true },
        automation: { type: Boolean, default: false },
        emailMarketing: { type: Boolean, default: false }
      }
    },
    hrm: {
      enabled: { type: Boolean, default: false },
      maxEmployees: { type: Number, default: 50 },
      features: {
        payroll: { type: Boolean, default: false },
        timeTracking: { type: Boolean, default: true },
        recruitment: { type: Boolean, default: false }
      }
    }
  },
  
  // Plano e billing
  subscription: {
    plan: {
      type: String,
      enum: ['trial', 'starter', 'professional', 'enterprise', 'custom'],
      default: 'trial'
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'cancelled', 'expired'],
      default: 'active'
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    trialEndsAt: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelledAt: Date,
    
    // Stripe
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    
    // Valores
    monthlyPrice: {
      type: Number,
      default: 0
    },
    discount: {
      percentage: { type: Number, default: 0 },
      validUntil: Date
    }
  },
  
  // Limites de uso
  limits: {
    users: { type: Number, default: 10 },
    storage: { type: Number, default: 5 }, // GB
    monthlyMessages: { type: Number, default: 10000 },
    monthlyMinutes: { type: Number, default: 1000 }, // Para calls
    apiCalls: { type: Number, default: 100000 }
  },
  
  // Configuração de quota de armazenamento
  storageQuota: {
    enabled: { type: Boolean, default: true },
    maxBytes: { 
      type: Number, 
      default: 5 * 1024 * 1024 * 1024 // 5GB em bytes
    },
    warningThreshold: {
      type: Number,
      default: 0.8 // Avisar quando atingir 80%
    },
    allowOverage: {
      type: Boolean,
      default: false // Não permitir exceder o limite
    },
    overageRate: {
      type: Number,
      default: 0 // Custo por GB adicional (se allowOverage = true)
    }
  },
  
  // Tipos de arquivo permitidos
  allowedFileTypes: [{
    type: String,
    default: [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ]
  }],
  
  // Uso atual (resetado mensalmente)
  usage: {
    currentUsers: { type: Number, default: 0 },
    currentStorage: { type: Number, default: 0 }, // MB
    monthlyMessages: { type: Number, default: 0 },
    monthlyMinutes: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },
  
  // CORS e origens permitidas
  allowedOrigins: [{
    type: String,
    validate: {
      validator: function(v) {
        // Valida formato de URL ou wildcard
        return /^(https?:\/\/[^\s]+|\*|localhost:\d+)$/.test(v);
      },
      message: 'Origem inválida: {VALUE}'
    }
  }],
  
  // Webhooks para integrações
  webhooks: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    events: [{ type: String }], // Eventos que disparam o webhook
    headers: Map, // Headers customizados
    secret: String, // Para validação HMAC
    isActive: { type: Boolean, default: true },
    retryOnFailure: { type: Boolean, default: true },
    maxRetries: { type: Number, default: 3 }
  }],
  
  // Configurações personalizadas
  settings: {
    timezone: { type: String, default: 'America/Sao_Paulo' },
    language: { type: String, default: 'pt-BR' },
    currency: { type: String, default: 'BRL' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    
    // Branding
    branding: {
      primaryColor: { type: String, default: '#007bff' },
      logo: String,
      favicon: String,
      emailTemplate: String
    },
    
    // Segurança
    security: {
      requireMFA: { type: Boolean, default: false },
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireUppercase: { type: Boolean, default: true },
        requireNumbers: { type: Boolean, default: true },
        requireSpecialChars: { type: Boolean, default: false }
      },
      ipWhitelist: [String],
      sessionTimeout: { type: Number, default: 30 } // minutos
    }
  },
  
  // Metadados
  metadata: {
    industry: String,
    size: {
      type: String,
      enum: ['micro', 'small', 'medium', 'large', 'enterprise']
    },
    source: String, // Como conheceu
    notes: String
  },
  
  // Controle
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspendedReason: String,
  
  // Master admin (owner da empresa)
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Será preenchido após criar o admin
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Dados para analytics
  stats: {
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    totalConversations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    customerSatisfaction: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Índices
// slug já tem índice criado pelo unique: true
tenantSchema.index({ 'subscription.status': 1 });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ owner: 1 });

// Middleware para atualizar updatedAt
tenantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para verificar se um módulo está habilitado
tenantSchema.methods.hasModule = function(moduleName) {
  return this.modules[moduleName] && this.modules[moduleName].enabled;
};

// Método para verificar limites
tenantSchema.methods.checkLimit = function(limitType, amount = 1) {
  const currentUsage = this.usage[limitType] || 0;
  const limit = this.limits[limitType.replace('current', '').toLowerCase()] || 0;
  return currentUsage + amount <= limit;
};

// Método para incrementar uso
tenantSchema.methods.incrementUsage = async function(usageType, amount = 1) {
  this.usage[usageType] = (this.usage[usageType] || 0) + amount;
  await this.save();
};

// Método para verificar quota de armazenamento
tenantSchema.methods.checkStorageQuota = async function(additionalBytes = 0) {
  if (!this.storageQuota.enabled) {
    return { allowed: true, currentUsage: 0, limit: 0 };
  }
  
  const s3Service = require('../services/s3Service');
  const usage = await s3Service.calculateTenantStorageUsage(this._id);
  const totalWithNew = usage.totalSize + additionalBytes;
  
  const allowed = this.storageQuota.allowOverage || 
                  totalWithNew <= this.storageQuota.maxBytes;
  
  const percentUsed = (totalWithNew / this.storageQuota.maxBytes) * 100;
  const shouldWarn = percentUsed >= (this.storageQuota.warningThreshold * 100);
  
  return {
    allowed,
    currentUsage: usage.totalSize,
    newTotal: totalWithNew,
    limit: this.storageQuota.maxBytes,
    percentUsed: percentUsed.toFixed(2),
    shouldWarn,
    overageBytes: Math.max(0, totalWithNew - this.storageQuota.maxBytes)
  };
};

// Método para resetar uso mensal
tenantSchema.methods.resetMonthlyUsage = async function() {
  this.usage.monthlyMessages = 0;
  this.usage.monthlyMinutes = 0;
  this.usage.apiCalls = 0;
  this.usage.lastReset = Date.now();
  await this.save();
};

// Método estático para criar slug único
tenantSchema.statics.generateSlug = async function(companyName) {
  let slug = companyName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
  
  let uniqueSlug = slug;
  let counter = 1;
  
  while (await this.findOne({ slug: uniqueSlug })) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
  
  return uniqueSlug;
};

module.exports = mongoose.model('Tenant', tenantSchema);
