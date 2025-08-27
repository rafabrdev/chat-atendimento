const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/jwtAuth');
const { loadTenant } = require('../middleware/tenantMiddleware');
const {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  confirmUpload,
  getStorageUsage
} = require('../controllers/uploadController');

// Apply authentication and tenant resolution to all routes
router.use(authenticateJWT);
router.use(loadTenant);

/**
 * @route   POST /api/upload/presigned-url
 * @desc    Generate presigned URL for direct upload to S3
 * @access  Private
 * @body    { filename, contentType, size, conversationId? }
 */
router.post('/presigned-url', generatePresignedUploadUrl);

/**
 * @route   POST /api/upload/presigned-download-url
 * @desc    Generate presigned URL for secure download from S3
 * @access  Private
 * @body    { key? | fileId? }
 */
router.post('/presigned-download-url', generatePresignedDownloadUrl);

/**
 * @route   POST /api/upload/confirm
 * @desc    Confirm upload completion and create database record
 * @access  Private
 * @body    { key, conversationId?, messageId? }
 */
router.post('/confirm', confirmUpload);

/**
 * @route   GET /api/upload/storage-usage
 * @desc    Get current storage usage for tenant
 * @access  Private
 */
router.get('/storage-usage', getStorageUsage);

module.exports = router;
