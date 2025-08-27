/**
 * Metrics Service
 * 
 * Collects and exposes system, application, and business metrics
 * using Prometheus client library
 */

const client = require('prom-client');
const os = require('os');
const loggingService = require('./loggingService');

class MetricsService {
  constructor() {
    // Create a Registry
    this.register = new client.Registry();

    // Add default labels
    this.register.setDefaultLabels({
      app: 'chat-atendimento',
      environment: process.env.NODE_ENV || 'development'
    });

    // Initialize collectors
    this.initializeMetrics();
    this.initializeSystemMetrics();
    
    // Start collection interval
    this.startCollection();

    loggingService.info('Metrics service initialized');
  }

  initializeMetrics() {
    // HTTP Request metrics
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });
    this.register.registerMetric(this.httpRequestDuration);

    this.httpRequestTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'tenant_id']
    });
    this.register.registerMetric(this.httpRequestTotal);

    // WebSocket metrics
    this.websocketConnections = new client.Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      labelNames: ['tenant_id']
    });
    this.register.registerMetric(this.websocketConnections);

    // Database metrics
    this.dbQueryDuration = new client.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'collection', 'success'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });
    this.register.registerMetric(this.dbQueryDuration);

    this.dbConnectionPool = new client.Gauge({
      name: 'database_connection_pool_size',
      help: 'Size of database connection pool',
      labelNames: ['state'] // active, idle, waiting
    });
    this.register.registerMetric(this.dbConnectionPool);

    // Business metrics
    this.conversationsTotal = new client.Counter({
      name: 'conversations_total',
      help: 'Total number of conversations',
      labelNames: ['status', 'tenant_id']
    });
    this.register.registerMetric(this.conversationsTotal);

    this.messagesTotal = new client.Counter({
      name: 'messages_total',
      help: 'Total number of messages',
      labelNames: ['type', 'tenant_id']
    });
    this.register.registerMetric(this.messagesTotal);

    this.usersTotal = new client.Gauge({
      name: 'users_total',
      help: 'Total number of users',
      labelNames: ['role', 'status', 'tenant_id']
    });
    this.register.registerMetric(this.usersTotal);

    // Queue metrics
    this.queueSize = new client.Gauge({
      name: 'queue_size',
      help: 'Number of conversations in queue',
      labelNames: ['priority', 'tenant_id']
    });
    this.register.registerMetric(this.queueSize);

    this.queueWaitTime = new client.Histogram({
      name: 'queue_wait_time_seconds',
      help: 'Time spent waiting in queue',
      labelNames: ['priority', 'tenant_id'],
      buckets: [10, 30, 60, 120, 300, 600, 1800]
    });
    this.register.registerMetric(this.queueWaitTime);

    // Authentication metrics
    this.authAttempts = new client.Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['type', 'success', 'tenant_id']
    });
    this.register.registerMetric(this.authAttempts);

    // File upload metrics
    this.fileUploads = new client.Counter({
      name: 'file_uploads_total',
      help: 'Total number of file uploads',
      labelNames: ['type', 'success', 'tenant_id']
    });
    this.register.registerMetric(this.fileUploads);

    this.fileUploadSize = new client.Histogram({
      name: 'file_upload_size_bytes',
      help: 'Size of uploaded files in bytes',
      labelNames: ['type', 'tenant_id'],
      buckets: [1024, 10240, 102400, 1048576, 5242880, 10485760]
    });
    this.register.registerMetric(this.fileUploadSize);

    // Cache metrics
    this.cacheHits = new client.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_name']
    });
    this.register.registerMetric(this.cacheHits);

    this.cacheMisses = new client.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_name']
    });
    this.register.registerMetric(this.cacheMisses);

    // Error metrics
    this.errorsTotal = new client.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'code', 'tenant_id']
    });
    this.register.registerMetric(this.errorsTotal);

    // Custom business events
    this.businessEvents = new client.Counter({
      name: 'business_events_total',
      help: 'Custom business events',
      labelNames: ['event', 'tenant_id']
    });
    this.register.registerMetric(this.businessEvents);
  }

  initializeSystemMetrics() {
    // Collect default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'node_'
    });

    // Custom system metrics
    this.memoryUsage = new client.Gauge({
      name: 'app_memory_usage_bytes',
      help: 'Memory usage of the application',
      labelNames: ['type']
    });
    this.register.registerMetric(this.memoryUsage);

    this.cpuUsage = new client.Gauge({
      name: 'app_cpu_usage_percentage',
      help: 'CPU usage percentage',
      labelNames: ['core']
    });
    this.register.registerMetric(this.cpuUsage);

    this.diskUsage = new client.Gauge({
      name: 'app_disk_usage_bytes',
      help: 'Disk usage in bytes',
      labelNames: ['type'] // logs, uploads, temp
    });
    this.register.registerMetric(this.diskUsage);
  }

  startCollection() {
    // Collect system metrics every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);

    // Collect application metrics every 30 seconds
    setInterval(() => {
      this.collectApplicationMetrics();
    }, 30000);
  }

  collectSystemMetrics() {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);

      // CPU usage
      const cpus = os.cpus();
      cpus.forEach((cpu, index) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const usage = 100 - Math.round(100 * cpu.times.idle / total);
        this.cpuUsage.set({ core: `${index}` }, usage);
      });
    } catch (error) {
      loggingService.error('Error collecting system metrics', error);
    }
  }

  async collectApplicationMetrics() {
    try {
      // This would normally query the database
      // For now, we'll use placeholder values
      
      // Update user counts
      // const userCounts = await User.aggregate([...]);
      
      // Update conversation counts  
      // const conversationCounts = await Conversation.aggregate([...]);
      
      // Update queue metrics
      // const queueMetrics = await QueueEntry.aggregate([...]);
      
    } catch (error) {
      loggingService.error('Error collecting application metrics', error);
    }
  }

  // Record HTTP request
  recordHttpRequest(method, route, statusCode, duration, tenantId) {
    const labels = {
      method,
      route: this.normalizeRoute(route),
      status_code: statusCode.toString(),
      tenant_id: tenantId || 'unknown'
    };

    this.httpRequestDuration.observe(labels, duration / 1000);
    this.httpRequestTotal.inc(labels);
  }

  // Record database query
  recordDatabaseQuery(operation, collection, duration, success = true) {
    this.dbQueryDuration.observe(
      {
        operation,
        collection,
        success: success.toString()
      },
      duration / 1000
    );
  }

  // Record WebSocket connection
  recordWebSocketConnection(tenantId, delta) {
    this.websocketConnections.inc({ tenant_id: tenantId || 'unknown' }, delta);
  }

  // Record conversation
  recordConversation(status, tenantId) {
    this.conversationsTotal.inc({
      status,
      tenant_id: tenantId || 'unknown'
    });
  }

  // Record message
  recordMessage(type, tenantId) {
    this.messagesTotal.inc({
      type,
      tenant_id: tenantId || 'unknown'
    });
  }

  // Record authentication attempt
  recordAuthAttempt(type, success, tenantId) {
    this.authAttempts.inc({
      type,
      success: success.toString(),
      tenant_id: tenantId || 'unknown'
    });
  }

  // Record file upload
  recordFileUpload(type, size, success, tenantId) {
    this.fileUploads.inc({
      type,
      success: success.toString(),
      tenant_id: tenantId || 'unknown'
    });

    if (success && size) {
      this.fileUploadSize.observe(
        { type, tenant_id: tenantId || 'unknown' },
        size
      );
    }
  }

  // Record cache hit/miss
  recordCacheHit(cacheName) {
    this.cacheHits.inc({ cache_name: cacheName });
  }

  recordCacheMiss(cacheName) {
    this.cacheMisses.inc({ cache_name: cacheName });
  }

  // Record error
  recordError(type, code, tenantId) {
    this.errorsTotal.inc({
      type,
      code: code?.toString() || 'unknown',
      tenant_id: tenantId || 'unknown'
    });
  }

  // Record business event
  recordBusinessEvent(event, tenantId) {
    this.businessEvents.inc({
      event,
      tenant_id: tenantId || 'unknown'
    });
  }

  // Update queue metrics
  updateQueueMetrics(priority, size, tenantId) {
    this.queueSize.set(
      { priority, tenant_id: tenantId || 'unknown' },
      size
    );
  }

  recordQueueWaitTime(priority, waitTime, tenantId) {
    this.queueWaitTime.observe(
      { priority, tenant_id: tenantId || 'unknown' },
      waitTime / 1000
    );
  }

  // Normalize route paths (remove IDs)
  normalizeRoute(route) {
    return route
      .replace(/\/[0-9a-f]{24}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*/g, '');
  }

  // Get metrics in Prometheus format
  async getMetrics() {
    return this.register.metrics();
  }

  // Get metrics as JSON
  async getMetricsJSON() {
    return this.register.getMetricsAsJSON();
  }

  // Get specific metric
  getMetric(name) {
    return this.register.getSingleMetric(name);
  }

  // Reset all metrics
  reset() {
    this.register.resetMetrics();
  }

  // Custom metric aggregations for dashboard
  async getDashboardMetrics() {
    const metrics = await this.getMetricsJSON();
    
    // Process metrics for dashboard display
    const dashboard = {
      http: {
        totalRequests: this.getMetricValue(metrics, 'http_requests_total'),
        avgResponseTime: this.getMetricAverage(metrics, 'http_request_duration_seconds'),
        errorRate: this.calculateErrorRate(metrics)
      },
      system: {
        memoryUsage: this.getMetricValue(metrics, 'app_memory_usage_bytes', { type: 'heapUsed' }),
        cpuUsage: this.getMetricAverage(metrics, 'app_cpu_usage_percentage')
      },
      business: {
        totalConversations: this.getMetricValue(metrics, 'conversations_total'),
        totalMessages: this.getMetricValue(metrics, 'messages_total'),
        activeWebsockets: this.getMetricValue(metrics, 'websocket_connections_active'),
        queueSize: this.getMetricValue(metrics, 'queue_size')
      },
      errors: {
        total: this.getMetricValue(metrics, 'errors_total'),
        byType: this.getMetricByLabel(metrics, 'errors_total', 'type')
      }
    };

    return dashboard;
  }

  // Helper methods for dashboard metrics
  getMetricValue(metrics, name, labels = {}) {
    const metric = metrics.find(m => m.name === name);
    if (!metric) return 0;

    const values = metric.values || [];
    if (Object.keys(labels).length === 0) {
      return values.reduce((sum, v) => sum + v.value, 0);
    }

    return values
      .filter(v => Object.entries(labels).every(([key, val]) => v.labels[key] === val))
      .reduce((sum, v) => sum + v.value, 0);
  }

  getMetricAverage(metrics, name) {
    const metric = metrics.find(m => m.name === name);
    if (!metric) return 0;

    const values = metric.values || [];
    if (values.length === 0) return 0;

    const sum = values.reduce((sum, v) => sum + v.value, 0);
    return sum / values.length;
  }

  getMetricByLabel(metrics, name, labelName) {
    const metric = metrics.find(m => m.name === name);
    if (!metric) return {};

    const result = {};
    (metric.values || []).forEach(v => {
      const label = v.labels[labelName] || 'unknown';
      result[label] = (result[label] || 0) + v.value;
    });

    return result;
  }

  calculateErrorRate(metrics) {
    const total = this.getMetricValue(metrics, 'http_requests_total');
    const errors = this.getMetricValue(metrics, 'http_requests_total', { status_code: '500' });
    
    if (total === 0) return 0;
    return (errors / total) * 100;
  }
}

// Create singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;
