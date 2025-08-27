const Tenant = require('../models/Tenant');
const User = require('../models/User');

/**
 * Middleware para verificar e carregar tenant baseado no contexto
 */
const loadTenant = async (req, res, next) => {
  try {
    console.log('[LoadTenant] Iniciando middleware');
    console.log('[LoadTenant] User:', req.user ? {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
      tenantIdType: typeof req.user.tenantId
    } : 'No user');
    
    // Se usuário é master, não precisa de tenant
    if (req.user && req.user.role === 'master') {
      console.log('[LoadTenant] Usuario é master, pulando verificação de tenant');
      req.isMaster = true;
      return next();
    }

    // 1. Prioridade: Tenant do usuário autenticado
    if (req.user && req.user.tenantId) {
      console.log('[LoadTenant] Buscando tenant pelo ID:', req.user.tenantId);
      
      // Tratar caso onde tenantId é um objeto populado
      let tenantId = req.user.tenantId;
      if (typeof tenantId === 'object' && tenantId._id) {
        tenantId = tenantId._id;
      }
      
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        console.log('[LoadTenant] Tenant não encontrado para ID:', tenantId);
        return res.status(404).json({
          success: false,
          error: 'Tenant não encontrado'
        });
      }

      if (!tenant.isActive) {
        console.log('[LoadTenant] Tenant não está ativo');
        return res.status(403).json({
          success: false,
          error: 'Conta suspensa. Entre em contato com o suporte.'
        });
      }

      console.log('[LoadTenant] Tenant encontrado:', tenant.companyName);
      req.tenant = tenant;
      req.tenantId = tenant._id;
      return next();
    }

    // 2. Tentar identificar pelo domínio/subdomain
    const host = req.get('host');
    const subdomain = host.split('.')[0];
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      const tenant = await Tenant.findOne({ 
        $or: [
          { slug: subdomain },
          { domain: host }
        ]
      });

      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant._id;
        return next();
      }
    }

    // 3. Header personalizado (para APIs)
    const tenantIdHeader = req.headers['x-tenant-id'];
    if (tenantIdHeader) {
      const tenant = await Tenant.findById(tenantIdHeader);
      
      if (tenant && tenant.isActive) {
        req.tenant = tenant;
        req.tenantId = tenant._id;
        return next();
      }
    }

    // Se chegou aqui e é uma rota protegida, erro
    if (req.path !== '/health' && !req.path.includes('/auth/login')) {
      console.log('[LoadTenant] ERRO: Tenant não identificado');
      console.log('[LoadTenant] Path:', req.path);
      console.log('[LoadTenant] User exists:', !!req.user);
      console.log('[LoadTenant] User tenantId:', req.user?.tenantId);
      
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado',
        debug: {
          hasUser: !!req.user,
          userRole: req.user?.role,
          userTenantId: req.user?.tenantId,
          path: req.path
        }
      });
    }

    next();
  } catch (error) {
    console.error('Erro ao carregar tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar tenant'
    });
  }
};

/**
 * Middleware para verificar se tenant tem acesso ao módulo
 */
const requireModule = (moduleName) => {
  return async (req, res, next) => {
    // Master tem acesso a tudo
    if (req.isMaster) {
      return next();
    }

    if (!req.tenant) {
      return res.status(403).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!req.tenant.hasModule(moduleName)) {
      return res.status(403).json({
        success: false,
        error: `Módulo ${moduleName} não está habilitado para sua conta`
      });
    }

    next();
  };
};

/**
 * Middleware para verificar limites do tenant
 */
const checkTenantLimit = (limitType, amount = 1) => {
  return async (req, res, next) => {
    // Master não tem limites
    if (req.isMaster) {
      return next();
    }

    if (!req.tenant) {
      return res.status(403).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    if (!req.tenant.checkLimit(limitType, amount)) {
      return res.status(429).json({
        success: false,
        error: `Limite de ${limitType} excedido. Faça upgrade do seu plano.`,
        limit: req.tenant.limits[limitType],
        current: req.tenant.usage[limitType]
      });
    }

    next();
  };
};

/**
 * Middleware para aplicar filtro de tenant em queries
 */
const applyTenantFilter = (req, res, next) => {
  // Master vê tudo
  if (req.isMaster) {
    // Pode opcionalmente filtrar por tenant específico
    if (req.query.tenantId) {
      req.tenantFilter = { tenantId: req.query.tenantId };
    } else {
      req.tenantFilter = {};
    }
  } else if (req.tenantId) {
    // Força o filtro pelo tenant do usuário
    req.tenantFilter = { tenantId: req.tenantId };
    
    // Remove tenantId da query para evitar bypass
    delete req.query.tenantId;
  } else {
    req.tenantFilter = {};
  }

  next();
};

/**
 * Middleware para incrementar uso do tenant
 */
const incrementUsage = (usageType, amount = 1) => {
  return async (req, res, next) => {
    if (req.tenant && !req.isMaster) {
      await req.tenant.incrementUsage(usageType, amount);
    }
    next();
  };
};

/**
 * Middleware para verificar se é master
 */
const requireMaster = (req, res, next) => {
  if (!req.user || req.user.role !== 'master') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito ao master'
    });
  }
  next();
};

/**
 * Middleware para verificar permissões hierárquicas
 * Master > Admin (empresa) > Agent > Client
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    // Master sempre tem acesso
    if (req.user.role === 'master') {
      return next();
    }

    // Verifica se o role do usuário está na lista permitida
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Permissão negada para este recurso'
      });
    }

    next();
  };
};

module.exports = {
  loadTenant,
  requireModule,
  checkTenantLimit,
  applyTenantFilter,
  incrementUsage,
  requireMaster,
  requireRole
};
