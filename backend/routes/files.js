const express = require('express');
const router = express.Router();
const { auth: protect } = require('../middleware/auth');
const { loadTenant, applyTenantFilter } = require('../middleware/tenantMiddleware');
const { upload, handleUploadError } = require('../config/uploadS3');
const {
  validateFileAccess,
  validateFileUpload,
  validateFileList,
  sanitizeFilename,
  setFileSecurityHeaders
} = require('../middleware/fileAccessMiddleware');
const {
  uploadFiles,
  getConversationFiles,
  downloadFile,
  deleteFile
} = require('../controllers/fileController');

// All routes require authentication and tenant context
router.use(protect);
router.use(loadTenant);
router.use(applyTenantFilter);

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     tags: [Files]
 *     summary: Upload de arquivos
 *     description: Faz upload de até 5 arquivos para uma conversa. Arquivos são armazenados no AWS S3.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *               - conversationId
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 5
 *                 description: Arquivos para upload (máximo 5)
 *               conversationId:
 *                 type: string
 *                 description: ID da conversa associada
 *                 example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Upload realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       filename:
 *                         type: string
 *                       originalName:
 *                         type: string
 *                       mimetype:
 *                         type: string
 *                       size:
 *                         type: number
 *                       s3Key:
 *                         type: string
 *                       s3Bucket:
 *                         type: string
 *                       url:
 *                         type: string
 *       400:
 *         description: Erro no upload ou arquivo inválido
 *       401:
 *         description: Não autorizado
 *       413:
 *         description: 'Arquivo muito grande (limite: 10MB)'
 */
router.post(
  '/upload',
  sanitizeFilename,
  upload.array('files', 5),
  handleUploadError,
  validateFileUpload,
  uploadFiles
);

/**
 * @swagger
 * /api/files/conversation/{conversationId}:
 *   get:
 *     tags: [Files]
 *     summary: Listar arquivos de uma conversa
 *     description: Retorna todos os arquivos associados a uma conversa específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conversa
 *         example: 60d0fe4f5311236168a109ca
 *     responses:
 *       200:
 *         description: Lista de arquivos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   filename:
 *                     type: string
 *                   originalName:
 *                     type: string
 *                   mimetype:
 *                     type: string
 *                   size:
 *                     type: number
 *                   url:
 *                     type: string
 *                   uploadedBy:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Conversa não encontrada
 */
router.get('/conversation/:conversationId', validateFileList, getConversationFiles);

/**
 * @swagger
 * /api/files/download/{fileId}:
 *   get:
 *     tags: [Files]
 *     summary: Baixar arquivo
 *     description: Retorna URL assinada para download do arquivo do S3
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do arquivo
 *         example: 60d0fe4f5311236168a109cb
 *     responses:
 *       200:
 *         description: URL de download gerada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 downloadUrl:
 *                   type: string
 *                   description: URL assinada temporária para download (válida por 1 hora)
 *                   example: https://s3.amazonaws.com/bucket/file?signature=...
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Arquivo não encontrado
 */
router.get('/download/:fileId', validateFileAccess, setFileSecurityHeaders, downloadFile);

/**
 * @swagger
 * /api/files/{fileId}:
 *   delete:
 *     tags: [Files]
 *     summary: Excluir arquivo
 *     description: Remove um arquivo do S3 e do banco de dados
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do arquivo
 *         example: 60d0fe4f5311236168a109cb
 *     responses:
 *       200:
 *         description: Arquivo excluído com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Arquivo excluído com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Sem permissão para excluir este arquivo
 *       404:
 *         description: Arquivo não encontrado
 */
router.delete('/:fileId', validateFileAccess, deleteFile);

module.exports = router;
