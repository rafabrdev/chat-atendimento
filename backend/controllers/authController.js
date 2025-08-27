const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { generateToken, generateRefreshToken } = require('../middleware/jwtAuth');
const { setTenantContext } = require('../utils/tenantContext');

// @desc    Registrar usuário
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, company, role, profile } = req.body;

    // Validar campos obrigatórios
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Empresa é obrigatória'
      });
    }

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }

  // Para novos usuários (exceto master), criar ou buscar tenant
    let tenantId = null;
    if (role !== 'master') {
      // Buscar tenant padrão ou criar um novo baseado na empresa
      let tenant = await Tenant.findOne({ slug: 'default' });
      
      if (!tenant) {
        // Criar tenant para a empresa
        const slug = await Tenant.generateSlug(company);
        tenant = await Tenant.create({
          companyName: company,
          slug: slug,
          contactEmail: email,
          subscription: {
            plan: 'trial',
            status: 'active',
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
          },
          modules: {
            chat: { enabled: true }
          }
        });
      }
      
      tenantId = tenant._id;
    }

    // Criar usuário
    const user = await User.create({
      name,
      email,
      password,
      company,
      role: role || 'client',
      profile: profile || {},
      tenantId: tenantId,
      createdBy: req.user?._id || null // Se for criado por outro usuário
    });

    // Popular tenantId para incluir no token
    await user.populate('tenantId', 'slug companyName');
    
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: user.toJSON(),
        token,
        refreshToken,
        tenant: user.tenantId
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login usuário
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar campos obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }

    // Buscar usuário (incluindo senha para comparação) e popular tenant
    const user = await User.findOne({ email })
      .select('+password')
      .populate('tenantId', 'slug companyName isActive subscription');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar se conta está ativa
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }
    
    // Para usuários não-master, verificar tenant
    if (user.role !== 'master' && user.tenantId) {
      if (!user.tenantId.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tenant inativo'
        });
      }
      
      if (user.tenantId.subscription?.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Assinatura suspensa'
        });
      }
    }

    // Atualizar último login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: user.toJSON(), // Remove password
        token,
        refreshToken,
        tenant: user.tenantId
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter perfil do usuário logado
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Atualizar perfil do usuário
// @route   PATCH /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, profile } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name) updateData.name = name;
    if (profile) updateData.profile = { ...req.user.profile, ...profile };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Alterar senha
// @route   PATCH /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    
    // Verificar senha atual
    const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Atualizar senha
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};
