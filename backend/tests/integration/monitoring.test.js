const request = require('supertest');
const express = require('express');
const monitoringRoutes = require('../../routes/monitoringRoutes');
const authMiddleware = require('../../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

// Mock auth middleware for testing
jest.mock('../../middleware/authMiddleware', () => ({
  __esModule: true,
  default: jest.fn((req, res, next) => {
    req.user = {
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      tenantId: 'test-tenant'
    };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next())
}));

describe('Monitoring API Integration Tests', () => {
  let app;
  let server;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/monitoring', monitoringRoutes);
    server = app.listen(0); // Random port
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /api/monitoring/health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
    });

    it('should be accessible without authentication', async () => {
      // Health check should work without auth
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /api/monitoring/health/detailed', () => {
    it('should return detailed health information', async () => {
      const token = jwt.sign(
        { id: 'test-user', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/health/detailed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('memory');
      expect(response.body.checks).toHaveProperty('cpu');
    });
  });

  describe('GET /api/monitoring/readiness', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/monitoring/readiness')
        .expect(200);

      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/monitoring/liveness', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/api/monitoring/liveness')
        .expect(200);

      expect(response.body).toHaveProperty('alive', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('pid');
    });
  });

  describe('GET /api/monitoring/metrics', () => {
    it('should return Prometheus metrics for authorized users', async () => {
      const token = jwt.sign(
        { id: 'test-user', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });
  });

  describe('GET /api/monitoring/metrics/json', () => {
    it('should return metrics in JSON format', async () => {
      const token = jwt.sign(
        { id: 'test-user', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/metrics/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Object);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('GET /api/monitoring/dashboard', () => {
    it('should return dashboard data for admin users', async () => {
      const token = jwt.sign(
        { id: 'test-user', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/monitoring/stats', () => {
    it('should return application statistics', async () => {
      const token = jwt.sign(
        { id: 'test-user', role: 'admin', tenantId: 'test-tenant' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('conversations');
      expect(response.body).toHaveProperty('messages');
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('queue');
    });
  });

  describe('GET /api/monitoring/logs', () => {
    it('should return logs with filters', async () => {
      const token = jwt.sign(
        { id: 'test-user', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/logs')
        .query({ level: 'info', limit: 10 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should accept search parameters', async () => {
      const token = jwt.sign(
        { id: 'test-user', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/logs')
        .query({ 
          level: 'error',
          search: 'test',
          limit: 50,
          from: new Date(Date.now() - 86400000).toISOString(),
          to: new Date().toISOString()
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Mock a service to throw error
      jest.spyOn(require('../../services/metricsService'), 'getMetrics')
        .mockRejectedValueOnce(new Error('Service error'));

      const token = jwt.sign(
        { id: 'test-user', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });
});
