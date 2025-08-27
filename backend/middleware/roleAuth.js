const { hasPermission, canManageRole } = require('../config/permissions');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

/**
 * Middleware de autorização baseado em roles
 * Garante isolamento multi-tenant
 */

/**
 * Verificar se usuário tem role específico
 */
const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }

      // Master tem acesso total
      if (req.user.role === 'master') {
        return next();
      }

      // Verificar se o role do usuário está na lista permitida
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. Role insuficiente.'
        });
      }

      next();
    } catch (error) {
      console.error('Erro no middleware requireRole:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões'
      });
    }
  };
};

/**
 * Verificar permissão específica
 */
const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }

      // Master tem todas as permissões
      if (req.user.role === 'master') {
        return next();
      }

      // Verificar permissão
      const hasAccess = hasPermission(req.user.role, resource, action);

      // Verificar permissões customizadas do usuário
      if (!hasAccess && req.user.customPermissions) {
        const customKey = `${resource}.${action}`;
        if (req.user.customPermissions.get(customKey) === true) {
          return next();
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Sem permissão para ${action} em ${resource}`
        });
      }

      next();
    } catch (error) {
      console.error('Erro no middleware requirePermission:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões'
      });
    }
  };
};

/**
 * Garantir isolamento multi-tenant
 * Verifica se o usuário pertence ao tenant correto
 */
const requireTenant = (allowMaster = false) => {
  return async (req, res, next) => {
    try {
      // Master pode acessar qualquer tenant se permitido
      if (allowMaster && req.user.role === 'master') {
        // Se houver tenantId na requisição, carregar o tenant
        if (req.params.tenantId || req.query.tenantId || req.body.tenantId) {
          const tenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;
          req.tenant = await Tenant.findById(tenantId);
          if (!req.tenant) {
            return res.status(404).json({
              success: false,
              message: 'Tenant não encontrado'
            });
          }
        }
        return next();
      }

      // Para outros usuários, verificar tenant
      if (!req.user.tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Usuário não vinculado a nenhuma empresa'
        });
      }

      // Carregar tenant do usuário
      req.tenant = await Tenant.findById(req.user.tenantId);
      if (!req.tenant) {
        return res.status(404).json({
          success: false,
          message: 'Empresa não encontrada'
        });
      }

      // Verificar se tenant está ativo
      if (!req.tenant.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Empresa suspensa ou inativa'
        });
      }

      // Se estiver tentando acessar dados de outro tenant, bloquear
      const requestedTenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;
      if (requestedTenantId && requestedTenantId.toString() !== req.user.tenantId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado a dados de outra empresa'
        });
      }

      next();
    } catch (error) {
      console.error('Erro no middleware requireTenant:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar tenant'
      });
    }
  };
};

/**
 * Verificar se pode gerenciar outro usuário
 */
const canManageUser = () => {
  return async (req, res, next) => {
    try {
      const targetUserId = req.params.userId || req.body.userId;
      if (!targetUserId) {
        return next();
      }

      // Master pode gerenciar qualquer usuário
      if (req.user.role === 'master') {
        return next();
      }

      // Buscar usuário alvo
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar se está no mesmo tenant (exceto master)
      if (targetUser.role !== 'master' && 
          targetUser.tenantId?.toString() !== req.user.tenantId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Não pode gerenciar usuários de outra empresa'
        });
      }

      // Verificar hierarquia de roles
      if (!canManageRole(req.user.role, targetUser.role)) {
        return res.status(403).json({
          success: false,
          message: 'Não pode gerenciar usuário com role superior ou igual'
        });
      }

      req.targetUser = targetUser;
      next();
    } catch (error) {
      console.error('Erro no middleware canManageUser:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões de gerenciamento'
      });
    }
  };
};

/**
 * Verificar limite de recursos do tenant
 */
const checkTenantLimit = (limitType) => {
  return async (req, res, next) => {
    try {
      // Master não tem limites
      if (req.user.role === 'master') {
        return next();
      }

      // Verificar se tenant foi carregado
      if (!req.tenant) {
        req.tenant = await Tenant.findById(req.user.tenantId);
      }

      // Mapear tipos de limite
      const limitMap = {
        'users': 'users',
        'agents': 'users', // Agentes contam como usuários
        'storage': 'storage',
        'messages': 'monthlyMessages'
      };

      const actualLimit = limitMap[limitType] || limitType;

      // Verificar limite
      if (!req.tenant.checkLimit(actualLimit)) {
        return res.status(403).json({
          success: false,
          message: `Limite de ${limitType} atingido para o plano atual`,
          upgrade: true
        });
      }

      next();
    } catch (error) {
      console.error('Erro ao verificar limite do tenant:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar limites'
      });
    }
  };
};

/**
 * Middleware para rotas do Master
 */
const masterOnly = () => {
  return async (req, res, next) => {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({
        success: false,
        message: 'Acesso exclusivo do Master'
      });
    }
    next();
  };
};

/**
 * Middleware para rotas de Admin
 */
const adminOnly = () => {
  return requireRole('admin', 'master');
};

/**
 * Middleware para rotas de Agent
 */
const agentOnly = () => {
  return requireRole('agent', 'admin', 'master');
};

/**
 * Aplicar isolamento de dados baseado no tenant
 * Adiciona filtro de tenant automaticamente nas queries
 */
const applyTenantFilter = () => {
  return (req, res, next) => {
    // Master vê tudo se não especificar tenant
    if (req.user.role === 'master' && !req.query.tenantId) {
      return next();
    }

    // Adicionar filtro de tenant nas queries
    const tenantId = req.user.tenantId || req.query.tenantId;
    
    if (tenantId) {
      // Adicionar ao query
      req.query.tenantId = tenantId;
      
      // Adicionar ao body se existir
      if (req.body) {
        req.body.tenantId = tenantId;
      }
    }

    next();
  };
};

module.exports = {
  requireRole,
  requirePermission,
  requireTenant,
  canManageUser,
  checkTenantLimit,
  masterOnly,
  adminOnly,
  agentOnly,
  applyTenantFilter
};
