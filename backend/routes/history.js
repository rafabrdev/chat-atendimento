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
/**
 * @swagger
 * /api/history/conversations:
 *   get:
 *     tags: [History]
 *     summary: Buscar histórico de conversas
 *     description: Retorna histórico de conversas com filtros opcionais
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, active, closed]
 *         description: Filtrar por status
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *         description: Filtrar por ID do agente
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filtrar por ID do cliente
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial (formato YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final (formato YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, closedAt, rating]
 *           default: createdAt
 *         description: Campo para ordenação
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Ordem de classificação
 *     responses:
 *       200:
 *         description: Histórico de conversas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Chat'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Não autorizado
 */
router.get('/conversations', getConversationHistory);
/**
 * @swagger
 * /api/history/conversations/{conversationId}:
 *   get:
 *     tags: [History]
 *     summary: Obter detalhes da conversa
 *     description: Retorna detalhes completos de uma conversa específica, incluindo mensagens
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *     responses:
 *       200:
 *         description: Detalhes da conversa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation:
 *                   $ref: '#/components/schemas/Chat'
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 attachments:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Conversa não encontrada
 */
router.get('/conversations/:conversationId', getConversationDetail);
/**
 * @swagger
 * /api/history/search:
 *   get:
 *     tags: [History]
 *     summary: Buscar conversas
 *     description: Busca conversas por texto nas mensagens ou metadados
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Termo de busca
 *         example: problema no pagamento
 *       - in: query
 *         name: searchIn
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [messages, subject, customer]
 *           default: [messages, subject]
 *         description: Campos onde buscar
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Resultados da busca
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       conversation:
 *                         $ref: '#/components/schemas/Chat'
 *                       matches:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             message:
 *                               type: string
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                 total:
 *                   type: integer
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autorizado
 */
router.get('/search', searchConversations);

// Export routes
/**
 * @swagger
 * /api/history/export/{conversationId}/csv:
 *   get:
 *     tags: [History]
 *     summary: Exportar conversa em CSV
 *     description: Exporta uma conversa e suas mensagens em formato CSV
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *     responses:
 *       200:
 *         description: Arquivo CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: attachment; filename="conversa_60d0fe4f5311236168a109ca.csv"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Conversa não encontrada
 */
router.get('/export/:conversationId/csv', exportConversationToCSV);

/**
 * @swagger
 * /api/history/export/{conversationId}/pdf:
 *   get:
 *     tags: [History]
 *     summary: Exportar conversa em PDF
 *     description: Exporta uma conversa e suas mensagens em formato PDF
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *     responses:
 *       200:
 *         description: Arquivo PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: attachment; filename="conversa_60d0fe4f5311236168a109ca.pdf"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Conversa não encontrada
 */
router.get('/export/:conversationId/pdf', exportConversationToPDF);

// Analytics routes
/**
 * @swagger
 * /api/history/analytics:
 *   get:
 *     tags: [History]
 *     summary: Obter análise de conversas
 *     description: Retorna estatísticas e análises das conversas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year, custom]
 *           default: month
 *         description: Período de análise
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial (para período custom)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final (para período custom)
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Agrupar dados por
 *     responses:
 *       200:
 *         description: Dados analíticos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalConversations:
 *                       type: integer
 *                     completedConversations:
 *                       type: integer
 *                     avgResolutionTime:
 *                       type: number
 *                       description: Tempo médio de resolução em minutos
 *                     avgMessagesPerConversation:
 *                       type: number
 *                     avgSatisfaction:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 5
 *                 timeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       conversations:
 *                         type: integer
 *                       messages:
 *                         type: integer
 *                       avgResponseTime:
 *                         type: number
 *                 topAgents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       agentId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       totalConversations:
 *                         type: integer
 *                       avgSatisfaction:
 *                         type: number
 *                 peakHours:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       hour:
 *                         type: integer
 *                       conversations:
 *                         type: integer
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão - Apenas administradores
 */
router.get('/analytics', getConversationAnalytics);

module.exports = router;
