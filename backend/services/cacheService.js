/**
 * Cache Service
 * 
 * Serviço de cache usando Redis quando disponível
 * Fallback para cache in-memory quando Redis não está disponível
 */

const EventEmitter = require('events');

class CacheService extends EventEmitter {
  constructor() {
    super();
    this.memoryCache = new Map();
    this.defaultTTL = 300; // 5 minutos por padrão
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    // Tentar conectar ao Redis
    this.initRedis();
  }

  /**
   * Inicializa conexão com Redis se disponível
   */
  async initRedis() {
    // Skip Redis if explicitly disabled
    if (process.env.DISABLE_REDIS === 'true') {
      console.log('ℹ️ Cache: Redis disabled, using in-memory cache');
      this.redisClient = null;
      return;
    }

    // Skip Redis if no URL configured
    if (!process.env.REDIS_URL) {
      console.log('ℹ️ Cache: No Redis configured, using in-memory cache');
      this.redisClient = null;
      return;
    }

    try {
      const redis = require('redis');
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              console.log('⚠️ Cache: Redis unavailable, using in-memory cache');
              this.redisClient = null;
              return false;
            }
            return Math.min(retries * 100, 1000);
          }
        }
      });

      this.redisClient.on('error', (err) => {
        if (!this.redisErrorLogged) {
          console.log('⚠️ Cache: Redis error, using in-memory cache');
          this.redisErrorLogged = true;
        }
      });

      await this.redisClient.connect();
      console.log('✅ Redis cache connected');
      this.redisErrorLogged = false;
    } catch (error) {
      console.log('ℹ️ Cache: Redis not available, using in-memory cache');
      this.redisClient = null;
    }
  }

  /**
   * Define um valor no cache
   * @param {string} key - Chave do cache
   * @param {any} value - Valor a ser armazenado
   * @param {number} ttl - Tempo de vida em segundos (opcional)
   */
  async set(key, value, ttl = this.defaultTTL) {
    this.stats.sets++;
    
    // Serializar valor
    const serialized = JSON.stringify(value);
    
    if (this.redisClient) {
      try {
        await this.redisClient.setEx(key, ttl, serialized);
        this.emit('cache:set', { key, ttl });
        return true;
      } catch (error) {
        // Fallback para memória se Redis falhar
      }
    }
    
    // Cache in-memory
    this.memoryCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + (ttl * 1000)
    });
    
    // Limpar cache expirado periodicamente
    this.scheduleCleanup();
    
    return true;
  }

  /**
   * Obtém um valor do cache
   * @param {string} key - Chave do cache
   * @returns {Promise<any|null>} Valor ou null se não encontrado/expirado
   */
  async get(key) {
    if (this.redisClient) {
      try {
        const value = await this.redisClient.get(key);
        if (value) {
          this.stats.hits++;
          this.emit('cache:hit', { key });
          return JSON.parse(value);
        }
      } catch (error) {
        // Fallback para memória se Redis falhar
      }
    }
    
    // Buscar na memória
    const cached = this.memoryCache.get(key);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        this.stats.hits++;
        this.emit('cache:hit', { key });
        return JSON.parse(cached.value);
      } else {
        // Expirado, remover
        this.memoryCache.delete(key);
      }
    }
    
    this.stats.misses++;
    this.emit('cache:miss', { key });
    return null;
  }

  /**
   * Remove um valor do cache
   * @param {string} key - Chave do cache
   */
  async delete(key) {
    this.stats.deletes++;
    
    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        // Continuar mesmo se Redis falhar
      }
    }
    
    this.memoryCache.delete(key);
    this.emit('cache:delete', { key });
  }

  /**
   * Remove valores do cache por padrão
   * @param {string} pattern - Padrão de chaves (ex: 'tenant:123:*')
   */
  async deletePattern(pattern) {
    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
          this.stats.deletes += keys.length;
        }
      } catch (error) {
        // Continuar mesmo se Redis falhar
      }
    }
    
    // Para memória, fazer match manual
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*'));
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        this.stats.deletes++;
      }
    }
  }

  /**
   * Limpa todo o cache
   */
  async flush() {
    if (this.redisClient) {
      try {
        await this.redisClient.flushDb();
      } catch (error) {
        // Continuar mesmo se Redis falhar
      }
    }
    
    this.memoryCache.clear();
    this.emit('cache:flush');
  }

  /**
   * Obtém ou define um valor no cache
   * @param {string} key - Chave do cache
   * @param {Function} factory - Função para gerar o valor se não estiver em cache
   * @param {number} ttl - Tempo de vida em segundos
   */
  async getOrSet(key, factory, ttl = this.defaultTTL) {
    // Tentar obter do cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    // Gerar novo valor
    const value = await factory();
    
    // Armazenar no cache
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Cache específico para tenant
   * @param {string} tenantId - ID do tenant
   * @param {string} key - Chave do cache
   * @param {any} value - Valor (opcional para set)
   * @param {number} ttl - TTL em segundos
   */
  async tenantCache(tenantId, key, value = undefined, ttl = this.defaultTTL) {
    const tenantKey = `tenant:${tenantId}:${key}`;
    
    if (value !== undefined) {
      return this.set(tenantKey, value, ttl);
    }
    
    return this.get(tenantKey);
  }

  /**
   * Limpa cache de um tenant específico
   * @param {string} tenantId - ID do tenant
   */
  async clearTenantCache(tenantId) {
    await this.deletePattern(`tenant:${tenantId}:*`);
  }

  /**
   * Limpar entradas expiradas do cache in-memory
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Agenda limpeza de cache expirado
   */
  scheduleCleanup() {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setTimeout(() => {
      this.cleanupExpired();
      this.cleanupTimer = null;
    }, 60000); // Limpar a cada minuto
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
      
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      memoryCacheSize: this.memoryCache.size,
      backend: this.redisClient ? 'redis' : 'memory'
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }
}

// Singleton
module.exports = new CacheService();
