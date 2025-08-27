const express = require('express');
const router = express.Router();
const { auth: protect, authorize } = require('../middleware/auth');
const { loadTenant } = require('../middleware/tenantMiddleware');
const corsController = require('../controllers/corsController');

/**
 * @swagger
 * tags:
 *   name: CORS
 *   description: Gerenciamento de CORS por tenant
 */

/**
 * @swagger
 * /api/cors/test:
 *   get:
 *     tags: [CORS]
 *     summary: Testar configuração CORS
 *     description: Endpoint para testar se CORS está funcionando corretamente
 *     responses:
 *       200:
 *         description: Teste bem-sucedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 origin:
 *                   type: string
 *                 tenantId:
 *                   type: string
 */
router.get('/test', corsController.testCors);

// Rotas protegidas - requerem autenticação
router.use(protect);
router.use(loadTenant);

/**
 * @swagger
 * /api/cors/origins:
 *   get:
 *     tags: [CORS]
 *     summary: Obter origens permitidas do tenant
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de origens permitidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 tenantId:
 *                   type: string
 *                 origins:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/origins', corsController.getAllowedOrigins);

/**
 * @swagger
 * /api/cors/origins:
 *   post:
 *     tags: [CORS]
 *     summary: Adicionar nova origem permitida
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origin
 *             properties:
 *               origin:
 *                 type: string
 *                 example: https://app.example.com
 *     responses:
 *       200:
 *         description: Origem adicionada com sucesso
 */
router.post('/origins', authorize('admin'), corsController.addAllowedOrigin);

/**
 * @swagger
 * /api/cors/origins:
 *   put:
 *     tags: [CORS]
 *     summary: Atualizar lista completa de origens
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origins
 *             properties:
 *               origins:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://app.example.com", "https://www.example.com"]
 *     responses:
 *       200:
 *         description: Origens atualizadas com sucesso
 */
router.put('/origins', authorize('admin'), corsController.setAllowedOrigins);

/**
 * @swagger
 * /api/cors/origins:
 *   delete:
 *     tags: [CORS]
 *     summary: Remover origem permitida
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origin
 *             properties:
 *               origin:
 *                 type: string
 *                 example: https://old.example.com
 *     responses:
 *       200:
 *         description: Origem removida com sucesso
 */
router.delete('/origins', authorize('admin'), corsController.removeAllowedOrigin);

/**
 * @swagger
 * /api/cors/validate:
 *   get:
 *     tags: [CORS]
 *     summary: Validar se uma origem é permitida
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: origin
 *         required: true
 *         schema:
 *           type: string
 *         description: Origem a ser validada
 *     responses:
 *       200:
 *         description: Resultado da validação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 origin:
 *                   type: string
 *                 allowed:
 *                   type: boolean
 *                 reason:
 *                   type: string
 */
router.get('/validate', corsController.validateOrigin);

/**
 * @swagger
 * /api/cors/stats:
 *   get:
 *     tags: [CORS]
 *     summary: Obter estatísticas de acesso CORS
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas de acesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 */
router.get('/stats', corsController.getCorsStats);

/**
 * @swagger
 * /api/cors/stats:
 *   delete:
 *     tags: [CORS]
 *     summary: Limpar estatísticas de acesso
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas limpas com sucesso
 */
router.delete('/stats', authorize('admin'), corsController.clearCorsStats);

/**
 * @swagger
 * /api/cors/suggestions:
 *   get:
 *     tags: [CORS]
 *     summary: Obter sugestões de origens baseado em bloqueios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de sugestões
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       origin:
 *                         type: string
 *                       blockedCount:
 *                         type: number
 *                       suggestion:
 *                         type: string
 */
router.get('/suggestions', authorize('admin'), corsController.getSuggestedOrigins);

/**
 * @swagger
 * /api/cors/cache:
 *   delete:
 *     tags: [CORS]
 *     summary: Limpar cache de origens
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache limpo com sucesso
 */
router.delete('/cache', authorize('admin'), corsController.clearCache);

/**
 * @swagger
 * /api/cors/health:
 *   get:
 *     tags: [CORS]
 *     summary: Health check do serviço CORS
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status de saúde do serviço
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 cache:
 *                   type: object
 *                 stats:
 *                   type: object
 */
router.get('/health', corsController.getCorsHealth);

// Rotas administrativas para gerenciar CORS de outros tenants (master only)
/**
 * @swagger
 * /api/cors/tenant/{tenantId}/origins:
 *   get:
 *     tags: [CORS]
 *     summary: Obter origens de um tenant específico (Master)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do tenant
 *     responses:
 *       200:
 *         description: Lista de origens do tenant
 */
router.get('/tenant/:tenantId/origins', authorize('master'), corsController.getAllowedOrigins);

/**
 * @swagger
 * /api/cors/tenant/{tenantId}/origins:
 *   post:
 *     tags: [CORS]
 *     summary: Adicionar origem para um tenant específico (Master)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origin
 *             properties:
 *               origin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Origem adicionada
 */
router.post('/tenant/:tenantId/origins', authorize('master'), corsController.addAllowedOrigin);

/**
 * @swagger
 * /api/cors/tenant/{tenantId}/origins:
 *   put:
 *     tags: [CORS]
 *     summary: Atualizar origens de um tenant específico (Master)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origins
 *             properties:
 *               origins:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Origens atualizadas
 */
router.put('/tenant/:tenantId/origins', authorize('master'), corsController.setAllowedOrigins);

/**
 * @swagger
 * /api/cors/tenant/{tenantId}/origins:
 *   delete:
 *     tags: [CORS]
 *     summary: Remover origem de um tenant específico (Master)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origin
 *             properties:
 *               origin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Origem removida
 */
router.delete('/tenant/:tenantId/origins', authorize('master'), corsController.removeAllowedOrigin);

module.exports = router;
