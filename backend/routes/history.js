const express = require('express');
const router = express.Router();
const { auth: protect } = require('../middleware/auth');
const {
  getConversationHistory,
  getConversationDetail,
  exportConversationToCSV,
  exportConversationToPDF,
  getConversationAnalytics,
  searchConversations
} = require('../controllers/historyController');

// All routes require authentication
router.use(protect);

// History routes
router.get('/conversations', getConversationHistory);
router.get('/conversations/:conversationId', getConversationDetail);
router.get('/search', searchConversations);

// Export routes
router.get('/export/:conversationId/csv', exportConversationToCSV);
router.get('/export/:conversationId/pdf', exportConversationToPDF);

// Analytics routes
router.get('/analytics', getConversationAnalytics);

module.exports = router;
