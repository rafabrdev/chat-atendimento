const express = require('express');
const router = express.Router();
const { auth: protect } = require('../middleware/auth');
const { upload, handleUploadError } = require('../config/uploadS3');
const {
  uploadFiles,
  getConversationFiles,
  downloadFile,
  deleteFile
} = require('../controllers/fileController');

// All routes require authentication
router.use(protect);

// Upload files to a conversation
router.post(
  '/upload',
  upload.array('files', 5),
  handleUploadError,
  uploadFiles
);

// Get files for a conversation
router.get('/conversation/:conversationId', getConversationFiles);

// Download a file
router.get('/download/:fileId', downloadFile);

// Delete a file
router.delete('/:fileId', deleteFile);

module.exports = router;
