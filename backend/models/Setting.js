const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const settingSchema = new mongoose.Schema({
  // Multi-tenant: referência ao tenant (empresa)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
    // index criado automaticamente pelo plugin
  },
  
  // Chave única da configuração (ex: 'email.smtp.host', 'chat.timeout', etc)
  key: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9._-]+$/, 'Key deve conter apenas letras minúsculas, números, pontos, hífens e underscores']
  },
  
  // Valor da configuração (pode ser qualquer tipo)
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Tipo do valor para validação e casting
  valueType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    default: 'string'
  },
  
  // Categoria/grupo da configuração
  category: {
    type: String,
    required: true,
    enum: [
      'general',    // Configurações gerais
      'chat',       // Configurações do chat
      'email',      // Configurações de email
      'notification', // Configurações de notificação
      'integration', // Integrações externas
      'security',   // Segurança
      'appearance', // Aparência/tema
      'workflow',   // Fluxos de trabalho
      'billing',    // Faturamento
      'feature'     // Feature flags
    ],
    default: 'general'
  },
  
  // Descrição da configuração
  description: {
    type: String,
    default: ''
  },
  
  // Se é uma configuração pública (visível para todos) ou privada (apenas admins)
  isPublic: {
    type: Boolean,
    default: false
  },
  
  // Se a configuração é editável via UI ou apenas via API/código
  isEditable: {
    type: Boolean,
    default: true
  },
  
  // Se a configuração está ativa
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Valor padrão (usado quando resetar configurações)
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Validações específicas
  validation: {
    min: Number,      // Para números
    max: Number,      // Para números
    regex: String,    // Para strings
    options: [mongoose.Schema.Types.Mixed] // Valores permitidos (enum)
  },
  
  // Metadados adicionais
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Quem modificou por último
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices compostos para multi-tenancy
// Chave única por tenant
settingSchema.index({ tenantId: 1, key: 1 }, { unique: true });

// Índice para buscar por categoria
settingSchema.index({ tenantId: 1, category: 1 });

// Índice para configurações públicas
settingSchema.index({ tenantId: 1, isPublic: 1, isActive: 1 });

// Métodos de instância
settingSchema.methods.getValue = function() {
  // Retornar o valor com o tipo correto
  switch (this.valueType) {
    case 'number':
      return Number(this.value);
    case 'boolean':
      return Boolean(this.value);
    case 'object':
    case 'array':
      return typeof this.value === 'string' ? JSON.parse(this.value) : this.value;
    default:
      return String(this.value);
  }
};

settingSchema.methods.setValue = function(newValue) {
  // Validar e definir o valor com o tipo correto
  if (this.validation) {
    // Validar min/max para números
    if (this.valueType === 'number' && typeof this.validation.min === 'number' && newValue < this.validation.min) {
      throw new Error(`Valor deve ser maior ou igual a ${this.validation.min}`);
    }
    if (this.valueType === 'number' && typeof this.validation.max === 'number' && newValue > this.validation.max) {
      throw new Error(`Valor deve ser menor ou igual a ${this.validation.max}`);
    }
    
    // Validar regex para strings
    if (this.valueType === 'string' && this.validation.regex) {
      const regex = new RegExp(this.validation.regex);
      if (!regex.test(newValue)) {
        throw new Error(`Valor não corresponde ao padrão esperado`);
      }
    }
    
    // Validar opções permitidas
    if (this.validation.options && this.validation.options.length > 0) {
      if (!this.validation.options.includes(newValue)) {
        throw new Error(`Valor deve ser uma das opções: ${this.validation.options.join(', ')}`);
      }
    }
  }
  
  this.value = newValue;
  this.valueType = this.detectValueType(newValue);
};

settingSchema.methods.detectValueType = function(value) {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'string';
};

settingSchema.methods.resetToDefault = function() {
  if (this.defaultValue !== undefined) {
    this.value = this.defaultValue;
    return true;
  }
  return false;
};

// Métodos estáticos
settingSchema.statics.getSetting = async function(tenantId, key, defaultValue = null) {
  const setting = await this.findOne({ tenantId, key, isActive: true });
  return setting ? setting.getValue() : defaultValue;
};

settingSchema.statics.setSetting = async function(tenantId, key, value, options = {}) {
  const {
    category = 'general',
    description = '',
    userId = null,
    ...otherOptions
  } = options;
  
  let setting = await this.findOne({ tenantId, key });
  
  if (!setting) {
    setting = new this({
      tenantId,
      key,
      category,
      description,
      ...otherOptions
    });
  }
  
  setting.setValue(value);
  setting.lastModifiedBy = userId;
  
  return await setting.save();
};

settingSchema.statics.getSettings = async function(tenantId, category = null, publicOnly = false) {
  const query = { tenantId, isActive: true };
  
  if (category) {
    query.category = category;
  }
  
  if (publicOnly) {
    query.isPublic = true;
  }
  
  const settings = await this.find(query);
  
  // Converter para objeto key-value
  const result = {};
  for (const setting of settings) {
    result[setting.key] = setting.getValue();
  }
  
  return result;
};

// Aplicar plugin de tenant scope
settingSchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('Setting', settingSchema);
