const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Multi-tenant
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  
  // Recipiente da notificação
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Tipo de notificação
  type: {
    type: String,
    required: true,
    enum: [
      'chat_new',           // Nova conversa na fila
      'chat_assigned',      // Chat atribuído a você
      'chat_message',       // Nova mensagem em chat ativo
      'chat_closed',        // Chat encerrado
      'chat_rated',         // Cliente avaliou atendimento
      'chat_transferred',   // Chat transferido
      'chat_waiting_long',  // Chat esperando há muito tempo
      'agent_online',       // Agente ficou online
      'agent_offline',      // Agente ficou offline
      'system_alert',       // Alerta do sistema
      'system_maintenance', // Manutenção programada
      'account_update',     // Atualização de conta
      'payment_success',    // Pagamento realizado
      'payment_failed',     // Falha no pagamento
      'custom'             // Notificação personalizada
    ],
    index: true
  },
  
  // Nível de prioridade
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  
  // Conteúdo da notificação
  title: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  // Dados adicionais (JSON flexível)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Link de ação (onde clicar leva)
  actionUrl: String,
  
  // Ícone customizado
  icon: {
    type: String,
    default: 'bell'
  },
  
  // Cor de destaque
  color: {
    type: String,
    default: '#007bff'
  },
  
  // Status de leitura
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  
  readAt: Date,
  
  // Canais de entrega
  channels: [{
    type: String,
    enum: ['in-app', 'email', 'push', 'sms', 'webhook']
  }],
  
  // Status de entrega por canal
  deliveryStatus: [{
    channel: {
      type: String,
      enum: ['in-app', 'email', 'push', 'sms', 'webhook']
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    failureReason: String,
    attempts: {
      type: Number,
      default: 0
    }
  }],
  
  // Agrupamento de notificações
  groupId: String,
  groupCount: {
    type: Number,
    default: 1
  },
  
  // Expiração
  expiresAt: {
    type: Date,
    index: true
  },
  
  // Se a notificação foi dispensada/arquivada
  dismissed: {
    type: Boolean,
    default: false
  },
  
  dismissedAt: Date,
  
  // Remetente (para notificações de sistema ou de outro usuário)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Referências a outras entidades
  references: {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    }
  }
}, {
  timestamps: true
});

// Índices compostos para queries comuns
notificationSchema.index({ tenantId: 1, recipient: 1, read: 1 });
notificationSchema.index({ tenantId: 1, recipient: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ groupId: 1 });

// TTL para expiração automática
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual para tempo desde criação
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d atrás`;
  if (hours > 0) return `${hours}h atrás`;
  if (minutes > 0) return `${minutes}m atrás`;
  return 'agora';
});

// Método para marcar como lida
notificationSchema.methods.markAsRead = async function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    
    // Atualizar status de entrega in-app
    const inAppDelivery = this.deliveryStatus.find(d => d.channel === 'in-app');
    if (inAppDelivery) {
      inAppDelivery.status = 'read';
    }
    
    await this.save();
  }
  return this;
};

// Método para dispensar/arquivar
notificationSchema.methods.dismiss = async function() {
  if (!this.dismissed) {
    this.dismissed = true;
    this.dismissedAt = new Date();
    await this.save();
  }
  return this;
};

// Método estático para criar notificação com canais baseados em preferências
notificationSchema.statics.createWithUserPreferences = async function(notificationData, userPreferences) {
  const channels = ['in-app']; // Sempre incluir in-app
  
  if (userPreferences) {
    if (userPreferences.emailNotifications && 
        userPreferences.emailTypes?.includes(notificationData.type)) {
      channels.push('email');
    }
    
    if (userPreferences.pushNotifications && 
        userPreferences.pushTypes?.includes(notificationData.type)) {
      channels.push('push');
    }
    
    if (userPreferences.smsNotifications && 
        userPreferences.smsTypes?.includes(notificationData.type) &&
        notificationData.priority === 'urgent') {
      channels.push('sms');
    }
  }
  
  // Criar status de entrega para cada canal
  const deliveryStatus = channels.map(channel => ({
    channel,
    status: 'pending'
  }));
  
  return this.create({
    ...notificationData,
    channels,
    deliveryStatus
  });
};

// Método estático para buscar notificações não lidas
notificationSchema.statics.getUnreadCount = async function(userId, tenantId) {
  return this.countDocuments({
    tenantId,
    recipient: userId,
    read: false,
    dismissed: false
  });
};

// Método estático para agrupar notificações similares
notificationSchema.statics.groupSimilarNotifications = async function(userId, tenantId, type, timeWindow = 3600000) {
  const cutoff = new Date(Date.now() - timeWindow);
  
  const similar = await this.find({
    tenantId,
    recipient: userId,
    type,
    createdAt: { $gte: cutoff },
    groupId: null
  });
  
  if (similar.length > 1) {
    const groupId = new mongoose.Types.ObjectId().toString();
    await this.updateMany(
      { _id: { $in: similar.map(n => n._id) } },
      { 
        $set: { groupId },
        $inc: { groupCount: similar.length - 1 }
      }
    );
  }
};

// Plugin de tenant scope
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');
notificationSchema.plugin(tenantScopePlugin);

// Hooks
notificationSchema.pre('save', function(next) {
  // Auto-expirar notificações antigas (30 dias por padrão)
  if (!this.expiresAt) {
    const expirationDays = this.priority === 'urgent' ? 7 : 30;
    this.expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
