# 📁 S3 Multi-Tenant File Storage Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Implementation Details](#implementation-details)
- [Security Features](#security-features)
- [Storage Quotas](#storage-quotas)
- [Migration Guide](#migration-guide)
- [Maintenance](#maintenance)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Overview

The S3 Multi-Tenant File Storage system provides complete isolation of files between different tenants (organizations) in the application. Each tenant has its own dedicated namespace in S3, preventing any cross-tenant data access.

### Key Features
- ✅ **Complete Tenant Isolation**: Files are physically separated by tenant ID
- ✅ **Storage Quota Management**: Per-tenant storage limits and monitoring
- ✅ **Secure Access Control**: Validation at multiple levels
- ✅ **Automatic Organization**: Files organized by date and type
- ✅ **Migration Support**: Tools to migrate existing files
- ✅ **Orphaned File Cleanup**: Automatic removal of unused files

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                      │
├─────────────────────────────────────────────────────────┤
│  FileController  │  FileAccessMiddleware  │  Routes     │
├─────────────────────────────────────────────────────────┤
│                     S3Service                            │
├─────────────────────────────────────────────────────────┤
│                   AWS S3 / LocalStack                    │
└─────────────────────────────────────────────────────────┘
```

### Key Files

- **`services/s3Service.js`**: Core S3 operations with tenant isolation
- **`middleware/fileAccessMiddleware.js`**: Access control and validation
- **`config/uploadS3.js`**: Multer configuration with tenant prefixes
- **`controllers/fileController.js`**: File operations controller
- **`models/File.js`**: File metadata model
- **`models/Tenant.js`**: Tenant model with storage quotas

## File Structure

### S3 Key Format

```
tenants/{tenantId}/{environment}/{fileType}/{year}/{month}/{filename}
```

#### Example Structure
```
tenants/
├── 507f1f77bcf86cd799439011/           # Tenant 1
│   ├── production/
│   │   ├── images/
│   │   │   ├── 2024/
│   │   │   │   ├── 01/
│   │   │   │   │   ├── logo-1704123456789-987654321.png
│   │   │   │   │   └── banner-1704123456790-987654322.jpg
│   │   │   │   └── 02/
│   │   │   │       └── profile-1706801234567-123456789.jpg
│   │   │   └── documents/
│   │   │       └── 2024/
│   │   │           └── 01/
│   │   │               └── contract-1704123456791-987654323.pdf
│   │   └── staging/
│   │       └── ...
│   └── development/
│       └── ...
└── 507f1f77bcf86cd799439012/           # Tenant 2
    └── production/
        └── ...
```

### File Types

Files are automatically categorized:
- **images**: JPEG, PNG, GIF, WebP, SVG
- **documents**: PDF, Word, Excel, PowerPoint, Text, CSV
- **videos**: MP4, MPEG, QuickTime, AVI, WebM
- **audio**: MP3, WAV, WebM, OGG
- **others**: Everything else

## Implementation Details

### 1. Uploading Files

```javascript
// Files are automatically prefixed with tenant ID during upload
POST /api/files/upload

// Multer middleware adds tenant prefix
key: function (req, file, cb) {
  const tenantId = req.tenantId;
  const key = `tenants/${tenantId}/${environment}/${fileType}/${year}/${month}/${filename}`;
  cb(null, key);
}
```

### 2. Access Validation

Multiple layers of security:

1. **Database Level**: Files filtered by tenantId
2. **S3 Key Validation**: Verify key belongs to tenant
3. **Middleware Validation**: Check before any operation

```javascript
// Validation example
if (!s3Service.validateTenantAccess(file.s3Key, req.tenantId)) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### 3. Downloading Files

```javascript
// Generate signed URL with tenant validation
const downloadUrl = await s3Service.getSignedDownloadUrl(
  file.s3Key,
  req.tenantId,
  3600 // 1 hour expiration
);
```

### 4. Deleting Files

```javascript
// Delete with tenant verification
await s3Service.deleteFile(file.s3Key, req.tenantId);
```

## Security Features

### Access Control

1. **Tenant ID Verification**: Every request validates tenant context
2. **S3 Key Validation**: Keys must match tenant prefix
3. **Cross-Tenant Prevention**: Automatic blocking of cross-tenant access
4. **Signed URLs**: Time-limited access tokens for downloads

### Security Headers

Files served with security headers:
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'none'`
- `Content-Disposition: attachment` (for downloads)

### File Sanitization

- Filenames are sanitized to prevent path traversal
- Special characters replaced with hyphens
- Maximum filename length enforced

## Storage Quotas

### Tenant Configuration

```javascript
// In Tenant model
storageQuota: {
  enabled: true,
  maxBytes: 5 * 1024 * 1024 * 1024, // 5GB
  warningThreshold: 0.8,              // Warn at 80%
  allowOverage: false,                 // Block uploads when exceeded
  overageRate: 0                      // Cost per GB if overage allowed
}
```

### Quota Checking

```javascript
// Check before upload
const quotaCheck = await tenant.checkStorageQuota(fileSize);
if (!quotaCheck.allowed) {
  return res.status(413).json({
    error: 'Storage quota exceeded',
    currentUsage: quotaCheck.currentUsage,
    limit: quotaCheck.limit
  });
}
```

### Storage Calculation

```javascript
// Get current usage
const usage = await s3Service.calculateTenantStorageUsage(tenantId);
// Returns: { totalSize, fileCount, totalSizeMB, totalSizeGB }
```

## Migration Guide

### Migrating Existing Files

1. **Dry Run** (test without changes):
```bash
node scripts/migrateS3Files.js --dry-run
```

2. **Migrate Specific Tenant**:
```bash
node scripts/migrateS3Files.js --tenant-id=507f1f77bcf86cd799439011
```

3. **Migrate All Tenants**:
```bash
node scripts/migrateS3Files.js
```

### Migration Process

1. Scans existing files in S3
2. Creates new key with tenant prefix
3. Copies file to new location
4. Updates database references
5. Deletes old file
6. Generates migration report

### Migration Report

Reports saved as `migration-report-{timestamp}.json`:
```json
{
  "date": "2024-01-15T10:30:00Z",
  "totalProcessed": 1500,
  "totalMigrated": 1450,
  "totalErrors": 2,
  "orphanedFiles": 48,
  "tenantStats": [...]
}
```

## Maintenance

### Orphaned File Cleanup

Remove files without database references:

1. **Manual Cleanup**:
```bash
# Dry run
node jobs/cleanupOrphanedFiles.js --dry-run

# Execute cleanup (files older than 7 days)
node jobs/cleanupOrphanedFiles.js --max-age=7
```

2. **Scheduled Cleanup**:
```javascript
// Add to cron job (daily at 3 AM)
const { runCleanup } = require('./jobs/cleanupOrphanedFiles');
schedule.scheduleJob('0 3 * * *', () => {
  runCleanup({ dryRun: false, maxAge: 7 });
});
```

### Environment Variables

```env
# S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Optional: LocalStack for development
S3_ENDPOINT=http://localhost:4566
USE_S3=true

# Cleanup Settings
CLEANUP_DRY_RUN=false
CLEANUP_BATCH_SIZE=100
CLEANUP_MAX_AGE_DAYS=7
```

## API Reference

### S3Service Methods

#### `generateS3Key(tenantId, fileType, filename)`
Generate S3 key with tenant prefix

#### `validateTenantAccess(s3Key, tenantId)`
Verify key belongs to tenant

#### `uploadFile(tenantId, file, fileType)`
Upload file with tenant isolation

#### `getSignedDownloadUrl(s3Key, tenantId, expiresIn)`
Generate time-limited download URL

#### `deleteFile(s3Key, tenantId)`
Delete file with validation

#### `listTenantFiles(tenantId, options)`
List files for specific tenant

#### `calculateTenantStorageUsage(tenantId)`
Calculate storage usage

#### `migrateFileToTenantStructure(oldKey, tenantId, fileType)`
Migrate file to new structure

### Middleware Functions

#### `validateFileAccess`
Validate file access before operations

#### `validateFileUpload`
Check quotas and file types

#### `validateFileList`
Validate file listing requests

#### `sanitizeFilename`
Clean filename for security

#### `setFileSecurityHeaders`
Add security headers to response

## Troubleshooting

### Common Issues

#### 1. **TenantId Missing Error**
```
Error: TenantId is required for file upload
```
**Solution**: Ensure `loadTenant` middleware is applied before file routes

#### 2. **Cross-Tenant Access Denied**
```
Error: Access denied: File does not belong to your organization
```
**Solution**: This is expected behavior. Check if correct tenant context is being used

#### 3. **Storage Quota Exceeded**
```
Error: Storage quota exceeded. Current usage: 4.8GB / 5GB
```
**Solution**: 
- Increase tenant quota
- Clean up old files
- Enable overage if appropriate

#### 4. **S3 Connection Issues**
```
Error: Failed to upload file to S3
```
**Solution**: 
- Check AWS credentials
- Verify S3 bucket exists
- Check IAM permissions

### Testing

Run tests:
```bash
# Unit tests
npm test tests/s3MultiTenant.test.js

# Integration tests (requires S3/LocalStack)
RUN_INTEGRATION_TESTS=true npm test
```

### Monitoring

Key metrics to track:
- Storage usage per tenant
- Upload/download errors
- Quota violations
- Orphaned files count
- Migration status

### Best Practices

1. **Regular Cleanup**: Run orphaned file cleanup weekly
2. **Monitor Quotas**: Alert when tenants reach 80% usage
3. **Backup Before Migration**: Always backup before migrating files
4. **Test in Staging**: Test migrations in staging environment first
5. **Audit Logs**: Keep logs of all file operations for security
6. **Rate Limiting**: Implement rate limiting for file operations
7. **Virus Scanning**: Consider adding virus scanning for uploads

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review migration reports in `reports/` directory
3. Enable debug mode: `DEBUG=s3:* node app.js`
4. Contact system administrator for quota increases

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Status**: Production Ready
