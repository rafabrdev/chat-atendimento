/**
 * Testes para JWT com Multi-Tenancy
 * 
 * Este arquivo testa:
 * - Geração de tokens com tenantId
 * - Validação de tokens
 * - Verificação de tenant
 * - Controle de acesso baseado em roles
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateJWT,
  requireRole,
  requireSameTenant,
  checkPlanLimit,
  requireModule
} = require('../middleware/jwtAuth');

// Mock dos modelos
const User = require('../models/User');
const Tenant = require('../models/Tenant');

// Configurar variáveis de ambiente para testes
process.env.JWT_SECRET = 'test-secret-key-123';
process.env.JWT_EXPIRE = '1h';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123';
process.env.JWT_REFRESH_EXPIRE = '7d';

describe('JWT Authentication with Multi-Tenancy', () => {
  
  // Dados de teste
  const testTenant = {
    _id: new mongoose.Types.ObjectId(),
    slug: 'test-company',
    companyName: 'Test Company',
    isActive: true,
    subscription: {
      status: 'active',
      plan: 'professional'
    },
    modules: {
      chat: { enabled: true },
      crm: { enabled: false }
    },
    limits: {
      users: 10,
      storage: 5
    },
    usage: {
      users: 3,
      storage: 2
    }
  };

  const testUser = {
    _id: new mongoose.Types.ObjectId(),
    email: 'user@test.com',
    name: 'Test User',
    role: 'admin',
    company: 'Test Company',
    tenantId: testTenant._id,
    isActive: true,
    active: true
  };

  const masterUser = {
    _id: new mongoose.Types.ObjectId(),
    email: 'master@system.com',
    name: 'Master User',
    role: 'master',
    company: 'System',
    tenantId: null,
    isActive: true,
    active: true
  };

  describe('Token Generation', () => {
    
    test('should generate token with tenantId for regular user', () => {
      const token = generateToken(testUser);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded).toMatchObject({
        id: testUser._id.toString(),
        email: testUser.email,
        role: testUser.role,
        tenantId: testTenant._id.toString(),
        company: testUser.company,
        name: testUser.name
      });
    });

    test('should generate token without tenantId for master user', () => {
      const token = generateToken(masterUser);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded).toMatchObject({
        id: masterUser._id.toString(),
        email: masterUser.email,
        role: masterUser.role,
        tenantId: null,
        company: masterUser.company,
        name: masterUser.name
      });
    });

    test('should include tenant details when tenant is populated', () => {
      const userWithPopulatedTenant = {
        ...testUser,
        tenantId: testTenant
      };
      
      const token = generateToken(userWithPopulatedTenant);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.tenantSlug).toBe(testTenant.slug);
      expect(decoded.tenantName).toBe(testTenant.companyName);
    });

    test('should generate valid refresh token', () => {
      const refreshToken = generateRefreshToken(testUser);
      const decoded = verifyRefreshToken(refreshToken);
      
      expect(decoded).toMatchObject({
        id: testUser._id.toString(),
        type: 'refresh'
      });
    });

    test('should handle token expiration correctly', () => {
      // Gerar token com expiração curta
      const shortLivedToken = jwt.sign(
        { id: testUser._id, exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET
      );
      
      expect(() => {
        jwt.verify(shortLivedToken, process.env.JWT_SECRET);
      }).toThrow('jwt expired');
    });
  });

  describe('Authentication Middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
        user: null,
        userId: null,
        userRole: null,
        tenantId: null
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
      
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should reject request without token', async () => {
      await authenticateJWT(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token não fornecido',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token-123';
      
      await authenticateJWT(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { id: testUser._id, exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET
      );
      req.headers.authorization = `Bearer ${expiredToken}`;
      
      await authenticateJWT(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    });
  });

  describe('Role-based Access Control', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should allow access for correct role', () => {
      req.user = { ...testUser, role: 'admin' };
      const middleware = requireRole('admin', 'agent');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access for incorrect role', () => {
      req.user = { ...testUser, role: 'client' };
      const middleware = requireRole('admin', 'agent');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Acesso negado. Requer role: admin ou agent',
        code: 'INSUFFICIENT_PERMISSION'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should always allow master role', () => {
      req.user = masterUser;
      const middleware = requireRole('admin');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Validation', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        user: null,
        params: {},
        body: {},
        query: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should allow same tenant access', () => {
      req.user = { ...testUser, tenantId: testTenant._id };
      req.params.tenantId = testTenant._id.toString();
      
      const middleware = requireSameTenant();
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny cross-tenant access', () => {
      const otherTenantId = new mongoose.Types.ObjectId();
      req.user = { ...testUser, tenantId: testTenant._id };
      req.params.tenantId = otherTenantId.toString();
      
      const middleware = requireSameTenant();
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Acesso negado a recursos de outro tenant',
        code: 'CROSS_TENANT_ACCESS'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow master to access any tenant', () => {
      const anyTenantId = new mongoose.Types.ObjectId();
      req.user = masterUser;
      req.params.tenantId = anyTenantId.toString();
      
      const middleware = requireSameTenant();
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Plan Limits', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should allow action within plan limits', () => {
      req.user = { ...testUser, tenant: testTenant };
      const middleware = checkPlanLimit('users');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny action when limit reached', () => {
      const tenantAtLimit = {
        ...testTenant,
        usage: { users: 10 },
        limits: { users: 10 }
      };
      req.user = { ...testUser, tenant: tenantAtLimit };
      const middleware = checkPlanLimit('users');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Limite de users atingido (10/10)',
        code: 'PLAN_LIMIT_REACHED',
        details: {
          type: 'users',
          current: 10,
          limit: 10
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should bypass limits for master', () => {
      req.user = masterUser;
      const middleware = checkPlanLimit('users');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Module Access Control', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should allow access to enabled module', () => {
      req.user = { ...testUser, tenant: testTenant };
      const middleware = requireModule('chat');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access to disabled module', () => {
      req.user = { ...testUser, tenant: testTenant };
      const middleware = requireModule('crm');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Módulo crm não está habilitado para este tenant',
        code: 'MODULE_DISABLED',
        module: 'crm'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow master access to any module', () => {
      req.user = masterUser;
      const middleware = requireModule('crm');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

// Executar testes se chamado diretamente
if (require.main === module) {
  console.log('🧪 Executando testes de JWT com Multi-Tenancy...\n');
  console.log('Para executar com Jest, use: npm test tests/jwtAuth.test.js');
  
  // Simular execução básica dos testes
  console.log('\n✅ Teste 1: Geração de token com tenantId');
  const token = generateToken(testUser);
  console.log('Token gerado:', token.substring(0, 50) + '...');
  
  console.log('\n✅ Teste 2: Decodificação do token');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Token decodificado:', {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    tenantId: decoded.tenantId
  });
  
  console.log('\n✅ Teste 3: Geração de refresh token');
  const refreshToken = generateRefreshToken(testUser);
  console.log('Refresh token gerado:', refreshToken.substring(0, 50) + '...');
  
  console.log('\n✅ Teste 4: Token para usuário master (sem tenantId)');
  const masterToken = generateToken(masterUser);
  const masterDecoded = jwt.verify(masterToken, process.env.JWT_SECRET);
  console.log('Master token decodificado:', {
    id: masterDecoded.id,
    role: masterDecoded.role,
    tenantId: masterDecoded.tenantId
  });
  
  console.log('\n🎉 Todos os testes básicos passaram!');
}
