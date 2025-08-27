/**
 * Serviço de Notificações
 * 
 * Gerencia o envio de notificações por múltiplos canais
 * com suporte a preferências de usuário e cache
 */

const EventEmitter = require('events');
const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const User = require('../models/User');
const cacheService = require('./cacheService');
const emailService = require('./emailService');

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.io = null; // Socket.IO instance será injetada
    this.pushProviders = new Map(); // Provedores de push notification
    this.smsProvider = null; // Provedor de SMS
    this.webhookQueue = []; // Fila de webhooks
    this.stats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      read: 0
    };
  }

  /**
   * Inicializa o serviço com Socket.IO
   */
  initialize(io) {
    this.io = io;
    console.log('✅ NotificationService initialized with Socket.IO');
  }

  /**
   * Envia notificação para um usuário
   */
  async notify(recipientId, notificationData, options = {}) {
    try {
      // Buscar preferências do usuário (com cache)
      const preferences = await this.getUserPreferences(recipientId, notificationData.tenantId);
      
      // Verificar se deve enviar notificação
      if (!preferences || !preferences.enabled) {
        console.log(`Notificações desabilitadas para usuário ${recipientId}`);
        return null;
      }

      // Determinar canais baseado nas preferências
      const channels = this.determineChannels(notificationData.type, notificationData.priority, preferences);
      
      if (channels.length === 0) {
        console.log(`Nenhum canal habilitado para notificação tipo ${notificationData.type}`);
        return null;
      }

      // Criar notificação no banco
      const notification = await Notification.create({
        ...notificationData,
        recipient: recipientId,
        channels,
        deliveryStatus: channels.map(channel => ({
          channel,
          status: 'pending'
        }))
      });

      // Enviar por cada canal
      for (const channel of channels) {
        await this.sendToChannel(notification, channel, preferences);
      }

      // Atualizar estatísticas do usuário
      await this.updateUserStats(recipientId, notificationData.tenantId);

      // Emitir evento
      this.emit('notification:sent', {
        notificationId: notification._id,
        recipient: recipientId,
        type: notificationData.type,
        channels
      });

      this.stats.sent++;
      return notification;

    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      this.stats.failed++;
      throw error;
    }
  }

  /**
   * Envia notificação para múltiplos usuários
   */
  async notifyMultiple(recipientIds, notificationData, options = {}) {
    const results = await Promise.allSettled(
      recipientIds.map(recipientId => 
        this.notify(recipientId, {
          ...notificationData,
          // Evitar duplicação se já tem recipiente
          recipient: undefined
        }, options)
      )
    );

    return {
      sent: results.filter(r => r.status === 'fulfilled').map(r => r.value),
      failed: results.filter(r => r.status === 'rejected').map(r => r.reason)
    };
  }

  /**
   * Envia notificação por canal específico
   */
  async sendToChannel(notification, channel, preferences) {
    const deliveryStatus = notification.deliveryStatus.find(d => d.channel === channel);
    
    try {
      deliveryStatus.sentAt = new Date();
      deliveryStatus.attempts++;

      switch (channel) {
        case 'in-app':
          await this.sendInApp(notification, preferences);
          break;
        case 'email':
          await this.sendEmail(notification, preferences);
          break;
        case 'push':
          await this.sendPush(notification, preferences);
          break;
        case 'sms':
          await this.sendSMS(notification, preferences);
          break;
        case 'webhook':
          await this.sendWebhook(notification, preferences);
          break;
      }

      deliveryStatus.status = 'sent';
      deliveryStatus.deliveredAt = new Date();
      this.stats.delivered++;

    } catch (error) {
      deliveryStatus.status = 'failed';
      deliveryStatus.failureReason = error.message;
      console.error(`Erro ao enviar notificação por ${channel}:`, error);
      
      // Retry logic
      if (deliveryStatus.attempts < 3) {
        setTimeout(() => this.sendToChannel(notification, channel, preferences), 5000 * deliveryStatus.attempts);
      }
    }

    await notification.save();
  }

  /**
   * Envia notificação in-app via Socket.IO
   */
  async sendInApp(notification, preferences) {
    if (!this.io) {
      throw new Error('Socket.IO não inicializado');
    }

    // Buscar dados completos da notificação
    await notification.populate('sender', 'name email avatar');

    // Preparar payload
    const payload = {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
      icon: notification.icon,
      color: notification.color,
      priority: notification.priority,
      sender: notification.sender,
      createdAt: notification.createdAt,
      timeAgo: notification.timeAgo
    };

    // Emitir para o usuário específico no tenant
    const userRoom = `tenant:${notification.tenantId}:user:${notification.recipient}`;
    this.io.to(userRoom).emit('notification', payload);

    // Se desktop notification está habilitado
    if (preferences?.channels?.inApp?.desktop) {
      this.io.to(userRoom).emit('notification:desktop', {
        title: notification.title,
        body: notification.message,
        icon: notification.icon,
        tag: notification._id.toString(),
        requireInteraction: notification.priority === 'urgent'
      });
    }

    // Se som está habilitado
    if (preferences?.channels?.inApp?.sound) {
      this.io.to(userRoom).emit('notification:sound', {
        type: notification.priority === 'urgent' ? 'urgent' : 'default'
      });
    }

    console.log(`📨 Notificação in-app enviada para ${userRoom}`);
  }

  /**
   * Envia notificação por email
   */
  async sendEmail(notification, preferences) {
    // Verificar frequência de email
    const frequency = preferences?.channels?.email?.frequency || 'instant';
    
    if (frequency !== 'instant') {
      // Adicionar à fila de digest
      await this.addToEmailDigest(notification, frequency);
      return;
    }

    // Buscar dados do recipiente
    const recipient = await User.findById(notification.recipient);
    if (!recipient?.email) {
      throw new Error('Email do recipiente não encontrado');
    }

    // Template de email baseado no tipo
    const emailTemplate = this.getEmailTemplate(notification.type);
    
    await emailService.sendEmail({
      to: recipient.email,
      subject: notification.title,
      template: emailTemplate,
      data: {
        userName: recipient.name,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        ...notification.data
      }
    });

    console.log(`📧 Email enviado para ${recipient.email}`);
  }

  /**
   * Envia push notification
   */
  async sendPush(notification, preferences) {
    const devices = preferences?.devices?.filter(d => d.active) || [];
    
    if (devices.length === 0) {
      throw new Error('Nenhum dispositivo registrado para push');
    }

    for (const device of devices) {
      const provider = this.pushProviders.get(device.type);
      if (!provider) {
        console.warn(`Provider não configurado para ${device.type}`);
        continue;
      }

      try {
        await provider.send({
          token: device.token,
          title: notification.title,
          body: notification.message,
          data: notification.data,
          badge: await this.getUnreadCount(notification.recipient, notification.tenantId),
          sound: preferences?.channels?.push?.sound ? 'default' : null
        });

        // Atualizar lastUsed do dispositivo
        device.lastUsed = new Date();
        await preferences.save();

      } catch (error) {
        console.error(`Erro ao enviar push para dispositivo ${device.token}:`, error);
        
        // Desativar dispositivo se token inválido
        if (error.code === 'messaging/invalid-registration-token') {
          device.active = false;
          await preferences.save();
        }
      }
    }
  }

  /**
   * Envia SMS
   */
  async sendSMS(notification, preferences) {
    if (!this.smsProvider) {
      throw new Error('Provider de SMS não configurado');
    }

    const phoneNumber = preferences?.channels?.sms?.phoneNumber;
    if (!phoneNumber) {
      throw new Error('Número de telefone não configurado');
    }

    // SMS apenas para notificações urgentes
    if (notification.priority !== 'urgent' && preferences?.channels?.sms?.onlyUrgent) {
      return;
    }

    await this.smsProvider.send({
      to: phoneNumber,
      message: `${notification.title}: ${notification.message}`.substring(0, 160)
    });

    console.log(`📱 SMS enviado para ${phoneNumber}`);
  }

  /**
   * Envia webhook
   */
  async sendWebhook(notification, preferences) {
    const webhookConfig = preferences?.channels?.webhook;
    if (!webhookConfig?.url) {
      throw new Error('Webhook URL não configurada');
    }

    const payload = {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      timestamp: notification.createdAt
    };

    // Adicionar assinatura se configurada
    const headers = {
      'Content-Type': 'application/json',
      ...webhookConfig.headers
    };

    if (webhookConfig.secret) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', webhookConfig.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    const axios = require('axios');
    await axios.post(webhookConfig.url, payload, { headers });

    console.log(`🔗 Webhook enviado para ${webhookConfig.url}`);
  }

  /**
   * Busca preferências do usuário com cache
   */
  async getUserPreferences(userId, tenantId) {
    const cacheKey = `preferences:${tenantId}:${userId}`;
    
    // Tentar buscar do cache
    let preferences = await cacheService.get(cacheKey);
    
    if (!preferences) {
      // Buscar do banco
      preferences = await NotificationPreferences.findOne({
        userId,
        tenantId
      });
      
      // Se não existir, criar preferências padrão
      if (!preferences) {
        const user = await User.findById(userId);
        preferences = await NotificationPreferences.createDefaultPreferences(
          userId,
          tenantId,
          user?.role || 'client'
        );
      }
      
      // Cachear por 5 minutos
      await cacheService.set(cacheKey, preferences.toObject(), 300);
    }
    
    return preferences;
  }

  /**
   * Determina canais baseado nas preferências
   */
  determineChannels(type, priority, preferences) {
    const channels = [];
    
    ['inApp', 'email', 'push', 'sms', 'webhook'].forEach(channel => {
      if (preferences.shouldSendNotification(type, channel, priority)) {
        channels.push(channel === 'inApp' ? 'in-app' : channel);
      }
    });
    
    return channels;
  }

  /**
   * Obtém template de email baseado no tipo
   */
  getEmailTemplate(type) {
    const templates = {
      chat_new: 'new-chat',
      chat_assigned: 'chat-assigned',
      chat_message: 'new-message',
      chat_closed: 'chat-closed',
      chat_rated: 'chat-rated',
      payment_success: 'payment-success',
      payment_failed: 'payment-failed',
      system_alert: 'system-alert'
    };
    
    return templates[type] || 'default';
  }

  /**
   * Adiciona notificação ao digest de email
   */
  async addToEmailDigest(notification, frequency) {
    const digestKey = `digest:${notification.tenantId}:${notification.recipient}:${frequency}`;
    const digest = await cacheService.get(digestKey) || [];
    
    digest.push({
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt
    });
    
    // TTL baseado na frequência
    const ttl = {
      hourly: 3600,
      daily: 86400,
      weekly: 604800
    }[frequency] || 86400;
    
    await cacheService.set(digestKey, digest, ttl);
  }

  /**
   * Processa e envia digests de email
   */
  async processEmailDigests() {
    // Implementar lógica de processamento de digests
    // Pode ser executado via cron job
  }

  /**
   * Obtém contagem de notificações não lidas
   */
  async getUnreadCount(userId, tenantId) {
    const cacheKey = `unread:${tenantId}:${userId}`;
    let count = await cacheService.get(cacheKey);
    
    if (count === null) {
      count = await Notification.getUnreadCount(userId, tenantId);
      await cacheService.set(cacheKey, count, 60); // Cache por 1 minuto
    }
    
    return count;
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: userId
    });
    
    if (!notification) {
      throw new Error('Notificação não encontrada');
    }
    
    await notification.markAsRead();
    
    // Invalidar cache de contagem
    const cacheKey = `unread:${notification.tenantId}:${userId}`;
    await cacheService.delete(cacheKey);
    
    // Emitir evento via Socket.IO
    if (this.io) {
      const userRoom = `tenant:${notification.tenantId}:user:${userId}`;
      this.io.to(userRoom).emit('notification:read', {
        notificationId,
        unreadCount: await this.getUnreadCount(userId, notification.tenantId)
      });
    }
    
    this.stats.read++;
    return notification;
  }

  /**
   * Marca múltiplas notificações como lidas
   */
  async markMultipleAsRead(notificationIds, userId) {
    const results = await Promise.allSettled(
      notificationIds.map(id => this.markAsRead(id, userId))
    );
    
    return {
      success: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }

  /**
   * Atualiza estatísticas do usuário
   */
  async updateUserStats(userId, tenantId) {
    await NotificationPreferences.findOneAndUpdate(
      { userId, tenantId },
      {
        $inc: { 'stats.totalReceived': 1 },
        $set: { 'stats.lastNotificationAt': new Date() }
      }
    );
  }

  /**
   * Obtém estatísticas do serviço
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  /**
   * Registra provider de push notification
   */
  registerPushProvider(type, provider) {
    this.pushProviders.set(type, provider);
    console.log(`📱 Push provider registrado para ${type}`);
  }

  /**
   * Registra provider de SMS
   */
  registerSMSProvider(provider) {
    this.smsProvider = provider;
    console.log(`📱 SMS provider registrado`);
  }
}

// Singleton
module.exports = new NotificationService();
