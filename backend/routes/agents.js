const express = require('express');
const router = express.Router();
const { auth: protect, authorize } = require('../middleware/auth');
const {
  getAgentProfile,
  updateAgentStatus,
  updateAgentAvailability,
  getAllAgents,
  getAgentPerformance,
  getWorkloadDistribution,
  autoAssignAgent,
  updateAgentPreferences
} = require('../controllers/agentController');

// All routes require authentication
router.use(protect);

// Agent-specific routes
router.get('/profile/:agentId?', getAgentProfile);
router.put('/status', authorize('agent', 'admin'), updateAgentStatus);
router.put('/availability', authorize('agent', 'admin'), updateAgentAvailability);
router.put('/preferences', authorize('agent', 'admin'), updateAgentPreferences);

// Performance and metrics
router.get('/performance', getAgentPerformance); // Rota sem parâmetro obrigatório
router.get('/performance/:agentId', getAgentPerformance); // Rota com parâmetro
router.get('/workload', authorize('agent', 'admin'), getWorkloadDistribution);

// Admin routes
router.get('/all', authorize('agent', 'admin'), getAllAgents);
router.post('/auto-assign', authorize('agent', 'admin'), autoAssignAgent);

module.exports = router;
