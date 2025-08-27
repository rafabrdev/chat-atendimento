const corsService = require('../services/corsService');
const Tenant = require('../models/Tenant');

/**
 * Obter origens permitidas do tenant
 */
exports.getAllowedOrigins = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID é obrigatório'
      });
    }

    const origins = await corsService.getAllowedOrigins(tenantId);
    
    res.json({
      success: true,
      tenantId,
      origins,
      developmentOrigins: process.env.NODE_ENV === 'development' ? 
        corsService.getDevelopmentOrigins() : []
    });
  } catch (error) {
    console.error('Erro ao obter origens:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter origens permitidas'
    });
  }
};

/**
 * Adicionar nova origem permitida
 */
exports.addAllowedOrigin = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    const { origin } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID é obrigatório'
      });
    }

    if (!origin) {
      return res.status(400).json({
        success: false,
        error: 'Origem é obrigatória'
      });
    }

    const result = await corsService.addAllowedOrigin(tenantId, origin);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Erro ao adicionar origem:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Remover origem permitida
 */
exports.removeAllowedOrigin = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    const { origin } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID é obrigatório'
      });
    }

    if (!origin) {
      return res.status(400).json({
        success: false,
        error: 'Origem é obrigatória'
      });
    }

    const result = await corsService.removeAllowedOrigin(tenantId, origin);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Erro ao remover origem:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Atualizar lista completa de origens
 */
exports.setAllowedOrigins = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    const { origins } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID é obrigatório'
      });
    }

    if (!Array.isArray(origins)) {
      return res.status(400).json({
        success: false,
        error: 'Origens deve ser um array'
      });
    }

    const result = await corsService.setAllowedOrigins(tenantId, origins);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Erro ao atualizar origens:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Validar origem para o tenant atual
 */
exports.validateOrigin = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    const { origin } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID é obrigatório'
      });
    }

    if (!origin) {
      return res.status(400).json({
        success: false,
        error: 'Origem é obrigatória'
      });
    }

    const result = await corsService.validateRequest(origin, tenantId);
    
    res.json({
      success: true,
      origin,
      ...result
    });
  } catch (error) {
    console.error('Erro ao validar origem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao validar origem'
    });
  }
};

/**
 * Obter estatísticas de acesso CORS
 */
exports.getCorsStats = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    const stats = corsService.getStats(tenantId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estatísticas'
    });
  }
};

/**
 * Limpar estatísticas de acesso
 */
exports.clearCorsStats = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    corsService.clearStats(tenantId);
    
    res.json({
      success: true,
      message: tenantId ? 
        `Estatísticas do tenant ${tenantId} foram limpas` : 
        'Todas as estatísticas foram limpas'
    });
  } catch (error) {
    console.error('Erro ao limpar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar estatísticas'
    });
  }
};

/**
 * Obter sugestões de origens baseado em bloqueios
 */
exports.getSuggestedOrigins = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID é obrigatório'
      });
    }

    const suggestions = await corsService.getSuggestedOrigins(tenantId);
    
    res.json({
      success: true,
      tenantId,
      suggestions
    });
  } catch (error) {
    console.error('Erro ao obter sugestões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter sugestões'
    });
  }
};

/**
 * Limpar cache de origens
 */
exports.clearCache = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.tenantId;
    corsService.clearCache(tenantId);
    
    res.json({
      success: true,
      message: tenantId ? 
        `Cache do tenant ${tenantId} foi limpo` : 
        'Todo o cache foi limpo'
    });
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache'
    });
  }
};

/**
 * Health check do serviço CORS
 */
exports.getCorsHealth = async (req, res) => {
  try {
    const health = corsService.getHealth();
    
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('Erro ao verificar saúde:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar saúde do serviço'
    });
  }
};

/**
 * Teste de CORS - endpoint para testar configurações
 */
exports.testCors = async (req, res) => {
  const origin = req.headers.origin || req.headers.referer;
  const tenantId = req.tenantId;
  
  res.json({
    success: true,
    message: 'CORS test successful',
    origin,
    tenantId,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent']
    },
    tenant: req.tenant ? {
      id: req.tenant._id,
      slug: req.tenant.slug,
      allowedOrigins: req.tenant.allowedOrigins
    } : null
  });
};
