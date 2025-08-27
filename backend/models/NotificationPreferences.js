const mongoose = require('mongoose');

const notificationPreferencesSchema = new mongoose.Schema({
  // Multi-tenant
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  
  // Usuário dono das preferências
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Configurações globais
  enabled: {
    type: Boolean,
    default: true
  },
  
  // Não perturbe
  doNotDisturb: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: String, // "22:00"
    endTime: String,   // "08:00"
    timezone: {
      type: String,
      default: 'America/Sao_Paulo'
    }
  },
  
  // Preferências por canal
  channels: {
    inApp: {
      enabled: {
        type: Boolean,
        default: true
      },
      sound: {
        type: Boolean,
        default: true
      },
      desktop: {
        type: Boolean,
        default: true
      }
    },
    
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        enum: ['instant', 'hourly', 'daily', 'weekly'],
        default: 'instant'
      },
      digest: {
        type: Boolean,
        default: false
      }
    },
    
    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      sound: {
        type: Boolean,
        default: true
      },
      vibration: {
        type: Boolean,
        default: true
      }
    },
    
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      onlyUrgent: {
        type: Boolean,
        default: true
      },
      phoneNumber: String
    },
    
    webhook: {
      enabled: {
        type: Boolean,
        default: false
      },
      url: String,
      secret: String,
      headers: mongoose.Schema.Types.Mixed
    }
  },
  
  // Tipos de notificação permitidos por canal
  types: {
    // Chat relacionado
    chat_new: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    chat_assigned: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    chat_message: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    chat_closed: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false }
    },
    chat_rated: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false }
    },
    chat_transferred: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    chat_waiting_long: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true }
    },
    
    // Agente relacionado
    agent_online: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false }
    },
    agent_offline: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false }
    },
    
    // Sistema
    system_alert: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true }
    },
    system_maintenance: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    
    // Conta
    account_update: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false }
    },
    
    // Pagamento
    payment_success: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    payment_failed: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true }
    }
  },
  
  // Filtros adicionais
  filters: {
    // Apenas notificações de alta prioridade
    onlyHighPriority: {
      type: Boolean,
      default: false
    },
    
    // Palavras-chave para filtrar
    keywords: [String],
    
    // IDs de usuários mutados
    mutedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    
    // IDs de conversas mutadas
    mutedConversations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    }]
  },
  
  // Dispositivos registrados para push
  devices: [{
    type: {
      type: String,
      enum: ['web', 'ios', 'android'],
      required: true
    },
    token: {
      type: String,
      required: true
    },
    name: String,
    model: String,
    os: String,
    appVersion: String,
    active: {
      type: Boolean,
      default: true
    },
    lastUsed: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Estatísticas
  stats: {
    totalReceived: {
      type: Number,
      default: 0
    },
    totalRead: {
      type: Number,
      default: 0
    },
    lastNotificationAt: Date,
    lastReadAt: Date
  }
}, {
  timestamps: true
});

// Índices
notificationPreferencesSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

// Métodos
notificationPreferencesSchema.methods.shouldSendNotification = function(type, channel, priority = 'normal') {
  // Verificar se notificações estão habilitadas
  if (!this.enabled) return false;
  
  // Verificar canal
  if (!this.channels[channel]?.enabled) return false;
  
  // Verificar tipo
  if (!this.types[type]?.[channel]) return false;
  
  // Verificar prioridade
  if (this.filters.onlyHighPriority && priority !== 'high' && priority !== 'urgent') {
    return false;
  }
  
  // Verificar horário de não perturbe
  if (this.doNotDisturb.enabled) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { startTime, endTime } = this.doNotDisturb;
    
    if (startTime && endTime) {
      if (startTime < endTime) {
        // Período no mesmo dia (ex: 09:00 - 18:00)
        if (currentTime >= startTime && currentTime < endTime) return false;
      } else {
        // Período atravessa meia-noite (ex: 22:00 - 08:00)
        if (currentTime >= startTime || currentTime < endTime) return false;
      }
    }
  }
  
  return true;
};

notificationPreferencesSchema.methods.registerDevice = async function(deviceData) {
  // Remover dispositivos duplicados
  this.devices = this.devices.filter(d => 
    !(d.type === deviceData.type && d.token === deviceData.token)
  );
  
  // Adicionar novo dispositivo
  this.devices.push({
    ...deviceData,
    lastUsed: new Date()
  });
  
  // Limitar a 10 dispositivos por usuário
  if (this.devices.length > 10) {
    // Remover os mais antigos
    this.devices.sort((a, b) => b.lastUsed - a.lastUsed);
    this.devices = this.devices.slice(0, 10);
  }
  
  await this.save();
  return this;
};

notificationPreferencesSchema.methods.unregisterDevice = async function(token) {
  this.devices = this.devices.filter(d => d.token !== token);
  await this.save();
  return this;
};

// Método estático para criar preferências padrão
notificationPreferencesSchema.statics.createDefaultPreferences = async function(userId, tenantId, role) {
  const preferences = {
    userId,
    tenantId,
    enabled: true
  };
  
  // Ajustar preferências baseado no role
  if (role === 'client') {
    // Clientes recebem menos notificações por padrão
    preferences.channels = {
      inApp: { enabled: true },
      email: { enabled: true, frequency: 'daily' },
      push: { enabled: false },
      sms: { enabled: false }
    };
  } else if (role === 'agent' || role === 'admin') {
    // Agentes recebem mais notificações
    preferences.channels = {
      inApp: { enabled: true, sound: true, desktop: true },
      email: { enabled: true, frequency: 'instant' },
      push: { enabled: true, sound: true },
      sms: { enabled: false, onlyUrgent: true }
    };
  }
  
  return this.create(preferences);
};

// Plugin de tenant scope
notificationPreferencesSchema.plugin(require('../plugins/tenantPlugin'));

const NotificationPreferences = mongoose.model('NotificationPreferences', notificationPreferencesSchema);

module.exports = NotificationPreferences;
