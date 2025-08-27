/**
 * Utilities e helpers para trabalhar com tenant scope no Mongoose
 * 
 * Este arquivo fornece funções auxiliares para facilitar operações
 * multi-tenant, incluindo bypass temporário e queries cross-tenant
 */

const mongoose = require('mongoose');

/**
 * Classe para gerenciar contexto de tenant
 */
class TenantContext {
  constructor() {
    this.stack = [];
    this.currentTenantId = null;
  }
  
  /**
   * Define o tenant atual
   */
  set(tenantId) {
    this.stack.push(this.currentTenantId);
    this.currentTenantId = tenantId;
    this._applyToModels(tenantId);
  }
  
  /**
   * Obtém o tenant atual
   */
  get() {
    return this.currentTenantId;
  }
  
  /**
   * Restaura o tenant anterior
   */
  restore() {
    this.currentTenantId = this.stack.pop() || null;
    this._applyToModels(this.currentTenantId);
  }
  
  /**
   * Limpa o contexto
   */
  clear() {
    this.stack = [];
    this.currentTenantId = null;
    this._clearModels();
  }
  
  /**
   * Aplica tenantId a todos os modelos
   */
  _applyToModels(tenantId) {
    mongoose.modelNames().forEach(modelName => {
      const Model = mongoose.model(modelName);
      if (tenantId) {
        Model._tenantId = tenantId;
      } else {
        delete Model._tenantId;
      }
    });
  }
  
  /**
   * Limpa tenantId de todos os modelos
   */
  _clearModels() {
    mongoose.modelNames().forEach(modelName => {
      const Model = mongoose.model(modelName);
      delete Model._tenantId;
      delete Model._bypassTenantScope;
    });
  }
}

// Instância global do contexto
const globalTenantContext = new TenantContext();

/**
 * Executa uma operação com um tenant específico
 */
async function runWithTenant(tenantId, operation) {
  globalTenantContext.set(tenantId);
  
  try {
    const result = await operation();
    return result;
  } finally {
    globalTenantContext.restore();
  }
}

/**
 * Executa uma operação sem filtro de tenant (bypass)
 */
async function runWithoutTenant(operation) {
  // Salvar estado atual
  const models = mongoose.modelNames();
  const savedStates = new Map();
  
  models.forEach(modelName => {
    const Model = mongoose.model(modelName);
    savedStates.set(modelName, {
      tenantId: Model._tenantId,
      bypass: Model._bypassTenantScope
    });
    
    // Habilitar bypass
    Model._bypassTenantScope = true;
    delete Model._tenantId;
  });
  
  try {
    const result = await operation();
    return result;
  } finally {
    // Restaurar estado
    models.forEach(modelName => {
      const Model = mongoose.model(modelName);
      const state = savedStates.get(modelName);
      
      if (state.tenantId) {
        Model._tenantId = state.tenantId;
      } else {
        delete Model._tenantId;
      }
      
      if (state.bypass) {
        Model._bypassTenantScope = state.bypass;
      } else {
        delete Model._bypassTenantScope;
      }
    });
  }
}

/**
 * Cria uma sessão de transação com tenant scope
 */
async function createTenantSession(tenantId) {
  const session = await mongoose.startSession();
  
  // Adicionar tenantId à sessão para uso posterior
  session.tenantId = tenantId;
  
  // Override do método withTransaction para incluir tenant
  const originalWithTransaction = session.withTransaction.bind(session);
  
  session.withTransaction = async function(fn, options) {
    return originalWithTransaction(async () => {
      return runWithTenant(tenantId, fn);
    }, options);
  };
  
  return session;
}

/**
 * Helper para criar query com tenant específico
 */
function createTenantQuery(Model, tenantId, filter = {}) {
  const query = { ...filter, tenantId };
  return Model.find(query);
}

/**
 * Helper para agregar dados por tenant
 */
async function aggregateByTenant(Model, pipeline = []) {
  // Adicionar grupo por tenant como primeiro estágio
  const fullPipeline = [
    {
      $group: {
        _id: '$tenantId',
        count: { $sum: 1 },
        data: { $push: '$$ROOT' }
      }
    },
    ...pipeline
  ];
  
  return Model.aggregate(fullPipeline);
}

/**
 * Helper para copiar dados entre tenants
 */
async function copyDataBetweenTenants(Model, sourceTenantId, targetTenantId, filter = {}) {
  const sourceData = await runWithTenant(sourceTenantId, async () => {
    return Model.find(filter).lean();
  });
  
  const copiedData = [];
  
  await runWithTenant(targetTenantId, async () => {
    for (const item of sourceData) {
      // Remover campos únicos
      delete item._id;
      delete item.createdAt;
      delete item.updatedAt;
      delete item.__v;
      
      // Atualizar tenantId
      item.tenantId = targetTenantId;
      
      // Criar novo documento
      const newItem = await Model.create(item);
      copiedData.push(newItem);
    }
  });
  
  return copiedData;
}

/**
 * Helper para verificar isolamento de tenant
 */
async function verifyTenantIsolation(Model, tenantId) {
  // Verificar se todos os documentos têm o tenantId correto
  const incorrectDocs = await runWithoutTenant(async () => {
    return Model.find({
      tenantId: { $ne: tenantId }
    }).limit(10);
  });
  
  if (incorrectDocs.length > 0) {
    return {
      isolated: false,
      incorrectCount: incorrectDocs.length,
      samples: incorrectDocs
    };
  }
  
  return {
    isolated: true,
    incorrectCount: 0,
    samples: []
  };
}

/**
 * Helper para limpar dados de um tenant
 */
async function cleanupTenant(tenantId, options = {}) {
  const { 
    excludeModels = ['Tenant'], 
    dryRun = false 
  } = options;
  
  const results = {};
  
  for (const modelName of mongoose.modelNames()) {
    if (excludeModels.includes(modelName)) {
      continue;
    }
    
    const Model = mongoose.model(modelName);
    
    // Contar documentos
    const count = await Model.countDocuments({ tenantId });
    
    if (count > 0) {
      if (dryRun) {
        results[modelName] = { count, deleted: false };
      } else {
        const deleteResult = await Model.deleteMany({ tenantId });
        results[modelName] = { 
          count, 
          deleted: true, 
          deletedCount: deleteResult.deletedCount 
        };
      }
    }
  }
  
  return results;
}

/**
 * Helper para migrar tenant
 */
async function migrateTenant(oldTenantId, newTenantId, options = {}) {
  const { 
    excludeModels = ['Tenant'],
    batchSize = 100 
  } = options;
  
  const results = {};
  
  for (const modelName of mongoose.modelNames()) {
    if (excludeModels.includes(modelName)) {
      continue;
    }
    
    const Model = mongoose.model(modelName);
    
    // Atualizar em lotes
    let updated = 0;
    let hasMore = true;
    
    while (hasMore) {
      const batch = await Model.find({ tenantId: oldTenantId })
        .limit(batchSize);
      
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const doc of batch) {
        doc.tenantId = newTenantId;
        await doc.save();
        updated++;
      }
    }
    
    results[modelName] = { updated };
  }
  
  return results;
}

/**
 * Helper para estatísticas por tenant
 */
async function getTenantStatistics(tenantId) {
  const stats = {
    tenantId,
    collections: {}
  };
  
  for (const modelName of mongoose.modelNames()) {
    if (modelName === 'Tenant') continue;
    
    const Model = mongoose.model(modelName);
    
    try {
      const count = await Model.countDocuments({ tenantId });
      if (count > 0) {
        stats.collections[modelName] = {
          count,
          lastCreated: await Model.findOne({ tenantId })
            .sort('-createdAt')
            .select('createdAt')
            .lean(),
          lastUpdated: await Model.findOne({ tenantId })
            .sort('-updatedAt')
            .select('updatedAt')
            .lean()
        };
      }
    } catch (error) {
      // Modelo pode não ter tenantId
      stats.collections[modelName] = { error: error.message };
    }
  }
  
  return stats;
}

/**
 * Middleware Express melhorado para tenant context
 */
function tenantContextMiddleware(req, res, next) {
  if (req.tenantId && !req.isMaster) {
    globalTenantContext.set(req.tenantId);
    
    // Limpar ao final da requisição
    res.on('finish', () => {
      globalTenantContext.clear();
    });
  }
  
  // Adicionar helpers ao request
  req.runWithTenant = (tenantId, operation) => runWithTenant(tenantId, operation);
  req.runWithoutTenant = (operation) => runWithoutTenant(operation);
  req.getTenantContext = () => globalTenantContext.get();
  
  next();
}

module.exports = {
  TenantContext,
  globalTenantContext,
  runWithTenant,
  runWithoutTenant,
  createTenantSession,
  createTenantQuery,
  aggregateByTenant,
  copyDataBetweenTenants,
  verifyTenantIsolation,
  cleanupTenant,
  migrateTenant,
  getTenantStatistics,
  tenantContextMiddleware
};
