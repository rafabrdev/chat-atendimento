const Tenant = require('../models/Tenant');

/**
 * Middleware condicional para tenant
 * Não bloqueia master ou rotas específicas
 */
const conditionalLoadTenant = async (req, res, next) => {
  try {
    // Se usuário é master, não precisa de tenant
    if (req.user && req.user.role === 'master') {
      req.isMaster = true;
      req.tenantFilter = {}; // Master vê tudo
      return next();
    }

    // Se usuário tem tenantId, carrega o tenant
    if (req.user && req.user.tenantId) {
      const tenant = await Tenant.findById(req.user.tenantId);
      
      if (tenant && tenant.isActive) {
        req.tenant = tenant;
        req.tenantId = tenant._id;
        req.tenantFilter = { tenantId: tenant._id };
      }
    }

    // Sempre continua, não bloqueia
    next();
  } catch (error) {
    console.error('Erro ao carregar tenant (condicional):', error);
    // Não bloqueia em caso de erro
    next();
  }
};

module.exports = {
  conditionalLoadTenant
};
