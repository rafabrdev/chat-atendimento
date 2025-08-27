const cors = require('cors');
const Tenant = require('../models/Tenant');
const corsService = require('../services/corsService');

/**
 * Obter origens permitidas de um tenant
 * Delegado ao corsService para centralização
 */
async function getAllowedOrigins(tenantId) {
  return corsService.getAllowedOrigins(tenantId);
}

/**
 * Validar se uma origem é permitida
 * Delegado ao corsService para lógica unificada
 */
function isOriginAllowed(origin, allowedOrigins) {
  return corsService.isOriginAllowed(origin, allowedOrigins);
}

/**
 * Middleware de CORS dinâmico
 * Valida Origin contra tenant.allowedOrigins
 */
function dynamicCors(options = {}) {
  // Origens sempre permitidas (desenvolvimento)
  const alwaysAllowed = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174'
  ];

  // Configuração base do CORS
  const corsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tenant-ID',
      'X-Tenant-Key',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page',
      'X-Per-Page'
    ],
    maxAge: 86400, // 24 horas
    ...options
  };

  // Função de validação de origem
  corsOptions.origin = async function (origin, callback) {
    try {
      // Se não há origem (requisições same-origin ou ferramentas)
      if (!origin) {
        return callback(null, true);
      }

      // Em desenvolvimento, permitir localhost
      if (process.env.NODE_ENV === 'development') {
        const devOrigins = corsService.getDevelopmentOrigins();
        if (devOrigins.some(allowed => origin.startsWith(allowed))) {
          corsService.logAccess(origin, 'development', true);
          return callback(null, true);
        }
      }

      // Tentar obter tenant do request
      // Nota: Este é um hack porque cors() é executado antes dos outros middlewares
      // Idealmente, teríamos acesso ao req.tenant aqui
      
      // Por enquanto, vamos permitir todas as origens e validar depois no middleware de tenant
      // Esta é uma abordagem temporária durante a migração
      
      if (process.env.USE_DEFAULT_TENANT_FALLBACK === 'true') {
        // Durante migração, buscar tenant default
        const defaultTenant = await Tenant.findOne({ slug: 'default' }).select('allowedOrigins');
        if (defaultTenant) {
          const allowedOrigins = defaultTenant.allowedOrigins || [];
          
          // Adicionar origens de desenvolvimento
          const allOrigins = [...new Set([...allowedOrigins, ...alwaysAllowed])];
          
          if (isOriginAllowed(origin, allOrigins)) {
            return callback(null, true);
          }
        }
      }

      // Se chegou aqui, verificar se a origem está em algum tenant
      // Isso é menos eficiente, mas funciona durante a transição
      const tenants = await Tenant.find({ 
        allowedOrigins: { $in: [origin, '*'] } 
      }).select('_id');
      
      if (tenants.length > 0) {
        return callback(null, true);
      }

      // Verificar wildcards e regex
      const allTenants = await Tenant.find({}).select('allowedOrigins');
      for (const tenant of allTenants) {
        if (isOriginAllowed(origin, tenant.allowedOrigins || [])) {
          return callback(null, true);
        }
      }

      // Origem não permitida - registrar para análise
      console.log('[DynamicCORS] Origem bloqueada:', origin);
      corsService.logAccess(origin, 'unknown', false);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
      
    } catch (error) {
      console.error('[DynamicCORS] Erro:', error);
      // Em caso de erro, ser permissivo (pode ajustar para ser restritivo)
      callback(null, true);
    }
  };

  return cors(corsOptions);
}

/**
 * Middleware adicional para validar CORS após tenant ser resolvido
 * Este deve ser usado APÓS o middleware de tenant
 */
function validateTenantCors(req, res, next) {
  // Se não há tenant ou é master, permitir
  if (!req.tenant || req.isMaster) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  
  if (!origin) {
    // Sem origem (ferramentas, Postman, etc)
    return next();
  }

  // Verificar se a origem é permitida para este tenant
  const allowedOrigins = req.tenant.allowedOrigins || [];
  
  // Em desenvolvimento, adicionar localhost
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174'
    );
  }

  if (isOriginAllowed(origin, allowedOrigins)) {
    // Adicionar headers CORS específicos do tenant
    res.setHeader('X-Tenant-ID', req.tenant._id);
    res.setHeader('X-Tenant-Slug', req.tenant.slug);
    return next();
  }

  // Origem não permitida para este tenant
  console.log(`[DynamicCORS] Origem ${origin} não permitida para tenant ${req.tenant.slug}`);
  res.status(403).json({
    success: false,
    error: 'Origin not allowed for this tenant',
    origin,
    tenant: req.tenant.slug
  });
}

/**
 * Limpar cache de um tenant específico
 * Delegado ao corsService
 */
function clearTenantOriginsCache(tenantId) {
  corsService.clearCache(tenantId);
}

module.exports = {
  dynamicCors,
  validateTenantCors,
  clearTenantOriginsCache,
  isOriginAllowed
};
