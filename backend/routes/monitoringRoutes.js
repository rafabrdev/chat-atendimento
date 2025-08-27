/**
 * Monitoring Routes
 * 
 * Endpoints for health checks, metrics, and observability
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');
const metricsService = require('../services/metricsService');
const loggingService = require('../services/loggingService');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/monitoring/health:
 *   get:
 *     tags: [Monitoring]
 *     summary: Basic health check
 *     description: Returns the health status of the application
 *     responses:
 *       200:
 *         description: Application is healthy
 *       503:
 *         description: Application is unhealthy
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  };

  res.status(200).json(health);
});

/**
 * @swagger
 * /api/monitoring/health/detailed:
 *   get:
 *     tags: [Monitoring]
 *     summary: Detailed health check
 *     description: Returns detailed health information including dependencies
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health information
 */
router.get('/health/detailed', authMiddleware, async (req, res) => {
  try {
    const health = await performDetailedHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    loggingService.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/metrics:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get Prometheus metrics
 *     description: Returns metrics in Prometheus format
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 */
router.get('/metrics', authMiddleware, requireRole('admin', 'master'), async (req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    loggingService.error('Failed to get metrics', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * @swagger
 * /api/monitoring/metrics/json:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get metrics as JSON
 *     description: Returns metrics in JSON format
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics in JSON format
 */
router.get('/metrics/json', authMiddleware, requireRole('admin', 'master'), async (req, res) => {
  try {
    const metrics = await metricsService.getMetricsJSON();
    res.json(metrics);
  } catch (error) {
    loggingService.error('Failed to get metrics', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * @swagger
 * /api/monitoring/dashboard:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get dashboard metrics
 *     description: Returns aggregated metrics for dashboard display
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */
router.get('/dashboard', authMiddleware, requireRole('admin', 'master'), async (req, res) => {
  try {
    const dashboard = await metricsService.getDashboardMetrics();
    const logStats = loggingService.getStats();
    
    res.json({
      metrics: dashboard,
      logs: logStats,
      system: await getSystemInfo(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    loggingService.error('Failed to get dashboard metrics', error);
    res.status(500).json({ error: 'Failed to get dashboard metrics' });
  }
});

/**
 * @swagger
 * /api/monitoring/logs:
 *   get:
 *     tags: [Monitoring]
 *     summary: Search logs
 *     description: Search through application logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Log entries
 */
router.get('/logs', authMiddleware, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { level, search, from, to, limit } = req.query;
    
    const options = {
      level,
      search,
      limit: parseInt(limit) || 100
    };
    
    if (from) options.from = new Date(from);
    if (to) options.to = new Date(to);
    
    const logs = await loggingService.searchLogs(options);
    res.json(logs);
  } catch (error) {
    loggingService.error('Failed to search logs', error);
    res.status(500).json({ error: 'Failed to search logs' });
  }
});

/**
 * @swagger
 * /api/monitoring/logs/stream:
 *   get:
 *     tags: [Monitoring]
 *     summary: Stream logs in real-time
 *     description: Server-sent events stream of logs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE stream of log events
 */
router.get('/logs/stream', authMiddleware, requireRole('admin', 'master'), (req, res) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial ping
  res.write('data: {"type":"ping"}\n\n');

  // Set up log streaming
  const watcher = loggingService.streamLogs((log) => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  // Clean up on client disconnect
  req.on('close', () => {
    watcher.close();
    res.end();
  });
});

/**
 * @swagger
 * /api/monitoring/stats:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get application statistics
 *     description: Returns various application statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Application statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await getApplicationStats(req.user.tenantId);
    res.json(stats);
  } catch (error) {
    loggingService.error('Failed to get stats', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * @swagger
 * /api/monitoring/readiness:
 *   get:
 *     tags: [Monitoring]
 *     summary: Readiness probe
 *     description: Checks if the application is ready to serve requests
 *     responses:
 *       200:
 *         description: Application is ready
 *       503:
 *         description: Application is not ready
 */
router.get('/readiness', async (req, res) => {
  try {
    const isReady = await checkReadiness();
    
    if (isReady) {
      res.status(200).json({ 
        ready: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        ready: false,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      ready: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/liveness:
 *   get:
 *     tags: [Monitoring]
 *     summary: Liveness probe
 *     description: Checks if the application is alive
 *     responses:
 *       200:
 *         description: Application is alive
 */
router.get('/liveness', (req, res) => {
  res.status(200).json({ 
    alive: true,
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

// Helper functions

async function performDetailedHealthCheck() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  // Database check
  try {
    const dbState = mongoose.connection.readyState;
    checks.checks.database = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState],
      latency: await checkDatabaseLatency()
    };
  } catch (error) {
    checks.checks.database = {
      status: 'unhealthy',
      error: error.message
    };
    checks.status = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const memPercentage = (memUsage.rss / totalMem) * 100;
  
  checks.checks.memory = {
    status: memPercentage < 80 ? 'healthy' : 'warning',
    usage: {
      rss: formatBytes(memUsage.rss),
      heapTotal: formatBytes(memUsage.heapTotal),
      heapUsed: formatBytes(memUsage.heapUsed),
      external: formatBytes(memUsage.external),
      percentage: memPercentage.toFixed(2) + '%'
    }
  };

  // CPU check
  const cpuUsage = process.cpuUsage();
  checks.checks.cpu = {
    status: 'healthy',
    usage: {
      user: (cpuUsage.user / 1000000).toFixed(2) + 's',
      system: (cpuUsage.system / 1000000).toFixed(2) + 's'
    }
  };

  // Disk check (logs directory)
  const fs = require('fs');
  const path = require('path');
  const logsDir = path.join(__dirname, '..', 'logs');
  
  if (fs.existsSync(logsDir)) {
    const diskUsage = await getDiskUsage(logsDir);
    checks.checks.disk = {
      status: diskUsage.percentUsed < 90 ? 'healthy' : 'warning',
      logs: diskUsage
    };
  }

  // External services check (if any)
  checks.checks.redis = await checkRedisHealth();
  
  // Overall status
  const unhealthyChecks = Object.values(checks.checks).filter(c => c.status === 'unhealthy');
  const warningChecks = Object.values(checks.checks).filter(c => c.status === 'warning');
  
  if (unhealthyChecks.length > 0) {
    checks.status = 'unhealthy';
  } else if (warningChecks.length > 0) {
    checks.status = 'degraded';
  }

  return checks;
}

async function checkDatabaseLatency() {
  const start = Date.now();
  await mongoose.connection.db.admin().ping();
  return Date.now() - start;
}

async function checkRedisHealth() {
  // Check if Redis is being used (for locks, cache, etc.)
  try {
    // This would check actual Redis connection
    // For now, return a placeholder
    return {
      status: 'healthy',
      info: 'Redis not configured'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

async function checkReadiness() {
  // Check if database is connected
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  // Check if critical services are initialized
  // Add more checks as needed

  return true;
}

async function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    memory: {
      total: formatBytes(os.totalmem()),
      free: formatBytes(os.freemem()),
      used: formatBytes(os.totalmem() - os.freemem())
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model
    },
    loadAverage: os.loadavg(),
    uptime: os.uptime()
  };
}

async function getApplicationStats(tenantId) {
  const Conversation = require('../models/Conversation');
  const Message = require('../models/Message');
  const User = require('../models/User');
  const QueueEntry = require('../models/QueueEntry');

  const query = tenantId ? { tenantId } : {};

  const [
    totalConversations,
    activeConversations,
    totalMessages,
    totalUsers,
    queueSize
  ] = await Promise.all([
    Conversation.countDocuments(query),
    Conversation.countDocuments({ ...query, status: 'active' }),
    Message.countDocuments(query),
    User.countDocuments(query),
    QueueEntry.countDocuments()
  ]);

  return {
    conversations: {
      total: totalConversations,
      active: activeConversations,
      waiting: await Conversation.countDocuments({ ...query, status: 'waiting' }),
      closed: await Conversation.countDocuments({ ...query, status: 'closed' })
    },
    messages: {
      total: totalMessages,
      today: await Message.countDocuments({
        ...query,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    },
    users: {
      total: totalUsers,
      online: await User.countDocuments({ ...query, status: 'online' }),
      agents: await User.countDocuments({ ...query, role: 'agent' }),
      clients: await User.countDocuments({ ...query, role: 'client' })
    },
    queue: {
      size: queueSize,
      avgWaitTime: 'N/A' // Would need to calculate from queue entries
    }
  };
}

async function getDiskUsage(directory) {
  const { promisify } = require('util');
  const fs = require('fs');
  const path = require('path');
  const readdir = promisify(fs.readdir);
  const stat = promisify(fs.stat);

  async function getDirectorySize(dir) {
    let size = 0;
    const files = await readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await stat(filePath);
      
      if (stats.isDirectory()) {
        size += await getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }
    
    return size;
  }

  const size = await getDirectorySize(directory);
  
  return {
    used: formatBytes(size),
    percentUsed: 0 // Would need to get disk total to calculate
  };
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;
