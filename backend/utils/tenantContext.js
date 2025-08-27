/**
 * Gerenciador de Contexto de Tenant
 * 
 * Gerencia o contexto de tenant para cada requisição,
 * permitindo que modelos e serviços acessem o tenantId atual
 */

const { AsyncLocalStorage } = require('async_hooks');

// Storage assíncrono para manter contexto por requisição
const tenantStorage = new AsyncLocalStorage();

/**
 * Configurar contexto de tenant para uma requisição
 * @param {Object} req - Objeto da requisição Express
 * @param {String} tenantId - ID do tenant
 */
function setTenantContext(req, tenantId) {
  // Armazenar no request para acesso direto
  req.tenantId = tenantId;
  req._tenantContext = tenantId;
  
  // Também armazenar em AsyncLocalStorage para acesso global
  const store = tenantStorage.getStore() || {};
  store.tenantId = tenantId;
  
  return tenantId;
}

/**
 * Obter contexto de tenant atual
 * @returns {String|null} ID do tenant atual ou null
 */
function getTenantContext() {
  const store = tenantStorage.getStore();
  return store ? store.tenantId : null;
}

/**
 * Limpar contexto de tenant
 */
function clearTenantContext() {
  const store = tenantStorage.getStore();
  if (store) {
    delete store.tenantId;
  }
}

/**
 * Executar função com contexto de tenant específico
 * @param {String} tenantId - ID do tenant
 * @param {Function} callback - Função a executar
 */
function runWithTenant(tenantId, callback) {
  return tenantStorage.run({ tenantId }, callback);
}

/**
 * Middleware para configurar contexto de tenant baseado no usuário autenticado
 */
function tenantContextMiddleware(req, res, next) {
  // Se usuário está autenticado e tem tenantId
  if (req.user && req.user.tenantId) {
    const tenantId = req.user.tenantId._id || req.user.tenantId;
    setTenantContext(req, tenantId.toString());
  }
  
  // Limpar contexto ao finalizar resposta
  res.on('finish', () => {
    clearTenantContext();
  });
  
  next();
}

/**
 * Verificar se há contexto de tenant ativo
 * @returns {Boolean}
 */
function hasTenantContext() {
  return getTenantContext() !== null;
}

/**
 * Obter contexto completo (útil para debug)
 * @returns {Object}
 */
function getFullContext() {
  return tenantStorage.getStore() || {};
}

module.exports = {
  setTenantContext,
  getTenantContext,
  clearTenantContext,
  runWithTenant,
  tenantContextMiddleware,
  hasTenantContext,
  getFullContext,
  tenantStorage
};
