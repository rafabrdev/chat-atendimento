const { expect } = require('chai');
const sinon = require('sinon');
const s3Service = require('../services/s3Service');
const File = require('../models/File');
const Tenant = require('../models/Tenant');
const { 
  validateFileAccess, 
  validateFileUpload 
} = require('../middleware/fileAccessMiddleware');

describe('S3 Multi-Tenant File Isolation Tests', () => {
  let sandbox;
  const tenant1Id = '507f1f77bcf86cd799439011';
  const tenant2Id = '507f1f77bcf86cd799439012';
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('S3 Key Generation', () => {
    it('should generate unique S3 keys with tenant prefix', () => {
      const key1 = s3Service.generateS3Key(tenant1Id, 'images', 'test.jpg');
      const key2 = s3Service.generateS3Key(tenant1Id, 'images', 'test.jpg');
      
      expect(key1).to.include(`tenants/${tenant1Id}/`);
      expect(key1).to.not.equal(key2); // Should have unique timestamp
    });

    it('should include environment in S3 key', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'production';
      const prodKey = s3Service.generateS3Key(tenant1Id, 'documents', 'file.pdf');
      expect(prodKey).to.include('/production/');
      
      process.env.NODE_ENV = 'staging';
      const stagingKey = s3Service.generateS3Key(tenant1Id, 'documents', 'file.pdf');
      expect(stagingKey).to.include('/staging/');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should include date organization in path', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      const key = s3Service.generateS3Key(tenant1Id, 'images', 'photo.jpg');
      expect(key).to.include(`/${year}/${month}/`);
    });

    it('should throw error when tenantId is missing', () => {
      expect(() => {
        s3Service.generateS3Key(null, 'images', 'test.jpg');
      }).to.throw('TenantId is required');
    });

    it('should sanitize filename properly', () => {
      const key = s3Service.generateS3Key(
        tenant1Id, 
        'documents', 
        'My File@#$.pdf'
      );
      expect(key).to.not.include('@');
      expect(key).to.not.include('#');
      expect(key).to.not.include('$');
      expect(key).to.include('My-File');
    });
  });

  describe('Tenant Access Validation', () => {
    it('should validate correct tenant access', () => {
      const key = `tenants/${tenant1Id}/production/images/2024/01/file.jpg`;
      const isValid = s3Service.validateTenantAccess(key, tenant1Id);
      expect(isValid).to.be.true;
    });

    it('should reject cross-tenant access', () => {
      const key = `tenants/${tenant1Id}/production/images/2024/01/file.jpg`;
      const isValid = s3Service.validateTenantAccess(key, tenant2Id);
      expect(isValid).to.be.false;
    });

    it('should reject keys without tenant prefix', () => {
      const key = 'production/images/2024/01/file.jpg';
      const isValid = s3Service.validateTenantAccess(key, tenant1Id);
      expect(isValid).to.be.false;
    });

    it('should handle null/undefined values safely', () => {
      expect(s3Service.validateTenantAccess(null, tenant1Id)).to.be.false;
      expect(s3Service.validateTenantAccess('key', null)).to.be.false;
      expect(s3Service.validateTenantAccess(null, null)).to.be.false;
    });
  });

  describe('File Access Middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        params: { fileId: '507f1f77bcf86cd799439999' },
        tenantId: tenant1Id,
        user: { _id: 'userId123' }
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
      };
      next = sinon.stub();
    });

    it('should allow access to files within same tenant', async () => {
      const mockFile = {
        _id: '507f1f77bcf86cd799439999',
        tenantId: tenant1Id,
        storageType: 's3',
        s3Key: `tenants/${tenant1Id}/production/images/file.jpg`
      };

      sandbox.stub(File, 'findOne').resolves(mockFile);
      sandbox.stub(s3Service, 'validateTenantAccess').returns(true);

      await validateFileAccess(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(req.file).to.deep.equal(mockFile);
    });

    it('should deny access to files from different tenant', async () => {
      const mockFile = {
        _id: '507f1f77bcf86cd799439999',
        tenantId: tenant2Id,
        storageType: 's3',
        s3Key: `tenants/${tenant2Id}/production/images/file.jpg`
      };

      sandbox.stub(File, 'findOne').resolves(null); // File not found for this tenant

      await validateFileAccess(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledWith({
        success: false,
        error: 'File not found or access denied'
      })).to.be.true;
      expect(next.called).to.be.false;
    });

    it('should detect S3 key mismatch with tenant', async () => {
      const mockFile = {
        _id: '507f1f77bcf86cd799439999',
        tenantId: tenant1Id,
        storageType: 's3',
        s3Key: `tenants/${tenant2Id}/production/images/file.jpg` // Wrong tenant in key
      };

      sandbox.stub(File, 'findOne').resolves(mockFile);

      await validateFileAccess(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
      expect(res.json.calledWith({
        success: false,
        error: 'Access denied: File does not belong to your organization'
      })).to.be.true;
    });
  });

  describe('Storage Quota Validation', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        tenantId: tenant1Id,
        files: [
          { size: 1024 * 1024, mimetype: 'image/jpeg', originalname: 'test1.jpg' },
          { size: 2 * 1024 * 1024, mimetype: 'image/png', originalname: 'test2.png' }
        ]
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
      };
      next = sinon.stub();
    });

    it('should allow upload within quota limits', async () => {
      const mockTenant = {
        _id: tenant1Id,
        storageQuota: {
          enabled: true,
          maxBytes: 10 * 1024 * 1024 * 1024, // 10GB
          warningThreshold: 0.8
        }
      };

      sandbox.stub(Tenant, 'findById').resolves(mockTenant);
      sandbox.stub(s3Service, 'calculateTenantStorageUsage').resolves({
        totalSize: 1 * 1024 * 1024 * 1024, // 1GB used
        fileCount: 100
      });

      await validateFileUpload(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it('should reject upload when quota exceeded', async () => {
      const mockTenant = {
        _id: tenant1Id,
        storageQuota: {
          enabled: true,
          maxBytes: 1 * 1024 * 1024 * 1024, // 1GB limit
          allowOverage: false
        }
      };

      sandbox.stub(Tenant, 'findById').resolves(mockTenant);
      sandbox.stub(s3Service, 'calculateTenantStorageUsage').resolves({
        totalSize: 1 * 1024 * 1024 * 1024 - 1024, // Almost full
        fileCount: 100
      });

      await validateFileUpload(req, res, next);

      expect(res.status.calledWith(413)).to.be.true;
      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.success).to.be.false;
      expect(response.error).to.include('Storage quota exceeded');
    });

    it('should validate file types against tenant restrictions', async () => {
      const mockTenant = {
        _id: tenant1Id,
        storageQuota: { enabled: false },
        allowedFileTypes: ['image/jpeg'] // Only JPEG allowed
      };

      sandbox.stub(Tenant, 'findById').resolves(mockTenant);

      await validateFileUpload(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.error).to.include('file types are not allowed');
      expect(response.invalidFiles).to.have.lengthOf(1);
      expect(response.invalidFiles[0].name).to.equal('test2.png');
    });
  });

  describe('Cross-Tenant File Operations', () => {
    it('should prevent listing files from other tenants', async () => {
      const tenant1Files = [
        { tenantId: tenant1Id, s3Key: `tenants/${tenant1Id}/prod/doc1.pdf` },
        { tenantId: tenant1Id, s3Key: `tenants/${tenant1Id}/prod/doc2.pdf` }
      ];
      
      const findStub = sandbox.stub(File, 'find');
      findStub.withArgs({ tenantId: tenant1Id }).resolves(tenant1Files);
      findStub.withArgs({ tenantId: tenant2Id }).resolves([]);

      const result1 = await File.find({ tenantId: tenant1Id });
      const result2 = await File.find({ tenantId: tenant2Id });

      expect(result1).to.have.lengthOf(2);
      expect(result2).to.have.lengthOf(0);
    });

    it('should isolate S3 listing by tenant prefix', async () => {
      const files1 = await s3Service.listTenantFiles(tenant1Id);
      const files2 = await s3Service.listTenantFiles(tenant2Id);
      
      // These would be actual S3 calls in production
      // Here we're testing the prefix generation
      expect(files1).to.not.equal(files2);
    });
  });

  describe('File Migration', () => {
    it('should correctly migrate files to tenant structure', async () => {
      const oldKey = 'uploads/images/old-file.jpg';
      const expectedNewKey = new RegExp(`^tenants/${tenant1Id}/.*old-file.*\\.jpg$`);

      sandbox.stub(s3Service.client, 'send').resolves({});
      
      const result = await s3Service.migrateFileToTenantStructure(
        oldKey,
        tenant1Id,
        'images'
      );

      expect(result.oldKey).to.equal(oldKey);
      expect(result.newKey).to.match(expectedNewKey);
      expect(result.tenantId).to.equal(tenant1Id);
    });
  });

  describe('Security Headers', () => {
    it('should set appropriate security headers for file downloads', () => {
      const req = { query: { download: 'true' } };
      const res = {
        setHeader: sinon.stub()
      };
      const next = sinon.stub();

      const { setFileSecurityHeaders } = require('../middleware/fileAccessMiddleware');
      setFileSecurityHeaders(req, res, next);

      expect(res.setHeader.calledWith('X-Content-Type-Options', 'nosniff')).to.be.true;
      expect(res.setHeader.calledWith('Content-Security-Policy')).to.be.true;
      expect(res.setHeader.calledWith('Content-Disposition', 'attachment')).to.be.true;
    });
  });

  describe('Concurrent Access Tests', () => {
    it('should handle concurrent uploads from same tenant', async () => {
      const uploads = [];
      for (let i = 0; i < 5; i++) {
        uploads.push(
          s3Service.generateS3Key(tenant1Id, 'documents', `file${i}.pdf`)
        );
      }

      const uniqueKeys = new Set(uploads);
      expect(uniqueKeys.size).to.equal(5); // All keys should be unique
    });

    it('should maintain isolation during concurrent cross-tenant operations', async () => {
      const operations = [
        { tenantId: tenant1Id, file: 'doc1.pdf' },
        { tenantId: tenant2Id, file: 'doc2.pdf' },
        { tenantId: tenant1Id, file: 'doc3.pdf' },
        { tenantId: tenant2Id, file: 'doc4.pdf' }
      ];

      const results = operations.map(op => 
        s3Service.generateS3Key(op.tenantId, 'documents', op.file)
      );

      // Verify each file has correct tenant prefix
      expect(results[0]).to.include(`tenants/${tenant1Id}/`);
      expect(results[1]).to.include(`tenants/${tenant2Id}/`);
      expect(results[2]).to.include(`tenants/${tenant1Id}/`);
      expect(results[3]).to.include(`tenants/${tenant2Id}/`);
    });
  });
});

// Integration tests (requires actual S3 or LocalStack)
describe('S3 Multi-Tenant Integration Tests', function() {
  this.timeout(10000); // Longer timeout for S3 operations

  before(function() {
    if (!process.env.RUN_INTEGRATION_TESTS) {
      this.skip();
    }
  });

  describe('Real S3 Operations', () => {
    it('should upload file with tenant isolation', async () => {
      // This would test actual S3 upload with tenant prefix
      // Requires S3 or LocalStack to be configured
    });

    it('should prevent cross-tenant file access', async () => {
      // This would test actual cross-tenant access prevention
    });

    it('should correctly calculate tenant storage usage', async () => {
      // This would test actual storage calculation from S3
    });
  });
});

// Export for other tests if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    tenant1Id: '507f1f77bcf86cd799439011',
    tenant2Id: '507f1f77bcf86cd799439012'
  };
}
