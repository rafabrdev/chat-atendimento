const Tenant = require('../models/Tenant');
const NodeCache = require('node-cache');

// Cache de tenants (TTL de 5 minutos)
const tenantCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Middleware principal para resolver e carregar tenant
 * Ordem de prioridade:
 * 1. Tenant do usuário autenticado
 * 2. Header x-tenant-id ou x-tenant-key
 * 3. Subdomínio/domínio
 * 4. Query parameter (?tenant=)
 * 5. Fallback para "default"
 */
const resolveTenant = async (req, res, next) => {
  try {
    let tenant = null;
    let tenantId = null;
    let resolvedBy = null;

    // Log para debug
    console.log('[TenantMiddleware] Iniciando resolução de tenant');
    console.log('[TenantMiddleware] Path:', req.path);
    console.log('[TenantMiddleware] Method:', req.method);
    console.log('[TenantMiddleware] Host:', req.get('host'));
    console.log('[TenantMiddleware] Headers:', {
      'x-tenant-id': req.headers['x-tenant-id'],
      'x-tenant-key': req.headers['x-tenant-key'],
      'origin': req.headers.origin
    });

    // Se usuário é master, tem acesso especial
    if (req.user && req.user.role === 'master') {
      console.log('[TenantMiddleware] Usuário master detectado');
      req.isMaster = true;
      
      // Master pode especificar qual tenant quer visualizar
      if (req.headers['x-tenant-id'] || req.query.tenantId) {
        tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        tenant = await getCachedTenant(tenantId);
        resolvedBy = 'master-override';
      }
      
      // Se master não especificou tenant, prosseguir sem tenant
      if (!tenant) {
        return next();
      }
    }

    // 1. Prioridade: Tenant do usuário autenticado (não master)
    if (!tenant && req.user && req.user.tenantId) {
      console.log('[TenantMiddleware] Tentando resolver pelo usuário autenticado');
      
      // Tratar caso onde tenantId é um objeto populado
      tenantId = typeof req.user.tenantId === 'object' ? req.user.tenantId._id : req.user.tenantId;
      tenant = await getCachedTenant(tenantId);
      resolvedBy = 'user-tenant';
    }

    // 2. Header personalizado x-tenant-id ou x-tenant-key
    if (!tenant) {
      const headerTenantId = req.headers['x-tenant-id'];
      const headerTenantKey = req.headers['x-tenant-key'];
      
      if (headerTenantId) {
        console.log('[TenantMiddleware] Tentando resolver por header x-tenant-id:', headerTenantId);
        tenant = await getCachedTenant(headerTenantId);
        resolvedBy = 'header-id';
      } else if (headerTenantKey) {
        console.log('[TenantMiddleware] Tentando resolver por header x-tenant-key:', headerTenantKey);
        tenant = await getCachedTenantByKey(headerTenantKey);
        resolvedBy = 'header-key';
      }
    }

    // 3. Resolver por subdomínio/domínio
    if (!tenant) {
      const host = req.get('host');
      
      if (host) {
        // Extrair subdomínio
        const parts = host.split('.');
        const subdomain = parts[0];
        
        // Ignorar www, api, localhost
        if (subdomain && !['www', 'api', 'localhost'].includes(subdomain)) {
          console.log('[TenantMiddleware] Tentando resolver por subdomínio:', subdomain);
          // Usar key para subdomínio
          tenant = await getCachedTenantByKey(subdomain);
          
          if (tenant) {
            resolvedBy = 'subdomain';
          } else {
            // Tentar pelo domínio completo
            console.log('[TenantMiddleware] Tentando resolver por domínio:', host);
            const cacheKey = `domain:${host}`;
            tenant = tenantCache.get(cacheKey);
            
            if (!tenant) {
              tenant = await Tenant.findOne({ domain: host });
              if (tenant) {
                tenantCache.set(cacheKey, tenant);
                resolvedBy = 'domain';
              }
            }
          }
        }
      }
    }

    // 4. Query parameter (útil para desenvolvimento)
    if (!tenant && req.query.tenant) {
      console.log('[TenantMiddleware] Tentando resolver por query parameter:', req.query.tenant);
      // Tentar por key primeiro
      tenant = await getCachedTenantByKey(req.query.tenant);
      resolvedBy = 'query-param';
    }

    // 5. Fallback para tenant "default" (durante migração)
    if (!tenant && shouldUseFallback(req)) {
      console.log('[TenantMiddleware] Usando fallback para tenant default');
      tenant = await getCachedTenantByKey('default');
      resolvedBy = 'fallback-default';
    }

    // Validar tenant encontrado
    if (tenant) {
      if (!tenant.isActive) {
        console.log('[TenantMiddleware] Tenant não está ativo:', tenant.slug);
        return res.status(403).json({
          success: false,
          error: 'Conta suspensa. Entre em contato com o suporte.',
          tenantId: tenant._id
        });
      }

      // Verificar status da subscription
      if (tenant.subscription.status === 'expired' || tenant.subscription.status === 'cancelled') {
        console.log('[TenantMiddleware] Subscription expirada ou cancelada:', tenant.slug);
        // Permitir acesso limitado para renovação
        req.tenantLimited = true;
      }

      // Anexar tenant ao request
      req.tenant = tenant;
      req.tenantId = tenant._id;
      req.tenantKey = tenant.key;
      req.resolvedBy = resolvedBy;
      
      console.log(`[TenantMiddleware] ✅ Tenant resolvido: ${tenant.companyName} (key: ${tenant.key}) via ${resolvedBy}`);
    } else if (requiresTenant(req)) {
      // Se a rota requer tenant e não foi encontrado
      console.log('[TenantMiddleware] ❌ Tenant obrigatório não encontrado');
      return res.status(400).json({
        success: false,
        error: 'Tenant não identificado',
        help: 'Especifique o tenant via header (x-tenant-key), subdomínio ou query parameter',
        debug: process.env.NODE_ENV !== 'production' ? {
          host: req.get('host'),
          headers: {
            'x-tenant-id': req.headers['x-tenant-id'],
            'x-tenant-key': req.headers['x-tenant-key']
          },
          query: req.query.tenant,
          user: req.user ? { id: req.user._id, role: req.user.role } : null
        } : undefined
      });
    }

    next();
  } catch (error) {
    console.error('[TenantMiddleware] Erro:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar tenant',
      message: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};

/**
 * Middleware para aplicar filtro de tenant em queries
 */
const applyTenantScope = (req, res, next) => {
  if (req.isMaster && !req.tenant) {
    // Master sem tenant específico pode ver tudo
    req.tenantFilter = {};
  } else if (req.tenantId) {
    // Força o filtro pelo tenant
    req.tenantFilter = { tenantId: req.tenantId };
    
    // Previne bypass via query parameters
    delete req.query.tenantId;
    delete req.body?.tenantId;
  } else {
    req.tenantFilter = {};
  }

  // Helper para adicionar tenant em criação
  req.addTenantId = (data) => {
    if (req.tenantId && !req.isMaster) {
      return { ...data, tenantId: req.tenantId };
    }
    return data;
  };

  next();
};

/**
 * Middleware para validar módulos do tenant
 */
const requireModule = (moduleName) => {
  return (req, res, next) => {
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
        error: `Módulo ${moduleName} não está habilitado para sua conta`,
        upgrade: true
      });
    }

    next();
  };
};

/**
 * Middleware para validar limites do tenant
 */
const checkLimit = (limitType, amount = 1) => {
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
        error: `Limite de ${limitType} excedido`,
        message: 'Faça upgrade do seu plano para continuar',
        limit: req.tenant.limits[limitType],
        current: req.tenant.usage[limitType],
        upgrade: true
      });
    }

    next();
  };
};

/**
 * Middleware para incrementar uso
 */
const incrementUsage = (usageType, amount = 1) => {
  return async (req, res, next) => {
    // Registrar uso após o response
    res.on('finish', async () => {
      if (res.statusCode < 400 && req.tenant && !req.isMaster) {
        try {
          await req.tenant.incrementUsage(usageType, amount);
        } catch (error) {
          console.error('[TenantMiddleware] Erro ao incrementar uso:', error);
        }
      }
    });
    next();
  };
};

// Funções auxiliares

async function getCachedTenant(tenantId) {
  if (!tenantId) return null;
  
  const cacheKey = `id:${tenantId}`;
  let tenant = tenantCache.get(cacheKey);
  
  if (!tenant) {
    tenant = await Tenant.findById(tenantId);
    if (tenant) {
      tenantCache.set(cacheKey, tenant);
    }
  }
  
  return tenant;
}

async function getCachedTenantBySlug(slug) {
  if (!slug) return null;
  
  const cacheKey = `slug:${slug}`;
  let tenant = tenantCache.get(cacheKey);
  
  if (!tenant) {
    // Tentar primeiro por key, depois por slug (para compatibilidade)
    tenant = await Tenant.findOne({ 
      $or: [
        { key: slug.toLowerCase() },
        { slug: slug.toLowerCase() }
      ]
    });
    if (tenant) {
      tenantCache.set(cacheKey, tenant);
      // Adicionar também no cache pela key
      if (tenant.key) {
        tenantCache.set(`key:${tenant.key}`, tenant);
      }
    }
  }
  
  return tenant;
}

// Nova função específica para buscar por key
async function getCachedTenantByKey(key) {
  if (!key) return null;
  
  const cacheKey = `key:${key}`;
  let tenant = tenantCache.get(cacheKey);
  
  if (!tenant) {
    tenant = await Tenant.findOne({ key: key.toLowerCase() });
    if (tenant) {
      tenantCache.set(cacheKey, tenant);
      // Adicionar também no cache pelo slug
      if (tenant.slug) {
        tenantCache.set(`slug:${tenant.slug}`, tenant);
      }
    }
  }
  
  return tenant;
}

function shouldUseFallback(req) {
  // Usar fallback em desenvolvimento ou para rotas específicas
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isPublicRoute = ['/health', '/api/auth/login', '/api/auth/register'].includes(req.path);
  
  // Durante migração, usar default como fallback
  const useFallbackDuringMigration = process.env.USE_DEFAULT_TENANT_FALLBACK === 'true';
  
  return (isDevelopment || isPublicRoute || useFallbackDuringMigration);
}

function requiresTenant(req) {
  // Rotas que não requerem tenant
  const publicRoutes = [
    '/health',
    '/api/auth/login',
    '/api/auth/register',
    '/api/stripe/webhook'
  ];
  
  return !publicRoutes.some(route => req.path.startsWith(route));
}

/**
 * Limpar cache de um tenant específico
 */
function clearTenantCache(tenantId, slug) {
  if (tenantId) tenantCache.del(`id:${tenantId}`);
  if (slug) tenantCache.del(`slug:${slug}`);
}

module.exports = {
  resolveTenant,
  applyTenantScope,
  requireModule,
  checkLimit,
  incrementUsage,
  clearTenantCache
};
