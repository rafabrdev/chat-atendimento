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

/**
 * @swagger
 * /api/agents/profile/{agentId}:
 *   get:
 *     tags: [Users]
 *     summary: Obter perfil do agente
 *     description: Retorna o perfil de um agente específico ou do agente atual
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: false
 *         schema:
 *           type: string
 *         description: ID do agente (opcional, usa o usuário atual se não fornecido)
 *     responses:
 *       200:
 *         description: Perfil do agente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [online, away, busy, offline]
 *                 availability:
 *                   type: boolean
 *                 currentLoad:
 *                   type: integer
 *                 maxLoad:
 *                   type: integer
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Agente não encontrado
 */
router.get('/profile/:agentId?', getAgentProfile);
/**
 * @swagger
 * /api/agents/status:
 *   put:
 *     tags: [Users]
 *     summary: Atualizar status do agente
 *     description: Atualiza o status do agente (online, away, busy, offline)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [online, away, busy, offline]
 *                 example: online
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 agent:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Status inválido
 *       403:
 *         description: Sem permissão - Apenas agentes e administradores
 */
router.put('/status', authorize('agent', 'admin'), updateAgentStatus);
/**
 * @swagger
 * /api/agents/availability:
 *   put:
 *     tags: [Users]
 *     summary: Atualizar disponibilidade
 *     description: Define se o agente está disponível para receber novos atendimentos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - available
 *             properties:
 *               available:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Disponibilidade atualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 availability:
 *                   type: boolean
 *       403:
 *         description: Sem permissão
 */
router.put('/availability', authorize('agent', 'admin'), updateAgentAvailability);
/**
 * @swagger
 * /api/agents/preferences:
 *   put:
 *     tags: [Users]
 *     summary: Atualizar preferências do agente
 *     description: Atualiza preferências de atendimento do agente
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxConcurrentChats:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 example: 3
 *               notificationsEnabled:
 *                 type: boolean
 *                 example: true
 *               soundEnabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Preferências atualizadas
 *       403:
 *         description: Sem permissão
 */
router.put('/preferences', authorize('agent', 'admin'), updateAgentPreferences);

// Performance and metrics
/**
 * @swagger
 * /api/agents/performance:
 *   get:
 *     tags: [Users]
 *     summary: Obter performance do agente
 *     description: Retorna métricas de performance do agente atual
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *           default: today
 *         description: Período para análise
 *     responses:
 *       200:
 *         description: Métricas de performance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalChats:
 *                   type: integer
 *                 resolvedChats:
 *                   type: integer
 *                 avgResponseTime:
 *                   type: number
 *                 avgResolutionTime:
 *                   type: number
 *                 satisfaction:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 5
 *                 totalRatings:
 *                   type: integer
 */
router.get('/performance', getAgentPerformance); // Rota sem parâmetro obrigatório

/**
 * @swagger
 * /api/agents/performance/{agentId}:
 *   get:
 *     tags: [Users]
 *     summary: Obter performance de agente específico
 *     description: Retorna métricas de performance de um agente específico (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do agente
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *           default: today
 *     responses:
 *       200:
 *         description: Métricas de performance
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Agente não encontrado
 */
router.get('/performance/:agentId', getAgentPerformance); // Rota com parâmetro
/**
 * @swagger
 * /api/agents/workload:
 *   get:
 *     tags: [Users]
 *     summary: Obter distribuição de carga de trabalho
 *     description: Retorna a distribuição atual de conversas entre agentes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Distribuição de carga de trabalho
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   agentId:
 *                     type: string
 *                   agentName:
 *                     type: string
 *                   currentLoad:
 *                     type: integer
 *                   maxLoad:
 *                     type: integer
 *                   status:
 *                     type: string
 *                   activeChats:
 *                     type: array
 *                     items:
 *                       type: string
 *       403:
 *         description: Sem permissão
 */
router.get('/workload', authorize('agent', 'admin'), getWorkloadDistribution);

// Admin routes
/**
 * @swagger
 * /api/agents/all:
 *   get:
 *     tags: [Users]
 *     summary: Listar todos os agentes
 *     description: Retorna lista de todos os agentes do sistema
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [online, away, busy, offline]
 *         description: Filtrar por status
 *       - in: query
 *         name: available
 *         schema:
 *           type: boolean
 *         description: Filtrar por disponibilidade
 *     responses:
 *       200:
 *         description: Lista de agentes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Sem permissão
 */
router.get('/all', authorize('agent', 'admin'), getAllAgents);
/**
 * @swagger
 * /api/agents/auto-assign:
 *   post:
 *     tags: [Users]
 *     summary: Auto-atribuir conversa
 *     description: Atribui automaticamente uma conversa ao agente mais adequado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *             properties:
 *               conversationId:
 *                 type: string
 *                 example: 60d0fe4f5311236168a109ca
 *               department:
 *                 type: string
 *                 example: vendas
 *     responses:
 *       200:
 *         description: Conversa atribuída com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 assignedAgent:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 conversation:
 *                   $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Nenhum agente disponível
 *       403:
 *         description: Sem permissão
 */
router.post('/auto-assign', authorize('agent', 'admin'), autoAssignAgent);

module.exports = router;
