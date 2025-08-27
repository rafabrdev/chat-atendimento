/**
 * Request Logging Middleware
 * 
 * Logs all HTTP requests with detailed metrics and performance data
 */

const loggingService = require('../services/loggingService');
const onFinished = require('on-finished');

// Skip logging for certain paths
const skipPaths = [
  '/health',
  '/metrics',
  '/favicon.ico'
];

// Sensitive headers to redact
const sensitiveHeaders = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token'
];

/**
 * Request logging middleware
 */
function requestLogging(options = {}) {
  const {
    skip = [],
    detailed = false,
    includeBody = false,
    includeSensitive = false
  } = options;

  const pathsToSkip = [...skipPaths, ...skip];

  return (req, res, next) => {
    // Skip logging for certain paths
    if (pathsToSkip.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Start timer
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Attach request ID to request and response
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    // Capture original methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    // Response body capture (if enabled)
    let responseBody = undefined;

    if (includeBody) {
      // Override send method
      res.send = function(data) {
        responseBody = data;
        return originalSend.call(this, data);
      };

      // Override json method
      res.json = function(data) {
        responseBody = JSON.stringify(data);
        return originalJson.call(this, data);
      };
    }

    // Log request details
    const requestLog = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      query: req.query,
      ip: getClientIp(req),
      userAgent: req.get('user-agent'),
      referer: req.get('referer'),
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      userId: req.user?._id,
      userEmail: req.user?.email,
      tenantId: req.user?.tenantId || req.headers['x-tenant-id']
    };

    // Add headers if detailed logging
    if (detailed) {
      requestLog.headers = sanitizeHeaders(req.headers, includeSensitive);
    }

    // Add body if enabled and not too large
    if (includeBody && req.body) {
      const bodySize = JSON.stringify(req.body).length;
      if (bodySize < 10000) { // Max 10KB
        requestLog.body = sanitizeBody(req.body, includeSensitive);
      } else {
        requestLog.body = '[Body too large]';
      }
    }

    // Log incoming request
    loggingService.debug('Incoming request', requestLog);

    // Handle response completion
    onFinished(res, (err, res) => {
      const responseTime = Date.now() - startTime;
      
      // Build response log
      const responseLog = {
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        responseTime,
        responseTimeMs: `${responseTime}ms`,
        contentLength: res.get('content-length'),
        userId: req.user?._id,
        tenantId: req.user?.tenantId || req.headers['x-tenant-id']
      };

      // Add response body if enabled
      if (includeBody && responseBody) {
        const bodySize = responseBody.length;
        if (bodySize < 10000) { // Max 10KB
          try {
            responseLog.responseBody = typeof responseBody === 'string' 
              ? JSON.parse(responseBody) 
              : responseBody;
          } catch {
            responseLog.responseBody = responseBody.substring(0, 500);
          }
        } else {
          responseLog.responseBody = '[Response too large]';
        }
      }

      // Determine log level based on status code
      let logLevel = 'info';
      let message = 'Request completed';

      if (res.statusCode >= 500) {
        logLevel = 'error';
        message = 'Request failed with server error';
      } else if (res.statusCode >= 400) {
        logLevel = 'warn';
        message = 'Request failed with client error';
      } else if (responseTime > 3000) {
        logLevel = 'warn';
        message = 'Slow request detected';
        responseLog.slow = true;
      }

      // Log the response
      loggingService.log(logLevel, message, responseLog);

      // Log to request count metrics
      loggingService.logRequest(req, res, responseTime);

      // Track slow queries
      if (responseTime > 5000) {
        loggingService.logBusinessEvent('SLOW_REQUEST', {
          method: req.method,
          path: req.path,
          responseTime,
          userId: req.user?._id
        });
      }

      // Track errors
      if (res.statusCode >= 500) {
        loggingService.logBusinessEvent('SERVER_ERROR', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          error: err?.message
        });
      }
    });

    next();
  };
}

/**
 * Performance monitoring middleware
 */
function performanceMonitoring() {
  return (req, res, next) => {
    const timers = {
      total: loggingService.startTimer('request-total'),
      middleware: [],
      route: null
    };

    req.timers = timers;

    // Track middleware execution time
    const originalNext = next;
    let middlewareIndex = 0;

    next = function(...args) {
      if (timers.middleware[middlewareIndex]) {
        loggingService.endTimer(timers.middleware[middlewareIndex]);
      }
      middlewareIndex++;
      timers.middleware[middlewareIndex] = loggingService.startTimer(`middleware-${middlewareIndex}`);
      return originalNext(...args);
    };

    // Track route execution time
    res.on('finish', () => {
      if (timers.route) {
        loggingService.endTimer(timers.route, { 
          path: req.path,
          method: req.method 
        });
      }
      
      const totalTime = loggingService.endTimer(timers.total, {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode
      });

      // Log performance warning if too slow
      if (totalTime > 5000) {
        loggingService.warn('Slow request detected', {
          path: req.path,
          method: req.method,
          totalTime: `${totalTime}ms`,
          statusCode: res.statusCode
        });
      }
    });

    next();
  };
}

/**
 * Error logging middleware
 */
function errorLogging() {
  return (err, req, res, next) => {
    const errorInfo = {
      requestId: req.requestId || generateRequestId(),
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      query: req.query,
      body: sanitizeBody(req.body),
      userId: req.user?._id,
      userEmail: req.user?.email,
      tenantId: req.user?.tenantId || req.headers['x-tenant-id'],
      ip: getClientIp(req),
      userAgent: req.get('user-agent'),
      statusCode: err.status || err.statusCode || 500,
      errorCode: err.code,
      errorMessage: err.message,
      errorStack: err.stack
    };

    // Log the error
    loggingService.error('Request error', err, errorInfo);

    // Track error in business events
    loggingService.logBusinessEvent('REQUEST_ERROR', {
      path: req.path,
      method: req.method,
      errorType: err.name,
      errorMessage: err.message,
      statusCode: errorInfo.statusCode
    });

    // Pass to next error handler
    next(err);
  };
}

/**
 * Audit logging for sensitive operations
 */
function auditLogging(action) {
  return (req, res, next) => {
    const auditInfo = {
      action,
      method: req.method,
      path: req.path,
      query: req.query,
      body: sanitizeBody(req.body),
      ip: getClientIp(req),
      userAgent: req.get('user-agent')
    };

    // Log the audit event
    loggingService.logAudit(action, req.user, req.path, auditInfo);

    // Continue with request
    next();
  };
}

// Helper functions

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip;
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers, includeSensitive = false) {
  const sanitized = { ...headers };

  if (!includeSensitive) {
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
  }

  return sanitized;
}

/**
 * Sanitize body to remove sensitive information
 */
function sanitizeBody(body, includeSensitive = false) {
  if (!body) return body;

  try {
    const sanitized = JSON.parse(JSON.stringify(body));

    if (!includeSensitive) {
      // Recursively redact sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
      
      function redact(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            redact(obj[key]);
          }
        });
      }

      redact(sanitized);
    }

    return sanitized;
  } catch {
    return body;
  }
}

module.exports = {
  requestLogging,
  performanceMonitoring,
  errorLogging,
  auditLogging
};
