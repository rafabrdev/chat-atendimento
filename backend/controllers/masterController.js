const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Dashboard Master - Visão geral do sistema
 */
exports.getMasterDashboard = async (req, res) => {
  try {
    // Estatísticas de Tenants
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      paidTenants,
      suspendedTenants
    ] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ isActive: true, 'subscription.status': 'active' }),
      Tenant.countDocuments({ 'subscription.plan': 'trial' }),
      Tenant.countDocuments({ 
        'subscription.plan': { $in: ['starter', 'professional', 'enterprise'] }
      }),
      Tenant.countDocuments({ isSuspended: true })
    ]);

    // Estatísticas de Usuários
    const [
      totalUsers,
      totalAdmins,
      totalAgents,
      totalClients
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'master' } }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'client' })
    ]);

    // Estatísticas de Uso
    const [
      totalConversations,
      activeConversations,
      totalMessages
    ] = await Promise.all([
      Conversation.countDocuments(),
      Conversation.countDocuments({ status: 'active' }),
      Message.countDocuments()
    ]);

    // Calcular Receita
    const tenants = await Tenant.find({ 
      'subscription.status': 'active',
      'subscription.monthlyPrice': { $gt: 0 }
    });

    let monthlyRevenue = 0;
    let yearlyRevenue = 0;
    
    tenants.forEach(tenant => {
      if (tenant.subscription.billingCycle === 'monthly') {
        monthlyRevenue += tenant.subscription.monthlyPrice;
      } else if (tenant.subscription.billingCycle === 'yearly') {
        yearlyRevenue += tenant.subscription.monthlyPrice * 12;
      }
    });

    // Crescimento mensal
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newTenantsThisMonth = await Tenant.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Top Empresas por uso
    const topTenants = await Tenant.find()
      .sort('-stats.totalConversations')
      .limit(5)
      .select('companyName slug subscription.plan stats');

    res.json({
      success: true,
      data: {
        overview: {
          totalTenants,
          activeTenants,
          trialTenants,
          paidTenants,
          suspendedTenants,
          newTenantsThisMonth
        },
        users: {
          total: totalUsers,
          admins: totalAdmins,
          agents: totalAgents,
          clients: totalClients
        },
        usage: {
          conversations: totalConversations,
          activeConversations,
          messages: totalMessages
        },
        revenue: {
          monthly: monthlyRevenue,
          yearly: yearlyRevenue,
          total: monthlyRevenue + yearlyRevenue,
          mrr: monthlyRevenue + (yearlyRevenue / 12) // Monthly Recurring Revenue
        },
        topTenants,
        charts: {
          // Dados para gráficos
          tenantsGrowth: await this.getTenantsGrowthData(),
          revenueGrowth: await this.getRevenueGrowthData(),
          usageByPlan: await this.getUsageByPlanData()
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard master:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do dashboard',
      error: error.message
    });
  }
};

/**
 * Listar todas as empresas/tenants
 */
exports.listTenants = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      plan,
      sortBy = '-createdAt'
    } = req.query;

    const query = {};

    // Filtros
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      if (status === 'suspended') {
        query.isSuspended = true;
      } else {
        query['subscription.status'] = status;
      }
    }

    if (plan) {
      query['subscription.plan'] = plan;
    }

    const tenants = await Tenant.find(query)
      .populate('owner', 'name email')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Tenant.countDocuments(query);

    // Adicionar estatísticas para cada tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const [users, agents, conversations] = await Promise.all([
          User.countDocuments({ tenantId: tenant._id }),
          User.countDocuments({ tenantId: tenant._id, role: 'agent' }),
          Conversation.countDocuments({ tenantId: tenant._id })
        ]);

        return {
          ...tenant.toObject(),
          stats: {
            users,
            agents,
            conversations
          }
        };
      })
    );

    res.json({
      success: true,
      data: tenantsWithStats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar empresas',
      error: error.message
    });
  }
};

/**
 * Criar nova empresa e admin
 */
exports.createTenant = async (req, res) => {
  try {
    const {
      companyName,
      contactEmail,
      contactPhone,
      adminName,
      adminEmail,
      adminPassword,
      plan = 'trial',
      modules = { 
        chat: { enabled: true }
      },
      customSettings = {}
    } = req.body;

    // Validações
    if (!companyName || !adminEmail || !adminName) {
      return res.status(400).json({
        success: false,
        message: 'Dados obrigatórios faltando'
      });
    }

    // Verificar se email já existe
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email do admin já está em uso'
      });
    }

    // Gerar slug único
    const slug = await Tenant.generateSlug(companyName);

    // Gerar senha se não fornecida
    const password = adminPassword || crypto.randomBytes(8).toString('hex');

    // Criar admin da empresa
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password,
      role: 'admin',
      company: companyName,
      createdBy: req.user._id // Master que criou
    });

    // Criar tenant
    const tenant = await Tenant.create({
      companyName,
      slug,
      contactEmail: contactEmail || adminEmail,
      contactPhone,
      owner: admin._id,
      modules,
      subscription: {
        plan,
        status: 'active',
        trialEndsAt: plan === 'trial' 
          ? new Date(Date.now() + parseInt(process.env.DEFAULT_TENANT_TRIAL_DAYS || 14) * 24 * 60 * 60 * 1000)
          : null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      settings: {
        ...customSettings,
        timezone: customSettings.timezone || 'America/Sao_Paulo',
        language: customSettings.language || 'pt-BR',
        currency: customSettings.currency || 'BRL'
      }
    });

    // Atualizar admin com tenantId
    admin.tenantId = tenant._id;
    await admin.save();

    // Enviar email de boas-vindas
    try {
      await emailService.sendAdminCreatedByMaster(admin, tenant, password);
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
      // Não falhar a criação se o email falhar
    }

    // Notificar master sobre nova empresa
    try {
      await emailService.sendMasterNotification('new-tenant-created', {
        companyName,
        adminName,
        adminEmail,
        plan,
        createdBy: 'Master Dashboard'
      });
    } catch (notifyError) {
      console.error('Erro ao notificar master:', notifyError);
    }

    res.status(201).json({
      success: true,
      message: 'Empresa e admin criados com sucesso',
      data: {
        tenant: {
          _id: tenant._id,
          companyName: tenant.companyName,
          slug: tenant.slug,
          contactEmail: tenant.contactEmail
        },
        admin: {
          _id: admin._id,
          name: admin.name,
          email: admin.email
        },
        credentials: {
          email: adminEmail,
          password,
          loginUrl: emailService.generateTenantUrls(tenant).loginUrl
        }
      }
    });
  } catch (error) {
    console.error('Erro ao criar tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar empresa',
      error: error.message
    });
  }
};

/**
 * Atualizar empresa
 */
exports.updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Campos protegidos
    delete updates._id;
    delete updates.owner;
    delete updates.createdAt;
    delete updates.slug; // Slug não deve mudar

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Empresa não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Empresa atualizada com sucesso',
      data: tenant
    });
  } catch (error) {
    console.error('Erro ao atualizar tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar empresa',
      error: error.message
    });
  }
};

/**
 * Suspender ou reativar empresa
 */
exports.toggleTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { suspend, reason } = req.body;

    const tenant = await Tenant.findById(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Empresa não encontrada'
      });
    }

    tenant.isSuspended = suspend;
    tenant.suspendedReason = suspend ? reason : null;
    
    if (suspend) {
      tenant.subscription.status = 'suspended';
      tenant.isActive = false;
    } else {
      tenant.subscription.status = 'active';
      tenant.isActive = true;
    }
    
    await tenant.save();

    // Notificar admin da empresa
    const admin = await User.findById(tenant.owner);
    if (admin && admin.email) {
      // TODO: Implementar template de email de suspensão
    }

    res.json({
      success: true,
      message: `Empresa ${suspend ? 'suspensa' : 'reativada'} com sucesso`,
      data: tenant
    });
  } catch (error) {
    console.error('Erro ao alterar status do tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar status da empresa',
      error: error.message
    });
  }
};

/**
 * Listar admins de todas as empresas
 */
exports.listAllAdmins = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      tenantId
    } = req.query;

    const query = { role: 'admin' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const admins = await User.find(query)
      .populate('tenantId', 'companyName slug subscription.plan')
      .select('-password')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: admins,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar admins:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar administradores',
      error: error.message
    });
  }
};

/**
 * Criar admin para empresa existente
 */
exports.createAdminForTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const {
      name,
      email,
      password
    } = req.body;

    // Verificar se tenant existe
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Empresa não encontrada'
      });
    }

    // Verificar se email já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já está em uso'
      });
    }

    // Gerar senha se não fornecida
    const adminPassword = password || crypto.randomBytes(8).toString('hex');

    // Criar admin
    const admin = await User.create({
      name,
      email,
      password: adminPassword,
      role: 'admin',
      company: tenant.companyName,
      tenantId: tenant._id,
      createdBy: req.user._id
    });

    // Enviar email de boas-vindas
    try {
      await emailService.sendAdminCreatedByMaster(admin, tenant, adminPassword);
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Admin criado com sucesso',
      data: {
        admin: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        },
        credentials: {
          email,
          password: adminPassword
        }
      }
    });
  } catch (error) {
    console.error('Erro ao criar admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar administrador',
      error: error.message
    });
  }
};

/**
 * Atualizar admin
 */
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, isActive } = req.body;

    const admin = await User.findById(id);
    
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Administrador não encontrado'
      });
    }

    // Atualizar campos permitidos
    if (name) admin.name = name;
    if (email && email !== admin.email) {
      // Verificar se novo email já existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email já está em uso'
        });
      }
      admin.email = email;
    }
    if (typeof isActive === 'boolean') {
      admin.isActive = isActive;
    }

    await admin.save();

    res.json({
      success: true,
      message: 'Admin atualizado com sucesso',
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar administrador',
      error: error.message
    });
  }
};

/**
 * Resetar senha de admin
 */
exports.resetAdminPassword = async (req, res) => {
  try {
    const { id } = req.params;
    
    const admin = await User.findById(id);
    
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Administrador não encontrado'
      });
    }

    // Gerar nova senha
    const newPassword = crypto.randomBytes(8).toString('hex');
    admin.password = newPassword;
    await admin.save();

    // Buscar tenant
    const tenant = await Tenant.findById(admin.tenantId);

    // Enviar email com nova senha
    try {
      // TODO: Implementar template de reset de senha
      await emailService.sendEmail({
        to: admin.email,
        subject: 'Sua senha foi resetada',
        text: `Sua nova senha é: ${newPassword}`,
        html: `<p>Sua nova senha é: <strong>${newPassword}</strong></p>`
      });
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
    }

    res.json({
      success: true,
      message: 'Senha resetada com sucesso',
      data: {
        email: admin.email,
        newPassword
      }
    });
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao resetar senha',
      error: error.message
    });
  }
};

/**
 * Deletar admin (soft delete)
 */
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const admin = await User.findById(id);
    
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Administrador não encontrado'
      });
    }

    // Verificar se é o único admin da empresa
    const tenant = await Tenant.findById(admin.tenantId);
    if (tenant && tenant.owner.toString() === admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar o admin principal da empresa'
      });
    }

    // Soft delete
    admin.isActive = false;
    admin.deletedAt = new Date();
    admin.deletedBy = req.user._id;
    await admin.save();

    res.json({
      success: true,
      message: 'Admin desativado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar administrador',
      error: error.message
    });
  }
};

/**
 * Helpers para gráficos do dashboard
 */
exports.getTenantsGrowthData = async function() {
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  
  const growth = await Tenant.aggregate([
    {
      $match: {
        createdAt: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  return growth;
};

exports.getRevenueGrowthData = async function() {
  // Implementar agregação de receita mensal
  return [];
};

exports.getUsageByPlanData = async function() {
  const usage = await Tenant.aggregate([
    {
      $group: {
        _id: '$subscription.plan',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return usage;
};
