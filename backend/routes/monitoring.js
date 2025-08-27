/**
 * Rotas de Monitoramento
 * 
 * Endpoints para monitorar o status dos serviços
 */

const express = require('express');
const router = express.Router();
const cache = require('../services/cacheService');
const lockService = require('../services/lockService');

/**
 * Status geral do sistema
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      status: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {}
    };

    // Status do Redis
    if (cache.redisClient) {
      try {
        await cache.redisClient.ping();
        status.services.redis = {
          status: 'connected',
          url: process.env.REDIS_URL ? 'configured' : 'not configured'
        };
      } catch (error) {
        status.services.redis = {
          status: 'error',
          error: error.message
        };
      }
    } else {
      status.services.redis = {
        status: 'not configured',
        fallback: 'in-memory'
      };
    }

    // Status do MongoDB
    const mongoose = require('mongoose');
    status.services.mongodb = {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      database: mongoose.connection.name
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Estatísticas do cache
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = cache.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Limpar cache (apenas em desenvolvimento)
 */
router.delete('/cache/flush', async (req, res) => {
  try {
    // Proteção para produção
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Cache flush não permitido em produção'
      });
    }

    await cache.flush();
    res.json({
      success: true,
      message: 'Cache limpo com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Resetar estatísticas do cache
 */
router.post('/cache/reset-stats', async (req, res) => {
  try {
    cache.resetStats();
    res.json({
      success: true,
      message: 'Estatísticas resetadas'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Teste de cache
 */
router.get('/cache/test', async (req, res) => {
  try {
    const testKey = `test:${Date.now()}`;
    const testValue = { test: true, timestamp: new Date().toISOString() };
    
    // Teste de escrita
    const writeStart = Date.now();
    await cache.set(testKey, testValue, 10);
    const writeTime = Date.now() - writeStart;
    
    // Teste de leitura
    const readStart = Date.now();
    const retrieved = await cache.get(testKey);
    const readTime = Date.now() - readStart;
    
    // Teste de deleção
    const deleteStart = Date.now();
    await cache.delete(testKey);
    const deleteTime = Date.now() - deleteStart;
    
    res.json({
      success: true,
      backend: cache.redisClient ? 'redis' : 'memory',
      performance: {
        write: `${writeTime}ms`,
        read: `${readTime}ms`,
        delete: `${deleteTime}ms`
      },
      test: {
        written: testValue,
        retrieved: retrieved,
        match: JSON.stringify(testValue) === JSON.stringify(retrieved)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Status dos locks
 */
router.get('/locks/status', async (req, res) => {
  try {
    const status = {
      backend: lockService.redisClient ? 'redis' : 'memory',
      activeLocks: lockService.getActiveLocks ? lockService.getActiveLocks() : 'not available'
    };
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Teste de locks
 */
router.get('/locks/test', async (req, res) => {
  const lockKey = `test-lock-${Date.now()}`;
  
  try {
    // Teste de aquisição de lock
    const acquired = await lockService.acquireLock(lockKey, 5000);
    if (!acquired) {
      return res.json({
        success: false,
        message: 'Não foi possível adquirir o lock'
      });
    }
    
    // Teste de tentativa de re-aquisição (deve falhar)
    const reacquired = await lockService.acquireLock(lockKey, 5000);
    
    // Liberar o lock
    await lockService.releaseLock(lockKey);
    
    // Teste de aquisição após liberação (deve funcionar)
    const acquiredAfterRelease = await lockService.acquireLock(lockKey, 5000);
    if (acquiredAfterRelease) {
      await lockService.releaseLock(lockKey);
    }
    
    res.json({
      success: true,
      backend: lockService.redisClient ? 'redis' : 'memory',
      tests: {
        firstAcquisition: acquired,
        reacquisition: reacquired,
        acquisitionAfterRelease: acquiredAfterRelease
      },
      expected: {
        firstAcquisition: true,
        reacquisition: false,
        acquisitionAfterRelease: true
      }
    });
  } catch (error) {
    // Tentar limpar o lock em caso de erro
    try {
      await lockService.releaseLock(lockKey);
    } catch (e) {}
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check simples
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
