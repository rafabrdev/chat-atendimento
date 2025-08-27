const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { conditionalLoadTenant } = require('../middleware/conditionalTenant');
const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const notificationService = require('../services/notificationService');

// Aplicar middlewares
router.use(authMiddleware);
router.use(conditionalLoadTenant);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Listar notificações do usuário
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *     responses:
 *       200:
 *         description: Lista de notificações
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      unread,
      type,
      priority,
      startDate,
      endDate
    } = req.query;

    const query = {
      tenantId: req.tenantId,
      recipient: req.user._id,
      dismissed: false
    };

    // Filtros opcionais
    if (unread !== undefined) {
      query.read = unread === 'true' ? false : true;
    }

    if (type) {
      query.type = type;
    }

    if (priority) {
      query.priority = priority;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query)
    ]);

    // Adicionar contagem de não lidas
    const unreadCount = await notificationService.getUnreadCount(
      req.user._id,
      req.tenantId
    );

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Obter contagem de notificações não lidas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contagem de não lidas
 */
router.get('/unread-count', async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(
      req.user._id,
      req.tenantId
    );

    res.json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marcar notificação como lida
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notificação marcada como lida
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marcar todas as notificações como lidas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todas notificações marcadas como lidas
 */
router.patch('/mark-all-read', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        tenantId: req.tenantId,
        recipient: req.user._id,
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      }
    );

    // Invalidar cache
    const cacheKey = `unread:${req.tenantId}:${req.user._id}`;
    const cacheService = require('../services/cacheService');
    await cacheService.delete(cacheKey);

    res.json({
      success: true,
      updated: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/mark-multiple-read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marcar múltiplas notificações como lidas
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Notificações marcadas como lidas
 */
router.patch('/mark-multiple-read', async (req, res) => {
  try {
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        error: 'notificationIds deve ser um array'
      });
    }

    const result = await notificationService.markMultipleAsRead(
      notificationIds,
      req.user._id
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/dismiss:
 *   patch:
 *     tags: [Notifications]
 *     summary: Dispensar/arquivar notificação
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notificação dispensada
 */
router.patch('/:id/dismiss', async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
      tenantId: req.tenantId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notificação não encontrada'
      });
    }

    await notification.dismiss();

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Obter preferências de notificação
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferências do usuário
 */
router.get('/preferences', async (req, res) => {
  try {
    let preferences = await NotificationPreferences.findOne({
      userId: req.user._id,
      tenantId: req.tenantId
    });

    // Se não existir, criar preferências padrão
    if (!preferences) {
      preferences = await NotificationPreferences.createDefaultPreferences(
        req.user._id,
        req.tenantId,
        req.user.role
      );
    }

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/preferences:
 *   put:
 *     tags: [Notifications]
 *     summary: Atualizar preferências de notificação
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Preferências atualizadas
 */
router.put('/preferences', async (req, res) => {
  try {
    const updates = req.body;

    // Remover campos que não devem ser atualizados
    delete updates._id;
    delete updates.userId;
    delete updates.tenantId;
    delete updates.createdAt;
    delete updates.updatedAt;

    let preferences = await NotificationPreferences.findOneAndUpdate(
      {
        userId: req.user._id,
        tenantId: req.tenantId
      },
      updates,
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    // Invalidar cache
    const cacheKey = `preferences:${req.tenantId}:${req.user._id}`;
    const cacheService = require('../services/cacheService');
    await cacheService.delete(cacheKey);

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/preferences/device:
 *   post:
 *     tags: [Notifications]
 *     summary: Registrar dispositivo para push notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [web, ios, android]
 *               token:
 *                 type: string
 *               name:
 *                 type: string
 *               model:
 *                 type: string
 *               os:
 *                 type: string
 *               appVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispositivo registrado
 */
router.post('/preferences/device', async (req, res) => {
  try {
    const deviceData = req.body;

    if (!deviceData.type || !deviceData.token) {
      return res.status(400).json({
        success: false,
        error: 'type e token são obrigatórios'
      });
    }

    let preferences = await NotificationPreferences.findOne({
      userId: req.user._id,
      tenantId: req.tenantId
    });

    if (!preferences) {
      preferences = await NotificationPreferences.createDefaultPreferences(
        req.user._id,
        req.tenantId,
        req.user.role
      );
    }

    await preferences.registerDevice(deviceData);

    res.json({
      success: true,
      message: 'Dispositivo registrado com sucesso'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/preferences/device/{token}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Remover dispositivo registrado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dispositivo removido
 */
router.delete('/preferences/device/:token', async (req, res) => {
  try {
    const preferences = await NotificationPreferences.findOne({
      userId: req.user._id,
      tenantId: req.tenantId
    });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: 'Preferências não encontradas'
      });
    }

    await preferences.unregisterDevice(req.params.token);

    res.json({
      success: true,
      message: 'Dispositivo removido com sucesso'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     tags: [Notifications]
 *     summary: Enviar notificação de teste
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [in-app, email, push, sms]
 *     responses:
 *       200:
 *         description: Notificação de teste enviada
 */
router.post('/test', async (req, res) => {
  try {
    const { channel } = req.body;

    const notification = await notificationService.notify(req.user._id, {
      tenantId: req.tenantId,
      type: 'custom',
      priority: 'normal',
      title: 'Notificação de Teste',
      message: `Esta é uma notificação de teste via ${channel || 'todos os canais'}`,
      data: {
        test: true,
        timestamp: new Date()
      },
      icon: 'bell',
      color: '#17a2b8'
    });

    res.json({
      success: true,
      message: 'Notificação de teste enviada',
      notification
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
