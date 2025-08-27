/**
 * Lock Service
 * 
 * Serviço para gerenciar locks distribuídos para evitar condições de corrida (race conditions)
 * Usa Redis quando disponível, ou fallback para locks in-memory
 */

const EventEmitter = require('events');

class LockService extends EventEmitter {
  constructor() {
    super();
    this.locks = new Map();
    this.lockQueue = new Map();
    this.lockTimeouts = new Map();
    this.defaultTTL = 30000; // 30 segundos por padrão
    this.stats = {
      acquired: 0,
      released: 0,
      expired: 0,
      conflicts: 0,
      queued: 0
    };
    
    // Desabilitar Redis por enquanto - usar apenas locks in-memory
    // this.initRedis();
    this.redisClient = null;
  }

  /**
   * Inicializa conexão com Redis se disponível
   */
  async initRedis() {
    try {
      const redis = require('redis');
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.log('⚠️ Redis unavailable, using in-memory locks');
              this.redisClient = null;
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis error:', err.message);
        this.redisClient = null;
      });

      await this.redisClient.connect();
      console.log('✅ Redis connected for distributed locks');
    } catch (error) {
      console.log('ℹ️ Redis not available, using in-memory locks');
      this.redisClient = null;
    }
  }

  /**
   * Adquire um lock exclusivo para um recurso
   * @param {string} resource - Identificador do recurso (ex: 'chat:123')
   * @param {string} holder - Identificador do detentor do lock (ex: 'user:456')
   * @param {Object} options - Opções do lock
   * @returns {Promise<{success: boolean, holder?: string, token?: string}>}
   */
  async acquire(resource, holder, options = {}) {
    const {
      ttl = this.defaultTTL,
      retry = true,
      maxRetries = 3,
      retryDelay = 100,
      queue = false
    } = options;

    const token = this.generateToken();
    const lockKey = `lock:${resource}`;

    // Tentar usar Redis se disponível
    if (this.redisClient) {
      return this.acquireRedisLock(lockKey, holder, token, ttl, retry, maxRetries, retryDelay);
    }

    // Fallback para lock in-memory
    return this.acquireMemoryLock(resource, holder, token, ttl, retry, maxRetries, retryDelay, queue);
  }

  /**
   * Adquire lock usando Redis
   */
  async acquireRedisLock(lockKey, holder, token, ttl, retry, maxRetries, retryDelay) {
    let attempts = 0;

    while (attempts <= maxRetries) {
      try {
        // SET NX EX - atômico no Redis
        const value = JSON.stringify({ holder, token, acquiredAt: Date.now() });
        const result = await this.redisClient.set(lockKey, value, {
          NX: true, // Apenas se não existir
          PX: ttl   // TTL em millisegundos
        });

        if (result === 'OK') {
          this.stats.acquired++;
          this.emit('lock:acquired', { resource: lockKey, holder, token });
          return { success: true, holder, token };
        }

        // Lock já existe, verificar holder
        const existing = await this.redisClient.get(lockKey);
        if (existing) {
          const lockData = JSON.parse(existing);
          if (lockData.holder === holder) {
            // Mesmo holder, renovar lock
            await this.redisClient.pExpire(lockKey, ttl);
            return { success: true, holder, token: lockData.token };
          }
        }

        this.stats.conflicts++;

        if (!retry || attempts >= maxRetries) {
          return { success: false, holder: existing ? JSON.parse(existing).holder : 'unknown' };
        }

        // Aguardar antes de tentar novamente
        await this.sleep(retryDelay * Math.pow(2, attempts)); // Exponential backoff
        attempts++;
      } catch (error) {
        console.error('Error acquiring Redis lock:', error);
        // Se Redis falhar, tentar fallback
        return this.acquireMemoryLock(lockKey.replace('lock:', ''), holder, token, ttl, retry, maxRetries, retryDelay, false);
      }
    }

    return { success: false, holder: 'timeout' };
  }

  /**
   * Adquire lock in-memory
   */
  async acquireMemoryLock(resource, holder, token, ttl, retry, maxRetries, retryDelay, queue) {
    let attempts = 0;

    while (attempts <= maxRetries) {
      const existing = this.locks.get(resource);

      if (!existing || existing.expiresAt < Date.now()) {
        // Lock disponível ou expirado
        if (existing && existing.expiresAt < Date.now()) {
          this.stats.expired++;
          this.emit('lock:expired', { resource, previousHolder: existing.holder });
        }

        const lockData = {
          holder,
          token,
          acquiredAt: Date.now(),
          expiresAt: Date.now() + ttl
        };

        this.locks.set(resource, lockData);
        this.stats.acquired++;

        // Configurar timeout para auto-release
        this.setLockTimeout(resource, ttl);

        this.emit('lock:acquired', { resource, holder, token });
        return { success: true, holder, token };
      }

      // Lock já existe
      if (existing.holder === holder) {
        // Mesmo holder, renovar lock
        existing.expiresAt = Date.now() + ttl;
        this.resetLockTimeout(resource, ttl);
        return { success: true, holder, token: existing.token };
      }

      this.stats.conflicts++;

      // Se queue está habilitado, adicionar à fila
      if (queue) {
        return this.queueLockRequest(resource, holder, token, ttl);
      }

      if (!retry || attempts >= maxRetries) {
        return { success: false, holder: existing.holder };
      }

      // Aguardar antes de tentar novamente
      await this.sleep(retryDelay * Math.pow(2, attempts));
      attempts++;
    }

    return { success: false, holder: 'timeout' };
  }

  /**
   * Libera um lock
   * @param {string} resource - Identificador do recurso
   * @param {string} token - Token do lock
   */
  async release(resource, token) {
    const lockKey = `lock:${resource}`;

    // Tentar liberar no Redis
    if (this.redisClient) {
      try {
        const existing = await this.redisClient.get(lockKey);
        if (existing) {
          const lockData = JSON.parse(existing);
          if (lockData.token === token) {
            await this.redisClient.del(lockKey);
            this.stats.released++;
            this.emit('lock:released', { resource, holder: lockData.holder });
            return { success: true };
          }
        }
        return { success: false, error: 'Invalid token or lock not found' };
      } catch (error) {
        console.error('Error releasing Redis lock:', error);
      }
    }

    // Fallback para memory
    const existing = this.locks.get(resource);
    if (!existing) {
      return { success: false, error: 'Lock not found' };
    }

    if (existing.token !== token) {
      return { success: false, error: 'Invalid token' };
    }

    this.locks.delete(resource);
    this.clearLockTimeout(resource);
    this.stats.released++;
    this.emit('lock:released', { resource, holder: existing.holder });

    // Processar fila se houver
    this.processQueue(resource);

    return { success: true };
  }

  /**
   * Verifica se um recurso está bloqueado
   * @param {string} resource - Identificador do recurso
   */
  async isLocked(resource) {
    const lockKey = `lock:${resource}`;

    if (this.redisClient) {
      try {
        const exists = await this.redisClient.exists(lockKey);
        return exists === 1;
      } catch (error) {
        console.error('Error checking Redis lock:', error);
      }
    }

    const lock = this.locks.get(resource);
    return !!(lock && lock.expiresAt > Date.now());
  }

  /**
   * Obtém informações sobre um lock
   * @param {string} resource - Identificador do recurso
   */
  async getLockInfo(resource) {
    const lockKey = `lock:${resource}`;

    if (this.redisClient) {
      try {
        const data = await this.redisClient.get(lockKey);
        if (data) {
          const parsed = JSON.parse(data);
          const ttl = await this.redisClient.pTTL(lockKey);
          return {
            ...parsed,
            remainingTTL: ttl > 0 ? ttl : 0
          };
        }
      } catch (error) {
        console.error('Error getting Redis lock info:', error);
      }
    }

    const lock = this.locks.get(resource);
    if (lock && lock.expiresAt > Date.now()) {
      return {
        ...lock,
        remainingTTL: lock.expiresAt - Date.now()
      };
    }

    return null;
  }

  /**
   * Renova um lock existente
   * @param {string} resource - Identificador do recurso
   * @param {string} token - Token do lock
   * @param {number} ttl - Novo TTL
   */
  async extend(resource, token, ttl = this.defaultTTL) {
    const lockKey = `lock:${resource}`;

    if (this.redisClient) {
      try {
        const existing = await this.redisClient.get(lockKey);
        if (existing) {
          const lockData = JSON.parse(existing);
          if (lockData.token === token) {
            await this.redisClient.pExpire(lockKey, ttl);
            return { success: true, newTTL: ttl };
          }
        }
      } catch (error) {
        console.error('Error extending Redis lock:', error);
      }
    }

    const lock = this.locks.get(resource);
    if (!lock || lock.token !== token) {
      return { success: false, error: 'Invalid token or lock not found' };
    }

    lock.expiresAt = Date.now() + ttl;
    this.resetLockTimeout(resource, ttl);
    return { success: true, newTTL: ttl };
  }

  /**
   * Adiciona requisição de lock à fila
   */
  async queueLockRequest(resource, holder, token, ttl) {
    if (!this.lockQueue.has(resource)) {
      this.lockQueue.set(resource, []);
    }

    const queue = this.lockQueue.get(resource);
    const request = {
      holder,
      token,
      ttl,
      timestamp: Date.now(),
      promise: null
    };

    // Criar promise para o request
    const promise = new Promise((resolve) => {
      request.resolve = resolve;
    });
    request.promise = promise;

    queue.push(request);
    this.stats.queued++;
    this.emit('lock:queued', { resource, holder, position: queue.length });

    return promise;
  }

  /**
   * Processa fila de locks
   */
  processQueue(resource) {
    const queue = this.lockQueue.get(resource);
    if (!queue || queue.length === 0) {
      return;
    }

    const next = queue.shift();
    if (queue.length === 0) {
      this.lockQueue.delete(resource);
    }

    // Tentar adquirir lock para o próximo da fila
    this.acquire(resource, next.holder, { ttl: next.ttl, retry: false })
      .then(result => {
        if (result.success) {
          next.resolve({ success: true, holder: next.holder, token: result.token });
        } else {
          next.resolve({ success: false, holder: result.holder });
        }
      });
  }

  /**
   * Configura timeout para auto-release
   */
  setLockTimeout(resource, ttl) {
    this.clearLockTimeout(resource);
    
    const timeout = setTimeout(() => {
      const lock = this.locks.get(resource);
      if (lock) {
        this.locks.delete(resource);
        this.stats.expired++;
        this.emit('lock:expired', { resource, holder: lock.holder });
        this.processQueue(resource);
      }
    }, ttl);

    this.lockTimeouts.set(resource, timeout);
  }

  /**
   * Limpa timeout de um lock
   */
  clearLockTimeout(resource) {
    const timeout = this.lockTimeouts.get(resource);
    if (timeout) {
      clearTimeout(timeout);
      this.lockTimeouts.delete(resource);
    }
  }

  /**
   * Reseta timeout de um lock
   */
  resetLockTimeout(resource, ttl) {
    this.setLockTimeout(resource, ttl);
  }

  /**
   * Gera token único
   */
  generateToken() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Limpa todos os locks (use com cuidado!)
   */
  async clearAll() {
    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys('lock:*');
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (error) {
        console.error('Error clearing Redis locks:', error);
      }
    }

    this.locks.clear();
    this.lockQueue.clear();
    this.lockTimeouts.forEach(timeout => clearTimeout(timeout));
    this.lockTimeouts.clear();
  }

  /**
   * Obtém estatísticas do serviço
   */
  getStats() {
    return {
      ...this.stats,
      currentLocks: this.locks.size,
      queuedRequests: Array.from(this.lockQueue.values()).reduce((sum, q) => sum + q.length, 0),
      backend: this.redisClient ? 'redis' : 'memory'
    };
  }

  /**
   * Wrapper para executar função com lock
   * @param {string} resource - Identificador do recurso
   * @param {string} holder - Identificador do detentor
   * @param {Function} fn - Função a executar
   * @param {Object} options - Opções do lock
   */
  async withLock(resource, holder, fn, options = {}) {
    const lockResult = await this.acquire(resource, holder, options);
    
    if (!lockResult.success) {
      throw new Error(`Failed to acquire lock for ${resource}. Held by: ${lockResult.holder}`);
    }

    try {
      const result = await fn();
      return result;
    } finally {
      await this.release(resource, lockResult.token);
    }
  }
}

// Singleton
module.exports = new LockService();
