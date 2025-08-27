/**
 * Logging Service
 * 
 * Centralized logging service with structured logging,
 * multiple transports, and rotation capabilities
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, metadata, ...rest }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }
    
    // Add additional fields
    if (Object.keys(rest).length > 0) {
      log += ` | ${JSON.stringify(rest)}`;
    }
    
    return log;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...rest }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (Object.keys(rest).length > 0) {
      log += ` ${JSON.stringify(rest, null, 2)}`;
    }
    return log;
  })
);

class LoggingService {
  constructor() {
    this.logger = this.createLogger();
    this.performanceMetrics = new Map();
    this.errorCounts = new Map();
    this.requestCounts = new Map();
  }

  createLogger() {
    const transports = [];

    // Console transport
    if (process.env.NODE_ENV !== 'test') {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
          level: process.env.LOG_LEVEL || 'info'
        })
      );
    }

    // File transport for all logs with rotation
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: customFormat,
        level: 'info'
      })
    );

    // Separate file for errors
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'errors-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: customFormat,
        level: 'error'
      })
    );

    // Debug logs (only in development)
    if (process.env.NODE_ENV === 'development') {
      transports.push(
        new DailyRotateFile({
          filename: path.join(logsDir, 'debug-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '50m',
          maxFiles: '3d',
          format: customFormat,
          level: 'debug'
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: customFormat,
      transports,
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log'),
          format: customFormat
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log'),
          format: customFormat
        })
      ]
    });
  }

  // Structured logging methods
  log(level, message, meta = {}) {
    const enrichedMeta = this.enrichMetadata(meta);
    this.logger.log(level, message, { metadata: enrichedMeta });
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = { ...meta };
    
    if (error instanceof Error) {
      errorMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      };
    } else if (error) {
      errorMeta.error = error;
    }

    // Track error counts
    const errorType = error?.name || 'UnknownError';
    this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);

    this.log('error', message, errorMeta);
  }

  // Enrich metadata with context
  enrichMetadata(meta) {
    return {
      ...meta,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      hostname: require('os').hostname(),
      pid: process.pid
    };
  }

  // Request logging
  logRequest(req, res, responseTime) {
    const { method, url, headers, ip, user } = req;
    const { statusCode } = res;

    // Track request counts
    const endpoint = `${method} ${url}`;
    this.requestCounts.set(endpoint, (this.requestCounts.get(endpoint) || 0) + 1);

    const logData = {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      ip: ip || req.connection.remoteAddress,
      userAgent: headers['user-agent'],
      userId: user?._id,
      tenantId: user?.tenantId || req.headers['x-tenant-id']
    };

    // Log level based on status code
    let level = 'info';
    if (statusCode >= 500) level = 'error';
    else if (statusCode >= 400) level = 'warn';

    this.log(level, `HTTP ${method} ${url} ${statusCode}`, logData);
  }

  // Performance logging
  startTimer(operation) {
    const id = `${operation}-${Date.now()}-${Math.random()}`;
    this.performanceMetrics.set(id, {
      operation,
      startTime: Date.now()
    });
    return id;
  }

  endTimer(timerId, meta = {}) {
    const metric = this.performanceMetrics.get(timerId);
    if (!metric) return;

    const duration = Date.now() - metric.startTime;
    this.performanceMetrics.delete(timerId);

    this.info(`Operation completed: ${metric.operation}`, {
      operation: metric.operation,
      duration: `${duration}ms`,
      ...meta
    });

    return duration;
  }

  // Database query logging
  logQuery(query, duration, error = null) {
    const logData = {
      query: this.sanitizeQuery(query),
      duration: `${duration}ms`,
      success: !error
    };

    if (error) {
      logData.error = error.message;
      this.error('Database query failed', error, logData);
    } else {
      this.debug('Database query executed', logData);
    }
  }

  // Sanitize sensitive data from queries
  sanitizeQuery(query) {
    if (typeof query === 'string') {
      // Remove passwords and tokens from query strings
      return query
        .replace(/password['":\s]*['"][^'"]*['"]/gi, 'password: [REDACTED]')
        .replace(/token['":\s]*['"][^'"]*['"]/gi, 'token: [REDACTED]')
        .replace(/api_key['":\s]*['"][^'"]*['"]/gi, 'api_key: [REDACTED]');
    }
    return query;
  }

  // Business event logging
  logBusinessEvent(event, data = {}) {
    this.info(`Business Event: ${event}`, {
      event,
      ...data,
      category: 'business'
    });
  }

  // Security event logging
  logSecurityEvent(event, data = {}) {
    this.warn(`Security Event: ${event}`, {
      event,
      ...data,
      category: 'security'
    });
  }

  // Audit logging
  logAudit(action, user, resource, changes = {}) {
    this.info(`Audit: ${action}`, {
      action,
      userId: user?._id,
      userName: user?.name,
      userEmail: user?.email,
      resource,
      changes,
      category: 'audit'
    });
  }

  // Get statistics
  getStats() {
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      requestCounts: Object.fromEntries(this.requestCounts),
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      totalRequests: Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0)
    };
  }

  // Clear statistics
  clearStats() {
    this.errorCounts.clear();
    this.requestCounts.clear();
    this.performanceMetrics.clear();
  }

  // Search logs
  async searchLogs(options = {}) {
    const {
      level,
      from = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      to = new Date(),
      limit = 100,
      search
    } = options;

    // This is a simplified version
    // In production, you might want to use a log aggregation service
    const logFile = path.join(logsDir, `application-${from.toISOString().split('T')[0]}.log`);
    
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Apply filters
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (search) {
      logs = logs.filter(log => 
        JSON.stringify(log).toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply time range
    logs = logs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime >= from && logTime <= to;
    });

    // Limit results
    return logs.slice(-limit);
  }

  // Stream logs for real-time monitoring
  streamLogs(callback) {
    const logFile = path.join(logsDir, `application-${new Date().toISOString().split('T')[0]}.log`);
    
    // Watch for changes
    const watcher = fs.watch(logFile, (eventType) => {
      if (eventType === 'change') {
        // Read last line
        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        const lastLine = lines[lines.length - 1];
        
        try {
          const log = JSON.parse(lastLine);
          callback(log);
        } catch {
          // Ignore parsing errors
        }
      }
    });

    return watcher;
  }
}

// Create singleton instance
const loggingService = new LoggingService();

// Handle process events
process.on('uncaughtException', (error) => {
  loggingService.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  loggingService.error('Unhandled Rejection', reason, { promise });
});

module.exports = loggingService;
