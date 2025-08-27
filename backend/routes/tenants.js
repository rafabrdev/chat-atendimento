const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const NodeCache = require('node-cache');
const tenantConfig = require('../config/tenants.json');

// Cache em memória para tenants
const tenantCache = new NodeCache({ 
  stdTTL: tenantConfig.cache.ttl || 300,
  checkperiod: 120
});

/**
 * @swagger  
 * /api/tenants/test:
 *   get:
 *     tags: [Tenants]
 *     summary: Teste de conexão com banco
 *     description: Testa se consegue buscar tenants
 *     responses:
 *       200:
 *         description: Resultado do teste
 */
router.get('/test', async (req, res) => {
  try {
    console.log('[Test] Buscando todos os tenants...');
    const allTenants = await Tenant.find({});
    console.log(`[Test] Encontrados ${allTenants.length} tenants`);
    
    const defaultTenant = await Tenant.findOne({ key: 'default' });
    const defaultActive = await Tenant.findOne({ key: 'default', isActive: true });
    const defaultBySlug = await Tenant.findOne({ slug: 'default' });
    
    res.json({
      success: true,
      totalTenants: allTenants.length,
      tenants: allTenants.map(t => ({
        id: t._id,
        key: t.key || 'NAO_TEM_KEY',
        slug: t.slug,
        name: t.name || t.companyName,
        isActive: t.isActive
      })),
      defaultTenant: defaultTenant ? {
        found: true,
        key: defaultTenant.key,
        isActive: defaultTenant.isActive
      } : { found: false },
      defaultActiveTest: defaultActive ? true : false,
      defaultBySlug: defaultBySlug ? {
        found: true,
        id: defaultBySlug._id,
        key: defaultBySlug.key || 'NAO_TEM_KEY', 
        slug: defaultBySlug.slug,
        name: defaultBySlug.name || defaultBySlug.companyName,
        isActive: defaultBySlug.isActive
      } : { found: false }
    });
  } catch (error) {
    console.error('[Test] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/tenants/resolve:
 *   get:
 *     tags: [Tenants]
 *     summary: Resolver tenant
 *     description: Resolve tenant por subdomain, key ou fallback
 *     parameters:
 *       - in: query
 *         name: key
 *         schema:
 *           type: string
 *         description: Key do tenant
 *       - in: query
 *         name: subdomain
 *         schema:
 *           type: string
 *         description: Subdomínio do tenant
 *     responses:
 *       200:
 *         description: Tenant resolvido
 */
router.get('/resolve', async (req, res) => {
  try {
    const { key, subdomain } = req.query;
    const host = req.get('host');
    
    let tenant = null;
    let resolveMethod = 'none';
    
    // 1. Tentar resolver por key na query
    if (key) {
      tenant = await Tenant.findOne({ 
        key: key.toLowerCase(),
        isActive: true
      });
      resolveMethod = 'query_key';
    }
    
    // 2. Tentar resolver por subdomain na query
    if (!tenant && subdomain) {
      tenant = await Tenant.findOne({ 
        key: subdomain.toLowerCase(),
        isActive: true
      });
      resolveMethod = 'query_subdomain';
    }
    
    // 3. Tentar resolver por host
    if (!tenant && host) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        const possibleKey = parts[0];
        if (possibleKey !== 'www' && possibleKey !== 'api') {
          tenant = await Tenant.findOne({ 
            key: possibleKey.toLowerCase(),
            isActive: true
          });
          resolveMethod = 'host_subdomain';
        }
      }
    }
    
    // 4. Fallback para tenant default se habilitado
    if (!tenant && tenantConfig.fallback.enabled) {
      tenant = await Tenant.findOne({ 
        key: tenantConfig.fallback.defaultTenantKey,
        isActive: true
      });
      resolveMethod = 'fallback_default';
    }
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Não foi possível resolver o tenant',
        resolveMethod
      });
    }
    
    // Retornar dados públicos
    res.json({
      success: true,
      resolveMethod,
      data: {
        key: tenant.key,
        name: tenant.name,
        companyName: tenant.companyName,
        plan: tenant.plan || tenant.subscription?.plan,
        allowedOrigins: tenant.allowedOrigins || [],
        branding: tenant.settings?.branding || {}
      }
    });
    
  } catch (error) {
    console.error('Erro ao resolver tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao resolver tenant'
    });
  }
});

/**
 * @swagger
 * /api/tenants/cache/clear:
 *   post:
 *     tags: [Tenants]
 *     summary: Limpar cache de tenants
 *     description: Limpa o cache em memória dos tenants (requer autenticação master)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache limpo com sucesso
 */
router.post('/cache/clear', async (req, res) => {
  try {
    // TODO: Adicionar autenticação master aqui
    
    tenantCache.flushAll();
    console.log('[Cache] Cache de tenants limpo');
    
    res.json({
      success: true,
      message: 'Cache de tenants limpo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache'
    });
  }
});

/**
 * @swagger
 * /api/tenants/{key}:
 *   get:
 *     tags: [Tenants]
 *     summary: Obter informações do tenant
 *     description: Retorna informações públicas do tenant pela key
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Key única do tenant
 *     responses:
 *       200:
 *         description: Dados do tenant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     name:
 *                       type: string
 *                     companyName:
 *                       type: string
 *                     status:
 *                       type: string
 *                     plan:
 *                       type: string
 *                     allowedOrigins:
 *                       type: array
 *                       items:
 *                         type: string
 *                     branding:
 *                       type: object
 *       404:
 *         description: Tenant não encontrado
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    console.log(`[Tenants] Buscando tenant com key: "${key}"`);
    
    // Verificar cache primeiro
    const cached = tenantCache.get(key);
    if (cached) {
      console.log(`[Cache Hit] Tenant ${key} encontrado no cache`);
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }
    
    // Buscar no banco
    const query = { 
      key: key.toLowerCase(),
      isActive: true 
    };
    
    console.log(`[Tenants] Query:`, JSON.stringify(query));
    
    const tenant = await Tenant.findOne(query).select({
      key: 1,
      name: 1,
      companyName: 1,
      slug: 1,
      plan: 1,
      'subscription.status': 1,
      allowedOrigins: 1,
      limits: 1,
      modules: 1,
      'settings.branding': 1,
      'settings.timezone': 1,
      'settings.language': 1,
      'settings.currency': 1,
      isActive: 1,
      isSuspended: 1
    });
    
    console.log(`[Tenants] Resultado da busca:`, tenant ? 'Encontrado' : 'Não encontrado');
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado',
        key: key
      });
    }
    
    // Verificar se está suspenso
    if (tenant.isSuspended) {
      return res.status(403).json({
        success: false,
        error: 'TENANT_SUSPENDED',
        message: 'Este tenant está temporariamente suspenso'
      });
    }
    
    // Verificar status da subscription
    if (tenant.subscription && tenant.subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `SUBSCRIPTION_${tenant.subscription.status.toUpperCase()}`,
        message: `A assinatura deste tenant está ${tenant.subscription.status}`
      });
    }
    
    // Preparar resposta com dados públicos
    const publicData = {
      key: tenant.key,
      name: tenant.name,
      companyName: tenant.companyName,
      slug: tenant.slug,
      plan: tenant.plan || tenant.subscription?.plan,
      status: tenant.subscription?.status || 'active',
      allowedOrigins: tenant.allowedOrigins || [],
      limits: tenant.limits,
      modules: Object.keys(tenant.modules || {})
        .filter(m => tenant.modules[m].enabled)
        .reduce((acc, m) => {
          acc[m] = {
            enabled: true,
            features: tenant.modules[m].features
          };
          return acc;
        }, {}),
      branding: tenant.settings?.branding || {},
      settings: {
        timezone: tenant.settings?.timezone,
        language: tenant.settings?.language,
        currency: tenant.settings?.currency
      }
    };
    
    // Adicionar ao cache
    if (tenantConfig.cache.enabled) {
      tenantCache.set(key, publicData);
      console.log(`[Cache Set] Tenant ${key} adicionado ao cache`);
    }
    
    res.json({
      success: true,
      data: publicData
    });
    
  } catch (error) {
    console.error('Erro ao buscar tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar informações do tenant'
    });
  }
});

/**
 * Middleware para invalidar cache quando tenant é atualizado
 */
router.invalidateCache = function(tenantKey) {
  if (tenantKey && tenantCache.has(tenantKey)) {
    tenantCache.del(tenantKey);
    console.log(`[Cache] Cache invalidado para tenant ${tenantKey}`);
  }
};

module.exports = router;
