const Tenant = require('../models/Tenant');
const NodeCache = require('node-cache');
const { URL } = require('url');

/**
 * Serviço de gerenciamento de CORS por tenant
 * Fornece funcionalidades avançadas para gerenciar origens permitidas
 */
class CorsService {
  constructor() {
    // Cache com TTL de 5 minutos
    this.cache = new NodeCache({ 
      stdTTL: 300, 
      checkperiod: 60,
      useClones: false 
    });
    
    // Origens sempre permitidas em desenvolvimento
    this.developmentOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];

    // Estatísticas de acesso
    this.stats = {
      allowed: new Map(),
      blocked: new Map(),
      tenantRequests: new Map()
    };
  }

  /**
   * Obter origens permitidas de um tenant com cache
   */
  async getAllowedOrigins(tenantId) {
    const cacheKey = `origins_${tenantId}`;
    
    // Verificar cache
    let origins = this.cache.get(cacheKey);
    if (origins !== undefined) {
      return origins;
    }

    // Buscar no banco
    try {
      const tenant = await Tenant.findById(tenantId)
        .select('allowedOrigins domain')
        .lean();
      
      origins = tenant?.allowedOrigins || [];
      
      // Adicionar domínio principal do tenant se configurado
      if (tenant?.domain) {
        origins.push(`https://${tenant.domain}`);
        origins.push(`http://${tenant.domain}`); // Para desenvolvimento
      }
      
      // Cachear resultado
      this.cache.set(cacheKey, origins);
      
      return origins;
    } catch (error) {
      console.error('[CorsService] Erro ao buscar tenant:', error);
      return [];
    }
  }

  /**
   * Validar se uma origem é permitida com suporte avançado
   */
  isOriginAllowed(origin, allowedOrigins) {
    if (!origin) return false;

    for (const allowed of allowedOrigins) {
      // Wildcard completo
      if (allowed === '*') return true;

      // Comparação exata
      if (allowed === origin) return true;

      // Suporte a wildcard de subdomínio (*.example.com)
      if (allowed.startsWith('*.')) {
        try {
          const domain = allowed.slice(2);
          const originUrl = new URL(origin);
          if (originUrl.hostname.endsWith(domain)) {
            return true;
          }
        } catch (e) {
          // URL inválida
          continue;
        }
      }

      // Suporte a regex (formato: /pattern/)
      if (allowed.startsWith('/') && allowed.endsWith('/')) {
        try {
          const pattern = allowed.slice(1, -1);
          const regex = new RegExp(pattern);
          if (regex.test(origin)) return true;
        } catch (e) {
          console.error('[CorsService] Regex inválida:', allowed);
        }
      }

      // Suporte a porta wildcard (http://localhost:*)
      if (allowed.includes(':*')) {
        const baseUrl = allowed.replace(':*', '');
        if (origin.startsWith(baseUrl + ':')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Adicionar origem permitida a um tenant
   */
  async addAllowedOrigin(tenantId, origin) {
    // Validar formato da origem
    if (!this.isValidOrigin(origin)) {
      throw new Error(`Origem inválida: ${origin}`);
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    // Verificar se já existe
    if (tenant.allowedOrigins.includes(origin)) {
      return { message: 'Origem já está na lista', origins: tenant.allowedOrigins };
    }

    // Adicionar origem
    tenant.allowedOrigins.push(origin);
    await tenant.save();

    // Limpar cache
    this.clearCache(tenantId);

    return { 
      message: 'Origem adicionada com sucesso', 
      origins: tenant.allowedOrigins 
    };
  }

  /**
   * Remover origem permitida de um tenant
   */
  async removeAllowedOrigin(tenantId, origin) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    const index = tenant.allowedOrigins.indexOf(origin);
    if (index === -1) {
      throw new Error('Origem não encontrada na lista');
    }

    // Remover origem
    tenant.allowedOrigins.splice(index, 1);
    await tenant.save();

    // Limpar cache
    this.clearCache(tenantId);

    return { 
      message: 'Origem removida com sucesso', 
      origins: tenant.allowedOrigins 
    };
  }

  /**
   * Atualizar lista completa de origens permitidas
   */
  async setAllowedOrigins(tenantId, origins) {
    // Validar todas as origens
    for (const origin of origins) {
      if (!this.isValidOrigin(origin)) {
        throw new Error(`Origem inválida: ${origin}`);
      }
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    // Atualizar origens
    tenant.allowedOrigins = origins;
    await tenant.save();

    // Limpar cache
    this.clearCache(tenantId);

    return { 
      message: 'Origens atualizadas com sucesso', 
      origins: tenant.allowedOrigins 
    };
  }

  /**
   * Validar formato de origem
   */
  isValidOrigin(origin) {
    // Wildcard completo
    if (origin === '*') return true;

    // Regex pattern
    if (origin.startsWith('/') && origin.endsWith('/')) {
      try {
        new RegExp(origin.slice(1, -1));
        return true;
      } catch (e) {
        return false;
      }
    }

    // Wildcard de subdomínio
    if (origin.startsWith('*.')) {
      const domain = origin.slice(2);
      return /^[a-zA-Z0-9.-]+$/.test(domain);
    }

    // URL com porta wildcard
    if (origin.includes(':*')) {
      const baseUrl = origin.replace(':*', '');
      try {
        new URL(baseUrl + ':3000'); // Testar com porta dummy
        return true;
      } catch (e) {
        return false;
      }
    }

    // URL normal
    try {
      new URL(origin);
      return true;
    } catch (e) {
      // Tentar localhost sem protocolo
      if (origin.match(/^localhost:\d+$/)) {
        return true;
      }
      return false;
    }
  }

  /**
   * Obter origens permitidas em desenvolvimento
   */
  getDevelopmentOrigins() {
    if (process.env.NODE_ENV === 'development') {
      return this.developmentOrigins;
    }
    return [];
  }

  /**
   * Registrar tentativa de acesso (para análise)
   */
  logAccess(origin, tenantId, allowed) {
    const key = `${tenantId}_${origin}`;
    
    if (allowed) {
      const count = this.stats.allowed.get(key) || 0;
      this.stats.allowed.set(key, count + 1);
    } else {
      const count = this.stats.blocked.get(key) || 0;
      this.stats.blocked.set(key, count + 1);
    }

    // Contar requisições por tenant
    const tenantCount = this.stats.tenantRequests.get(tenantId) || 0;
    this.stats.tenantRequests.set(tenantId, tenantCount + 1);
  }

  /**
   * Obter estatísticas de acesso
   */
  getStats(tenantId = null) {
    if (tenantId) {
      const allowed = [];
      const blocked = [];

      // Filtrar estatísticas por tenant
      for (const [key, count] of this.stats.allowed) {
        if (key.startsWith(`${tenantId}_`)) {
          const origin = key.replace(`${tenantId}_`, '');
          allowed.push({ origin, count });
        }
      }

      for (const [key, count] of this.stats.blocked) {
        if (key.startsWith(`${tenantId}_`)) {
          const origin = key.replace(`${tenantId}_`, '');
          blocked.push({ origin, count });
        }
      }

      return {
        tenantId,
        totalRequests: this.stats.tenantRequests.get(tenantId) || 0,
        allowed: allowed.sort((a, b) => b.count - a.count),
        blocked: blocked.sort((a, b) => b.count - a.count)
      };
    }

    // Estatísticas globais
    return {
      totalAllowed: this.stats.allowed.size,
      totalBlocked: this.stats.blocked.size,
      topAllowed: Array.from(this.stats.allowed.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => {
          const [tenantId, origin] = key.split('_');
          return { tenantId, origin, count };
        }),
      topBlocked: Array.from(this.stats.blocked.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => {
          const [tenantId, origin] = key.split('_');
          return { tenantId, origin, count };
        })
    };
  }

  /**
   * Limpar estatísticas
   */
  clearStats(tenantId = null) {
    if (tenantId) {
      // Limpar estatísticas de um tenant específico
      for (const key of this.stats.allowed.keys()) {
        if (key.startsWith(`${tenantId}_`)) {
          this.stats.allowed.delete(key);
        }
      }
      for (const key of this.stats.blocked.keys()) {
        if (key.startsWith(`${tenantId}_`)) {
          this.stats.blocked.delete(key);
        }
      }
      this.stats.tenantRequests.delete(tenantId);
    } else {
      // Limpar todas as estatísticas
      this.stats.allowed.clear();
      this.stats.blocked.clear();
      this.stats.tenantRequests.clear();
    }
  }

  /**
   * Validar CORS para uma requisição
   */
  async validateRequest(origin, tenantId) {
    if (!origin) {
      // Sem origem (ferramentas, Postman, etc)
      return { allowed: true, reason: 'No origin header' };
    }

    // Em desenvolvimento, permitir origens locais
    if (process.env.NODE_ENV === 'development') {
      if (this.developmentOrigins.some(dev => origin.startsWith(dev))) {
        this.logAccess(origin, tenantId, true);
        return { allowed: true, reason: 'Development origin' };
      }
    }

    // Obter origens permitidas do tenant
    const allowedOrigins = await this.getAllowedOrigins(tenantId);
    
    // Adicionar origens de desenvolvimento se aplicável
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push(...this.developmentOrigins);
    }

    // Validar origem
    const allowed = this.isOriginAllowed(origin, allowedOrigins);
    
    // Registrar acesso
    this.logAccess(origin, tenantId, allowed);

    return {
      allowed,
      reason: allowed ? 'Origin allowed' : 'Origin not in whitelist',
      allowedOrigins: allowed ? undefined : allowedOrigins
    };
  }

  /**
   * Sugerir origens baseado em tentativas bloqueadas
   */
  async getSuggestedOrigins(tenantId) {
    const suggestions = [];
    
    // Buscar origens bloqueadas frequentemente
    for (const [key, count] of this.stats.blocked) {
      if (key.startsWith(`${tenantId}_`) && count >= 5) {
        const origin = key.replace(`${tenantId}_`, '');
        suggestions.push({
          origin,
          blockedCount: count,
          suggestion: this.generateSuggestion(origin)
        });
      }
    }

    return suggestions.sort((a, b) => b.blockedCount - a.blockedCount);
  }

  /**
   * Gerar sugestão de padrão para origem
   */
  generateSuggestion(origin) {
    try {
      const url = new URL(origin);
      
      // Se for localhost com porta diferente
      if (url.hostname === 'localhost') {
        return 'localhost:*';
      }
      
      // Se for subdomínio
      const parts = url.hostname.split('.');
      if (parts.length > 2) {
        const domain = parts.slice(-2).join('.');
        return `*.${domain}`;
      }
      
      return origin;
    } catch (e) {
      return origin;
    }
  }

  /**
   * Limpar cache de um tenant
   */
  clearCache(tenantId = null) {
    if (tenantId) {
      this.cache.del(`origins_${tenantId}`);
    } else {
      this.cache.flushAll();
    }
  }

  /**
   * Verificar saúde do serviço
   */
  getHealth() {
    return {
      status: 'healthy',
      cache: {
        keys: this.cache.keys().length,
        stats: this.cache.getStats()
      },
      stats: {
        totalAllowed: this.stats.allowed.size,
        totalBlocked: this.stats.blocked.size,
        tenants: this.stats.tenantRequests.size
      }
    };
  }
}

// Singleton
const corsService = new CorsService();

module.exports = corsService;
