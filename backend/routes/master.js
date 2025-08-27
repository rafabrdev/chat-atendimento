const express = require('express');
const router = express.Router();
const { auth: protect } = require('../middleware/auth');
const { requireMaster } = require('../middleware/tenantMiddleware');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

// Todas as rotas requerem autenticação e role master
router.use(protect, requireMaster);

/**
 * @swagger
 * /api/master/dashboard:
 *   get:
 *     tags: [Master]
 *     summary: Dashboard do master
 *     description: Retorna estatísticas gerais de todos os tenants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const stats = {
      tenants: {
        total: await Tenant.countDocuments(),
        active: await Tenant.countDocuments({ isActive: true, 'subscription.status': 'active' }),
        trial: await Tenant.countDocuments({ 'subscription.plan': 'trial' }),
        paid: await Tenant.countDocuments({ 
          'subscription.plan': { $in: ['starter', 'professional', 'enterprise'] }
        }),
        suspended: await Tenant.countDocuments({ isSuspended: true })
      },
      revenue: {
        monthly: 0,
        yearly: 0,
        total: 0
      },
      usage: {
        totalUsers: await User.countDocuments({ role: { $ne: 'master' } }),
        totalConversations: await Conversation.countDocuments(),
        totalStorage: 0 // Calcular do S3
      },
      modules: {
        chat: await Tenant.countDocuments({ 'modules.chat.enabled': true }),
        crm: await Tenant.countDocuments({ 'modules.crm.enabled': true }),
        hrm: await Tenant.countDocuments({ 'modules.hrm.enabled': true })
      }
    };

    // Calcular receita
    const tenants = await Tenant.find({ 
      'subscription.status': 'active',
      'subscription.monthlyPrice': { $gt: 0 }
    });

    tenants.forEach(tenant => {
      stats.revenue.monthly += tenant.subscription.monthlyPrice;
      if (tenant.subscription.billingCycle === 'yearly') {
        stats.revenue.yearly += tenant.subscription.monthlyPrice * 12;
      }
    });

    stats.revenue.total = stats.revenue.monthly + stats.revenue.yearly;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/tenants:
 *   get:
 *     tags: [Master]
 *     summary: Listar todos os tenants
 *     description: Retorna lista de todos os tenants com filtros
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, cancelled, expired]
 *       - in: query
 *         name: plan
 *         schema:
 *           type: string
 *           enum: [trial, starter, professional, enterprise]
 *     responses:
 *       200:
 *         description: Lista de tenants
 */
router.get('/tenants', async (req, res) => {
  try {
    const { status, plan, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    
    if (status) {
      query['subscription.status'] = status;
    }
    
    if (plan) {
      query['subscription.plan'] = plan;
    }
    
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    const tenants = await Tenant.find(query)
      .populate('owner', 'name email')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Tenant.countDocuments(query);

    res.json({
      success: true,
      data: tenants,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar tenants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/tenants:
 *   post:
 *     tags: [Master]
 *     summary: Criar novo tenant
 *     description: Cria um novo tenant/empresa
 *     security:
 *       - bearerAuth: []
 */
router.post('/tenants', async (req, res) => {
  try {
    console.log('Criando tenant - req.body:', req.body);
    console.log('Usuario master:', req.user);
    
    const {
      companyName,
      contactEmail,
      ownerData = {},
      plan = 'trial',
      modules = { chat: { enabled: true } }
    } = req.body;
    
    // Validação básica
    if (!companyName) {
      return res.status(400).json({
        success: false,
        error: 'Nome da empresa é obrigatório'
      });
    }
    
    if (!ownerData.name || !ownerData.email || !ownerData.password) {
      return res.status(400).json({
        success: false,
        error: 'Dados do administrador são obrigatórios (nome, email, senha)'
      });
    }

    // Gerar slug único
    const slug = await Tenant.generateSlug(companyName);

    // Primeiro criar o tenant sem owner
    const tenant = new Tenant({
      companyName,
      slug,
      contactEmail,
      modules,
      subscription: {
        plan,
        status: 'active',
        trialEndsAt: plan === 'trial' ? 
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : // 14 dias
          null
      }
    });
    
    await tenant.save();

    // Agora criar o owner/admin com tenantId
    const owner = await User.create({
      name: ownerData.name,
      email: ownerData.email,
      password: ownerData.password,
      role: 'admin',
      company: companyName,
      tenantId: tenant._id,
      createdBy: req.user._id // Master criando o admin
    });

    // Atualizar tenant com owner
    tenant.owner = owner._id;
    await tenant.save();

    res.status(201).json({
      success: true,
      data: {
        tenant,
        owner: {
          _id: owner._id,
          name: owner.name,
          email: owner.email
        }
      }
    });
  } catch (error) {
    console.error('Erro ao criar tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/tenants/{id}:
 *   get:
 *     tags: [Master]
 *     summary: Detalhes do tenant
 *     description: Retorna detalhes completos de um tenant
 *     security:
 *       - bearerAuth: []
 */
router.get('/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate('owner', 'name email');

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    // Buscar estatísticas adicionais
    const stats = {
      users: await User.countDocuments({ tenantId: tenant._id }),
      conversations: await Conversation.countDocuments({ tenantId: tenant._id }),
      activeAgents: await User.countDocuments({ 
        tenantId: tenant._id,
        role: 'agent',
        status: 'online'
      })
    };

    res.json({
      success: true,
      data: {
        ...tenant.toObject(),
        stats
      }
    });
  } catch (error) {
    console.error('Erro ao buscar tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/tenants/{id}:
 *   patch:
 *     tags: [Master]
 *     summary: Atualizar tenant
 *     description: Atualiza configurações de um tenant
 *     security:
 *       - bearerAuth: []
 */
router.patch('/tenants/:id', async (req, res) => {
  try {
    const updates = req.body;
    
    // Campos que não podem ser atualizados diretamente
    delete updates._id;
    delete updates.owner;
    delete updates.createdAt;

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error('Erro ao atualizar tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/tenants/{id}/toggle-module:
 *   post:
 *     tags: [Master]
 *     summary: Ativar/desativar módulo
 *     description: Ativa ou desativa um módulo para o tenant
 *     security:
 *       - bearerAuth: []
 */
router.post('/tenants/:id/toggle-module', async (req, res) => {
  try {
    const { module, enabled } = req.body;
    
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    if (!tenant.modules[module]) {
      return res.status(400).json({
        success: false,
        error: 'Módulo inválido'
      });
    }

    tenant.modules[module].enabled = enabled;
    await tenant.save();

    res.json({
      success: true,
      data: tenant.modules
    });
  } catch (error) {
    console.error('Erro ao toggle módulo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/tenants/{id}/suspend:
 *   post:
 *     tags: [Master]
 *     summary: Suspender tenant
 *     description: Suspende ou reativa um tenant
 *     security:
 *       - bearerAuth: []
 */
router.post('/tenants/:id/suspend', async (req, res) => {
  try {
    const { suspend, reason } = req.body;
    
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    tenant.isSuspended = suspend;
    tenant.suspendedReason = suspend ? reason : null;
    
    if (suspend) {
      tenant.subscription.status = 'suspended';
    } else {
      tenant.subscription.status = 'active';
    }
    
    await tenant.save();

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error('Erro ao suspender tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/tenants/{id}/reset-usage:
 *   post:
 *     tags: [Master]
 *     summary: Resetar uso mensal
 *     description: Reseta contadores de uso mensal do tenant
 *     security:
 *       - bearerAuth: []
 */
router.post('/tenants/:id/reset-usage', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    await tenant.resetMonthlyUsage();

    res.json({
      success: true,
      message: 'Uso resetado com sucesso',
      data: tenant.usage
    });
  } catch (error) {
    console.error('Erro ao resetar uso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/master/impersonate:
 *   post:
 *     tags: [Master]
 *     summary: Impersonar usuário
 *     description: Permite ao master logar como qualquer usuário para suporte
 *     security:
 *       - bearerAuth: []
 */
router.post('/impersonate', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId).populate('tenantId');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Gerar token temporário para o usuário
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId?._id,
        impersonatedBy: req.user._id,
        impersonatedAt: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // Token de impersonação expira em 2 horas
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenant: user.tenantId
        }
      }
    });
  } catch (error) {
    console.error('Erro ao impersonar:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
