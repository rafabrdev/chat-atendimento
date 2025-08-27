const { getTenantContext } = require('../utils/tenantContext');

/**
 * Middleware para garantir que o tenantId seja sempre preenchido
 * em novos documentos baseado no contexto atual do usuário
 */
const ensureTenantId = function(req, res, next) {
  // Se o usuário está autenticado e tem um tenantId
  if (req.user && req.user.tenantId) {
    // Adiciona o tenantId ao corpo da requisição se não existir
    if (!req.body.tenantId) {
      req.body.tenantId = req.user.tenantId;
    }
    
    // Valida se o tenantId do corpo corresponde ao do usuário
    // (previne que um usuário crie documentos para outro tenant)
    if (req.body.tenantId && req.body.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para criar documentos para outro tenant'
      });
    }
  }
  
  next();
};

/**
 * Middleware para arrays de documentos
 */
const ensureTenantIdArray = function(req, res, next) {
  if (req.user && req.user.tenantId) {
    // Se o body é um array
    if (Array.isArray(req.body)) {
      req.body.forEach(item => {
        if (!item.tenantId) {
          item.tenantId = req.user.tenantId;
        }
        
        // Valida cada item
        if (item.tenantId && item.tenantId.toString() !== req.user.tenantId.toString()) {
          return res.status(403).json({
            success: false,
            error: 'Você não tem permissão para criar documentos para outro tenant'
          });
        }
      });
    }
  }
  
  next();
};

/**
 * Middleware para validar que o tenantId do documento sendo acessado
 * corresponde ao tenantId do usuário autenticado
 */
const validateTenantAccess = async function(req, res, next) {
  // Se o usuário é master, permite acesso a qualquer tenant
  if (req.user && req.user.role === 'master') {
    return next();
  }
  
  // Se há um documento sendo acessado e o usuário tem tenantId
  if (req.document && req.user && req.user.tenantId) {
    // Verifica se o documento tem tenantId
    if (req.document.tenantId) {
      // Valida se o tenantId do documento corresponde ao do usuário
      if (req.document.tenantId.toString() !== req.user.tenantId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Você não tem permissão para acessar este documento'
        });
      }
    }
  }
  
  next();
};

/**
 * Decorator para adicionar tenantId automaticamente em operações de criação
 * Útil para ser usado em controllers
 */
const withTenantId = (data, user) => {
  if (!user || !user.tenantId) {
    return data;
  }
  
  // Se é um array
  if (Array.isArray(data)) {
    return data.map(item => ({
      ...item,
      tenantId: item.tenantId || user.tenantId
    }));
  }
  
  // Se é um objeto
  return {
    ...data,
    tenantId: data.tenantId || user.tenantId
  };
};

/**
 * Helper para verificar se um ID pertence ao tenant do usuário
 */
const belongsToUserTenant = async (Model, documentId, user) => {
  // Master pode acessar qualquer tenant
  if (user.role === 'master') {
    return true;
  }
  
  // Se não há tenantId no usuário, nega acesso
  if (!user.tenantId) {
    return false;
  }
  
  try {
    const doc = await Model.findOne({
      _id: documentId,
      tenantId: user.tenantId
    });
    
    return !!doc;
  } catch (error) {
    console.error('Erro ao verificar pertencimento ao tenant:', error);
    return false;
  }
};

module.exports = {
  ensureTenantId,
  ensureTenantIdArray,
  validateTenantAccess,
  withTenantId,
  belongsToUserTenant
};
