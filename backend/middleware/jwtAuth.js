/**
 * Middleware de Autenticação JWT com Multi-Tenancy
 * 
 * Este middleware:
 * - Valida tokens JWT
 * - Extrai e valida tenantId
 * - Configura contexto de tenant para requisição
 * - Suporta diferentes níveis de acesso
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { setTenantContext } = require('../utils/tenantContext');

/**
 * Middleware principal de autenticação JWT
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Extrair token do header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);

    // Verificar e decodificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Token inválido',
          code: 'INVALID_TOKEN'
        });
      }
      throw error;
    }

    // Buscar usuário completo
    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('tenantId', 'slug companyName isActive subscription modules limits');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificar se usuário está ativo
    if (!user.isActive && !user.active) {
      return res.status(401).json({
        success: false,
        error: 'Conta desativada',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Para usuários não-master, validar tenant
    if (user.role !== 'master') {
      // Garantir que usuário tem tenantId
      const userTenantId = user.tenantId?._id || user.tenantId || decoded.tenantId;
      
      if (!userTenantId) {
        // Suporte para tokens legacy (sem tenantId)
        if (!decoded.tokenVersion || decoded.tokenVersion < 2) {
          // Token legacy - buscar tenant padrão do usuário
          console.log(`[Auth] Legacy token detected for user ${user.email}`);
          
          // Se usuário tem tenantId no banco mas não no token, usar do banco
          if (user.tenantId) {
            console.log(`[Auth] Using tenant from database for legacy token`);
          } else {
            // Usuário sem tenant - período de migração
            if (process.env.ALLOW_LEGACY_TOKENS === 'true') {
              console.warn(`[Auth] User ${user.email} without tenant - migration mode`);
              // Continuar sem tenant por enquanto
            } else {
              return res.status(403).json({
                success: false,
                error: 'Token inválido. Por favor, faça login novamente.',
                code: 'LEGACY_TOKEN_EXPIRED'
              });
            }
          }
        } else {
          // Token novo mas sem tenant
          return res.status(403).json({
            success: false,
            error: 'Usuário sem tenant associado',
            code: 'NO_TENANT'
          });
        }
      }
      
      // Validar tenant mismatch para tokens novos
      if (decoded.tokenVersion >= 2 && decoded.tenantId) {
        const tokenTenantId = decoded.tenantId.toString();
        const actualTenantId = (user.tenantId?._id || user.tenantId || '').toString();
        
        if (tokenTenantId && actualTenantId && tokenTenantId !== actualTenantId) {
          console.error(`[Auth] Tenant mismatch! Token: ${tokenTenantId}, User: ${actualTenantId}`);
          return res.status(403).json({
            success: false,
            error: 'Token inválido para este tenant',
            code: 'TENANT_MISMATCH'
          });
        }
      }

      // Se tenantId é string (não populado), buscar tenant
      let tenant = user.tenantId;
      if (typeof tenant === 'string' || !tenant.companyName) {
        tenant = await Tenant.findById(userTenantId);
        if (!tenant) {
          return res.status(403).json({
            success: false,
            error: 'Tenant não encontrado',
            code: 'TENANT_NOT_FOUND'
          });
        }
      }

      // Verificar se tenant está ativo
      if (!tenant.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Tenant inativo',
          code: 'TENANT_INACTIVE'
        });
      }

      // Verificar status da assinatura
      if (tenant.subscription?.status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'Assinatura suspensa',
          code: 'SUBSCRIPTION_SUSPENDED'
        });
      }

      if (tenant.subscription?.status === 'expired') {
        return res.status(403).json({
          success: false,
          error: 'Assinatura expirada',
          code: 'SUBSCRIPTION_EXPIRED'
        });
      }

      // Adicionar tenant completo ao user object
      user.tenant = tenant;
      
      // Configurar contexto de tenant para a requisição
      setTenantContext(req, tenant._id.toString());
    }

    // Adicionar informações à requisição
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    
    // Para usuários com tenant, adicionar tenantId direto
    if (user.tenantId) {
      req.tenantId = user.tenantId._id || user.tenantId;
    }
    
    // Adicionar dados do token decodificado
    req.tokenData = decoded;
    
    // Log para auditoria (opcional)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth] User: ${user.email} (${user.role}) - Tenant: ${user.tenant?.companyName || 'N/A'}`);
    }
    
    next();
  } catch (error) {
    console.error('JWT Auth Error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro na autenticação',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware para verificar roles específicas
 * @param {...string} allowedRoles - Roles permitidas
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    // Master tem acesso total
    if (req.user.role === 'master') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Requer role: ${allowedRoles.join(' ou ')}`,
        code: 'INSUFFICIENT_PERMISSION'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se usuário pertence ao mesmo tenant do recurso
 */
const requireSameTenant = (tenantIdParam = 'tenantId') => {
  return async (req, res, next) => {
    // Master pode acessar qualquer tenant
    if (req.user.role === 'master') {
      return next();
    }

    // Obter tenantId do recurso (pode vir de params, body ou query)
    const resourceTenantId = req.params[tenantIdParam] || 
                            req.body[tenantIdParam] || 
                            req.query[tenantIdParam];

    if (!resourceTenantId) {
      return res.status(400).json({
        success: false,
        error: 'TenantId do recurso não especificado',
        code: 'NO_RESOURCE_TENANT'
      });
    }

    const userTenantId = (req.user.tenantId?._id || req.user.tenantId || '').toString();
    
    if (resourceTenantId.toString() !== userTenantId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a recursos de outro tenant',
        code: 'CROSS_TENANT_ACCESS'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar limites do plano
 */
const checkPlanLimit = (limitType) => {
  return async (req, res, next) => {
    // Master não tem limites
    if (req.user.role === 'master') {
      return next();
    }

    const tenant = req.user.tenant || req.user.tenantId;
    
    if (!tenant || !tenant.limits) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de limites não encontrada',
        code: 'LIMITS_NOT_CONFIGURED'
      });
    }

    const currentUsage = tenant.usage?.[limitType] || 0;
    const limit = tenant.limits[limitType];

    if (currentUsage >= limit) {
      return res.status(403).json({
        success: false,
        error: `Limite de ${limitType} atingido (${currentUsage}/${limit})`,
        code: 'PLAN_LIMIT_REACHED',
        details: {
          type: limitType,
          current: currentUsage,
          limit: limit
        }
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se módulo está habilitado
 */
const requireModule = (moduleName) => {
  return (req, res, next) => {
    // Master tem acesso a todos os módulos
    if (req.user.role === 'master') {
      return next();
    }

    const tenant = req.user.tenant || req.user.tenantId;
    
    if (!tenant || !tenant.modules) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de módulos não encontrada',
        code: 'MODULES_NOT_CONFIGURED'
      });
    }

    const module = tenant.modules[moduleName];
    
    if (!module || !module.enabled) {
      return res.status(403).json({
        success: false,
        error: `Módulo ${moduleName} não está habilitado para este tenant`,
        code: 'MODULE_DISABLED',
        module: moduleName
      });
    }

    next();
  };
};

/**
 * Gerar novo token JWT
 * @param {Object} user - Objeto do usuário
 * @returns {string} Token JWT
 */
const generateToken = (user) => {
  // Determinar roles e scopes baseado no role do usuário
  const roles = [];
  const scopes = [];
  
  switch(user.role) {
    case 'master':
      roles.push('super-admin', 'tenant-admin', 'agent');
      scopes.push('*'); // Acesso total
      break;
    case 'admin':
      roles.push('tenant-admin', 'agent');
      scopes.push('tenant:manage', 'users:manage', 'chat:manage', 'settings:manage');
      break;
    case 'agent':
      roles.push('agent');
      scopes.push('chat:manage', 'users:read', 'settings:read');
      break;
    case 'client':
      roles.push('client');
      scopes.push('chat:participate', 'profile:manage');
      break;
    default:
      roles.push('client');
      scopes.push('chat:participate');
  }
  
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    roles: roles, // Array de roles para validação granular
    scopes: scopes, // Permissões específicas
    tenantId: user.tenantId?._id || user.tenantId || null,
    company: user.company,
    name: user.name,
    // Adicionar timestamp de geração para auditoria
    iat: Math.floor(Date.now() / 1000),
    // Adicionar versão do token para facilitar migrações futuras
    tokenVersion: 2
  };
  
  // Se o tenant está populado, adicionar informações extras
  if (user.tenantId && typeof user.tenantId === 'object') {
    payload.tenantSlug = user.tenantId.slug || user.tenantId.key;
    payload.tenantName = user.tenantId.companyName || user.tenantId.name;
  }
  
  const options = {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    issuer: process.env.JWT_ISSUER || 'chat-atendimento',
    audience: process.env.JWT_AUDIENCE || 'chat-users'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

/**
 * Gerar token de refresh
 * @param {Object} user - Objeto do usuário
 * @returns {string} Refresh token JWT
 */
const generateRefreshToken = (user) => {
  const payload = {
    id: user._id,
    type: 'refresh'
  };
  
  const options = {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
    issuer: process.env.JWT_ISSUER || 'chat-atendimento'
  };
  
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, options);
};

/**
 * Verificar refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Payload decodificado
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
};

module.exports = {
  authenticateJWT,
  requireRole,
  requireSameTenant,
  checkPlanLimit,
  requireModule,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};
