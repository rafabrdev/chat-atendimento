/**
 * Plugin Mongoose para Multi-Tenancy
 * 
 * Este plugin adiciona automaticamente o escopo de tenant em todas as operações do Mongoose,
 * garantindo isolamento completo de dados entre tenants.
 * 
 * Funcionalidades:
 * - Adiciona tenantId automaticamente em criação
 * - Filtra por tenantId em todas as queries
 * - Previne atualizações cross-tenant
 * - Suporta bypass para operações administrativas
 */

const mongoose = require('mongoose');

/**
 * Plugin principal de tenant scope
 */
function tenantScopePlugin(schema, options = {}) {
  // Configurações do plugin
  const defaults = {
    tenantIdField: 'tenantId',
    tenantIdType: mongoose.Schema.Types.ObjectId,
    indexTenant: true,
    required: true,
    allowCrossTenant: false,
    excludePaths: [],
    tenantRef: 'Tenant'
  };
  
  const settings = { ...defaults, ...options };
  
  // Adicionar campo tenantId ao schema se não existir
  if (!schema.paths[settings.tenantIdField]) {
    const tenantField = {};
    tenantField[settings.tenantIdField] = {
      type: settings.tenantIdType,
      ref: settings.tenantRef,
      required: settings.required,
      index: settings.indexTenant
    };
    schema.add(tenantField);
  }
  
  // Adicionar índice composto com tenantId se configurado
  if (settings.indexTenant) {
    // Índice simples no tenantId
    const tenantIndex = {};
    tenantIndex[settings.tenantIdField] = 1;
    schema.index(tenantIndex);
    
    // Adicionar índices compostos comuns
    if (schema.paths.createdAt) {
      const createdIndex = {};
      createdIndex[settings.tenantIdField] = 1;
      createdIndex.createdAt = -1;
      schema.index(createdIndex);
    }
    
    if (schema.paths.status) {
      const statusIndex = {};
      statusIndex[settings.tenantIdField] = 1;
      statusIndex.status = 1;
      schema.index(statusIndex);
    }
  }
  
  // Helper para obter tenantId do contexto
  function getTenantId(context) {
    // Verificar se há bypass ativo
    if (context._bypassTenantScope) {
      return null;
    }
    
    // Tentar obter de diferentes fontes
    // 1. Da própria query
    if (context._tenantId) {
      return context._tenantId;
    }
    
    // 2. Do Model (quando usado com setTenantContext)
    if (context.model && context.model._tenantId) {
      return context.model._tenantId;
    }
    
    // 3. Do constructor para operações de documento
    if (context.constructor && context.constructor._tenantId) {
      return context.constructor._tenantId;
    }
    
    // 4. Das opções da query
    if (context.options?.tenantId) {
      return context.options.tenantId;
    }
    
    if (context.getOptions?.()?.tenantId) {
      return context.getOptions().tenantId;
    }
    
    return null;
  }
  
  // Helper para aplicar filtro de tenant
  function applyTenantFilter(query, tenantId) {
    if (!tenantId || query._bypassTenantScope) {
      return;
    }
    
    const conditions = query.getQuery();
    
    // Se já tem filtro de tenant, não sobrescrever
    if (conditions[settings.tenantIdField]) {
      return;
    }
    
    // Adicionar filtro de tenant
    conditions[settings.tenantIdField] = tenantId;
    query.setQuery(conditions);
  }
  
  // ===== PRE HOOKS =====
  
  // Pre-save: adicionar tenantId automaticamente
  schema.pre('save', function(next) {
    // Se for novo documento e não tem tenantId
    if (this.isNew && !this[settings.tenantIdField]) {
      const tenantId = getTenantId(this);
      
      if (tenantId) {
        this[settings.tenantIdField] = tenantId;
      } else if (settings.required && !this._bypassTenantScope) {
        return next(new Error(`${settings.tenantIdField} é obrigatório`));
      }
    }
    next();
  });
  
  // Pre-find hooks: aplicar filtro de tenant
  const findHooks = [
    'find',
    'findOne',
    'findOneAndDelete',
    'findOneAndRemove',
    'findOneAndUpdate',
    'findOneAndReplace',
    'count',
    'countDocuments',
    'distinct',
    'deleteOne',
    'deleteMany',
    'replaceOne'
  ];
  
  findHooks.forEach(method => {
    schema.pre(method, function() {
      const tenantId = getTenantId(this);
      if (tenantId) {
        applyTenantFilter(this, tenantId);
      }
    });
  });
  
  // Pre-update hooks: aplicar filtro e prevenir modificação do tenantId
  const updateHooks = ['update', 'updateOne', 'updateMany', 'findOneAndUpdate'];
  
  updateHooks.forEach(method => {
    schema.pre(method, function() {
      const tenantId = getTenantId(this);
      
      if (tenantId) {
        // Aplicar filtro na query
        applyTenantFilter(this, tenantId);
      }
      
      // SEMPRE prevenir modificação do tenantId (mesmo sem contexto)
      const update = this.getUpdate();
      if (update) {
        // Remover tenantId de $set se existir
        if (update.$set && settings.tenantIdField in update.$set) {
          console.log(`[TenantPlugin] Bloqueando tentativa de modificar ${settings.tenantIdField}`);
          delete update.$set[settings.tenantIdField];
        }
        
        // Remover tenantId de $unset se existir
        if (update.$unset && settings.tenantIdField in update.$unset) {
          console.log(`[TenantPlugin] Bloqueando tentativa de remover ${settings.tenantIdField}`);
          delete update.$unset[settings.tenantIdField];
        }
        
        // Remover de outras operações também
        if (update[settings.tenantIdField]) {
          console.log(`[TenantPlugin] Bloqueando modificação direta de ${settings.tenantIdField}`);
          delete update[settings.tenantIdField];
        }
      }
    });
  });
  
  // Pre-aggregate: adicionar $match com tenantId
  schema.pre('aggregate', function() {
    // Para aggregate, precisa acessar o model de forma diferente
    let tenantId = this._tenantId;
    
    // Se não encontrou na query, tentar no model
    if (!tenantId && this._model && this._model._tenantId) {
      tenantId = this._model._tenantId;
    }
    
    // Tentar também via this.model (pode variar dependendo da versão do Mongoose)
    if (!tenantId && this.model && this.model()._tenantId) {
      tenantId = this.model()._tenantId;
    }
    
    if (tenantId && !this._bypassTenantScope) {
      // Adicionar $match como primeiro estágio
      const matchStage = {};
      matchStage[settings.tenantIdField] = tenantId;
      
      this.pipeline().unshift({ $match: matchStage });
    }
  });
  
  // ===== MÉTODOS ESTÁTICOS =====
  
  /**
   * Encontrar documentos com bypass de tenant (admin only)
   */
  schema.statics.findWithoutTenant = function(filter = {}, options = {}) {
    const query = this.find(filter, null, options);
    query._bypassTenantScope = true;
    return query;
  };
  
  /**
   * Encontrar documentos de um tenant específico
   */
  schema.statics.findByTenant = function(tenantId, filter = {}, options = {}) {
    const conditions = { ...filter };
    conditions[settings.tenantIdField] = tenantId;
    return this.find(conditions, null, options);
  };
  
  /**
   * Contar documentos por tenant
   */
  schema.statics.countByTenant = async function(tenantId) {
    const conditions = {};
    conditions[settings.tenantIdField] = tenantId;
    return this.countDocuments(conditions);
  };
  
  /**
   * Criar documento com tenant específico
   */
  schema.statics.createWithTenant = function(tenantId, data) {
    const docData = { ...data };
    docData[settings.tenantIdField] = tenantId;
    return this.create(docData);
  };
  
  /**
   * Agregar com bypass de tenant
   */
  schema.statics.aggregateWithoutTenant = function(pipeline) {
    const agg = this.aggregate(pipeline);
    agg._bypassTenantScope = true;
    return agg;
  };
  
  // ===== MÉTODOS DE INSTÂNCIA =====
  
  /**
   * Verificar se documento pertence a um tenant
   */
  schema.methods.belongsToTenant = function(tenantId) {
    return this[settings.tenantIdField]?.toString() === tenantId?.toString();
  };
  
  /**
   * Clonar documento para outro tenant
   */
  schema.methods.cloneToTenant = async function(targetTenantId) {
    const data = this.toObject();
    delete data._id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.__v;
    
    data[settings.tenantIdField] = targetTenantId;
    
    const Model = this.constructor;
    return new Model(data);
  };
  
  // ===== MÉTODOS DE QUERY =====
  
  /**
   * Desabilitar filtro de tenant para esta query
   */
  schema.query.withoutTenant = function() {
    this._bypassTenantScope = true;
    return this;
  };
  
  /**
   * Forçar tenant específico para esta query
   */
  schema.query.forTenant = function(tenantId) {
    const conditions = this.getQuery();
    conditions[settings.tenantIdField] = tenantId;
    this.setQuery(conditions);
    return this;
  };
  
  // ===== VIRTUAL PARA POPULAR TENANT =====
  
  schema.virtual('tenant', {
    ref: settings.tenantRef,
    localField: settings.tenantIdField,
    foreignField: '_id',
    justOne: true
  });
}

/**
 * Função helper para configurar contexto de tenant
 */
function setTenantContext(Model, tenantId) {
  // Armazenar tenantId no modelo para uso posterior
  Model._tenantId = tenantId;
  
  // Retornar função para limpar contexto
  return () => {
    delete Model._tenantId;
  };
}

/**
 * Middleware Express para injetar tenant no Mongoose
 */
function mongooseTenantMiddleware(req, res, next) {
  // Obter todos os modelos do Mongoose
  const models = mongoose.modelNames();
  
  // Se há tenantId no request, configurar contexto
  if (req.tenantId && !req.isMaster) {
    models.forEach(modelName => {
      const Model = mongoose.model(modelName);
      Model._tenantId = req.tenantId;
    });
    
    // Limpar contexto após resposta
    res.on('finish', () => {
      models.forEach(modelName => {
        const Model = mongoose.model(modelName);
        delete Model._tenantId;
      });
    });
  }
  
  next();
}

/**
 * Decorator para operações com tenant específico
 */
function withTenant(tenantId, operation) {
  return async function(...args) {
    // Salvar contexto anterior
    const previousTenantId = this._tenantId;
    
    // Definir novo contexto
    this._tenantId = tenantId;
    
    try {
      // Executar operação
      return await operation.apply(this, args);
    } finally {
      // Restaurar contexto anterior
      if (previousTenantId) {
        this._tenantId = previousTenantId;
      } else {
        delete this._tenantId;
      }
    }
  };
}

/**
 * Helper para operações administrativas sem tenant
 */
function withoutTenant(operation) {
  return async function(...args) {
    // Salvar contexto anterior
    const previousTenantId = this._tenantId;
    const previousBypass = this._bypassTenantScope;
    
    // Habilitar bypass
    this._bypassTenantScope = true;
    delete this._tenantId;
    
    try {
      // Executar operação
      return await operation.apply(this, args);
    } finally {
      // Restaurar contexto anterior
      this._bypassTenantScope = previousBypass;
      if (previousTenantId) {
        this._tenantId = previousTenantId;
      }
    }
  };
}

module.exports = {
  tenantScopePlugin,
  setTenantContext,
  mongooseTenantMiddleware,
  withTenant,
  withoutTenant
};
