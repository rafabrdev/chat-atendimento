const { expect } = require('chai');
const sinon = require('sinon');
const corsService = require('../services/corsService');

describe('CORS Multi-Tenant Tests', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // Clear cache and stats before each test
    corsService.clearCache();
    corsService.clearStats();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Origin Validation', () => {
    it('should allow exact match origins', () => {
      const allowed = ['https://app.example.com', 'https://www.example.com'];
      
      expect(corsService.isOriginAllowed('https://app.example.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('https://www.example.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('https://other.com', allowed)).to.be.false;
    });

    it('should support wildcard (*) for all origins', () => {
      const allowed = ['*'];
      
      expect(corsService.isOriginAllowed('https://any.domain.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('http://localhost:3000', allowed)).to.be.true;
    });

    it('should support subdomain wildcards (*.example.com)', () => {
      const allowed = ['*.example.com'];
      
      expect(corsService.isOriginAllowed('https://app.example.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('https://api.example.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('https://sub.sub.example.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('https://example.com', allowed)).to.be.true; // example.com também é considerado
      expect(corsService.isOriginAllowed('https://different.com', allowed)).to.be.false;
    });

    it('should support regex patterns (/pattern/)', () => {
      const allowed = ['/^https:\\/\\/.*\\.example\\.com$/'];
      
      expect(corsService.isOriginAllowed('https://app.example.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('https://api.example.com', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('http://app.example.com', allowed)).to.be.false;
    });

    it('should support port wildcards (http://localhost:*)', () => {
      const allowed = ['http://localhost:*'];
      
      expect(corsService.isOriginAllowed('http://localhost:3000', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('http://localhost:5173', allowed)).to.be.true;
      expect(corsService.isOriginAllowed('https://localhost:3000', allowed)).to.be.false;
      expect(corsService.isOriginAllowed('http://127.0.0.1:3000', allowed)).to.be.false;
    });

    it('should handle invalid origins gracefully', () => {
      const allowed = ['https://example.com'];
      
      expect(corsService.isOriginAllowed(null, allowed)).to.be.false;
      expect(corsService.isOriginAllowed('', allowed)).to.be.false;
      expect(corsService.isOriginAllowed(undefined, allowed)).to.be.false;
    });
  });

  describe('Origin Format Validation', () => {
    it('should validate correct URL formats', () => {
      expect(corsService.isValidOrigin('https://example.com')).to.be.true;
      expect(corsService.isValidOrigin('http://localhost:3000')).to.be.true;
      expect(corsService.isValidOrigin('https://sub.domain.com:8080')).to.be.true;
    });

    it('should validate special patterns', () => {
      expect(corsService.isValidOrigin('*')).to.be.true;
      expect(corsService.isValidOrigin('*.example.com')).to.be.true;
      expect(corsService.isValidOrigin('http://localhost:*')).to.be.true;
      expect(corsService.isValidOrigin('/^https:.*$/')).to.be.true;
    });

    it('should reject invalid formats', () => {
      expect(corsService.isValidOrigin('not-a-url')).to.be.false;
      expect(corsService.isValidOrigin('://broken')).to.be.false;
      expect(corsService.isValidOrigin('*.*.com')).to.be.false;
      expect(corsService.isValidOrigin('/invalid-regex')).to.be.false;
    });
  });

  describe('Development Origins', () => {
    it('should return development origins in dev mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const devOrigins = corsService.getDevelopmentOrigins();
      expect(devOrigins).to.include('http://localhost:3000');
      expect(devOrigins).to.include('http://localhost:5173');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should return empty array in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const devOrigins = corsService.getDevelopmentOrigins();
      expect(devOrigins).to.be.empty;
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Access Logging', () => {
    it('should log allowed access', () => {
      const tenantId = 'tenant123';
      const origin = 'https://app.example.com';
      
      corsService.logAccess(origin, tenantId, true);
      
      const stats = corsService.getStats(tenantId);
      expect(stats.allowed).to.have.lengthOf(1);
      expect(stats.allowed[0].origin).to.equal(origin);
      expect(stats.allowed[0].count).to.equal(1);
    });

    it('should log blocked access', () => {
      const tenantId = 'tenant123';
      const origin = 'https://blocked.com';
      
      corsService.logAccess(origin, tenantId, false);
      corsService.logAccess(origin, tenantId, false);
      
      const stats = corsService.getStats(tenantId);
      expect(stats.blocked).to.have.lengthOf(1);
      expect(stats.blocked[0].origin).to.equal(origin);
      expect(stats.blocked[0].count).to.equal(2);
    });

    it('should track total requests per tenant', () => {
      const tenantId = 'tenant123';
      
      corsService.logAccess('https://app1.com', tenantId, true);
      corsService.logAccess('https://app2.com', tenantId, false);
      corsService.logAccess('https://app3.com', tenantId, true);
      
      const stats = corsService.getStats(tenantId);
      expect(stats.totalRequests).to.equal(3);
    });
  });

  describe('Suggested Origins', () => {
    it('should suggest origins after multiple blocks', async () => {
      const tenantId = 'tenant123';
      const blockedOrigin = 'https://app.example.com';
      
      // Simulate 5 blocked attempts
      for (let i = 0; i < 5; i++) {
        corsService.logAccess(blockedOrigin, tenantId, false);
      }
      
      const suggestions = await corsService.getSuggestedOrigins(tenantId);
      expect(suggestions).to.have.lengthOf(1);
      expect(suggestions[0].origin).to.equal(blockedOrigin);
      expect(suggestions[0].blockedCount).to.equal(5);
    });

    it('should suggest wildcard for localhost ports', () => {
      const origin = 'http://localhost:3001';
      const suggestion = corsService.generateSuggestion(origin);
      expect(suggestion).to.equal('localhost:*');
    });

    it('should suggest subdomain wildcard for subdomains', () => {
      const origin = 'https://app.subdomain.example.com';
      const suggestion = corsService.generateSuggestion(origin);
      expect(suggestion).to.equal('*.example.com');
    });
  });

  describe('Cache Management', () => {
    it('should cache allowed origins', async () => {
      const Tenant = require('../models/Tenant');
      const tenantId = '507f1f77bcf86cd799439011';
      const mockOrigins = ['https://app.example.com'];
      
      sandbox.stub(Tenant, 'findById').returns({
        select: () => ({
          lean: () => Promise.resolve({
            allowedOrigins: mockOrigins,
            domain: 'example.com'
          })
        })
      });
      
      // First call - should query database
      const origins1 = await corsService.getAllowedOrigins(tenantId);
      expect(origins1).to.include('https://app.example.com');
      
      // Second call - should use cache
      const origins2 = await corsService.getAllowedOrigins(tenantId);
      expect(origins2).to.deep.equal(origins1);
      
      // Verify database was called only once
      expect(Tenant.findById.calledOnce).to.be.true;
    });

    it('should clear cache for specific tenant', async () => {
      const tenantId = '507f1f77bcf86cd799439011';
      
      // Add something to cache
      corsService.cache.set(`origins_${tenantId}`, ['https://cached.com']);
      
      // Clear specific tenant cache
      corsService.clearCache(tenantId);
      
      // Verify cache is cleared
      expect(corsService.cache.get(`origins_${tenantId}`)).to.be.undefined;
    });
  });

  describe('Request Validation', () => {
    it('should validate request with tenant origins', async () => {
      const Tenant = require('../models/Tenant');
      const tenantId = '507f1f77bcf86cd799439011';
      const origin = 'https://app.example.com';
      
      sandbox.stub(Tenant, 'findById').returns({
        select: () => ({
          lean: () => Promise.resolve({
            allowedOrigins: [origin]
          })
        })
      });
      
      const result = await corsService.validateRequest(origin, tenantId);
      
      expect(result.allowed).to.be.true;
      expect(result.reason).to.equal('Origin allowed');
    });

    it('should allow development origins in dev mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const result = await corsService.validateRequest('http://localhost:3000', 'tenant123');
      
      expect(result.allowed).to.be.true;
      expect(result.reason).to.equal('Development origin');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should block unallowed origins', async () => {
      const Tenant = require('../models/Tenant');
      const tenantId = '507f1f77bcf86cd799439011';
      
      sandbox.stub(Tenant, 'findById').returns({
        select: () => ({
          lean: () => Promise.resolve({
            allowedOrigins: ['https://allowed.com']
          })
        })
      });
      
      const result = await corsService.validateRequest('https://blocked.com', tenantId);
      
      expect(result.allowed).to.be.false;
      expect(result.reason).to.equal('Origin not in whitelist');
    });
  });

  describe('Health Check', () => {
    it('should return service health status', () => {
      const health = corsService.getHealth();
      
      expect(health.status).to.equal('healthy');
      expect(health.cache).to.have.property('keys');
      expect(health.cache).to.have.property('stats');
      expect(health.stats).to.have.property('totalAllowed');
      expect(health.stats).to.have.property('totalBlocked');
      expect(health.stats).to.have.property('tenants');
    });
  });
});

module.exports = {};
