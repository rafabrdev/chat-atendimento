const File = require('../models/File');
const s3Service = require('../services/s3Service');

/**
 * Middleware para validar acesso a arquivos com isolamento por tenant
 */
const validateFileAccess = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const tenantId = req.tenantId;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context is required'
      });
    }

    // Buscar arquivo no banco com filtro de tenant
    const file = await File.findOne({
      _id: fileId,
      tenantId: tenantId
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found or access denied'
      });
    }

    // Validação adicional para arquivos S3
    if (file.storageType === 's3' && file.s3Key) {
      // Verificar se a key do S3 pertence ao tenant
      if (!s3Service.validateTenantAccess(file.s3Key, tenantId)) {
        console.error(`Security violation: File ${fileId} S3 key does not match tenant ${tenantId}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied: File does not belong to your organization'
        });
      }
    }

    // Adicionar arquivo ao request para uso posterior
    req.file = file;
    next();
  } catch (error) {
    console.error('File access validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error validating file access'
    });
  }
};

/**
 * Middleware para validar upload de arquivo com quota do tenant
 */
const validateFileUpload = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context is required for file upload'
      });
    }

    // Verificar se há arquivos para upload
    if (!req.files || req.files.length === 0) {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No files to upload'
        });
      }
      // Converter file único para array para processamento uniforme
      req.files = [req.file];
    }

    // Calcular tamanho total dos arquivos
    const totalSize = req.files.reduce((acc, file) => acc + file.size, 0);

    // Buscar informações do tenant para validar quota
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Verificar quota de armazenamento (se implementado)
    if (tenant.storageQuota && tenant.storageQuota.enabled) {
      const currentUsage = await s3Service.calculateTenantStorageUsage(tenantId);
      const newTotalUsage = currentUsage.totalSize + totalSize;
      
      if (newTotalUsage > tenant.storageQuota.maxBytes) {
        const maxGB = (tenant.storageQuota.maxBytes / (1024 * 1024 * 1024)).toFixed(2);
        const currentGB = (currentUsage.totalSize / (1024 * 1024 * 1024)).toFixed(2);
        
        return res.status(413).json({
          success: false,
          error: `Storage quota exceeded. Current usage: ${currentGB}GB / ${maxGB}GB`,
          details: {
            currentUsageBytes: currentUsage.totalSize,
            maxBytes: tenant.storageQuota.maxBytes,
            requestedBytes: totalSize
          }
        });
      }
    }

    // Validar tipos de arquivo permitidos para o tenant
    if (tenant.allowedFileTypes && tenant.allowedFileTypes.length > 0) {
      const invalidFiles = req.files.filter(file => 
        !tenant.allowedFileTypes.includes(file.mimetype)
      );

      if (invalidFiles.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Some file types are not allowed for your organization',
          invalidFiles: invalidFiles.map(f => ({
            name: f.originalname,
            type: f.mimetype
          }))
        });
      }
    }

    // Adicionar tenantId aos arquivos para uso posterior
    req.files = req.files.map(file => ({
      ...file,
      tenantId: tenantId
    }));

    next();
  } catch (error) {
    console.error('File upload validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error validating file upload'
    });
  }
};

/**
 * Middleware para validar listagem de arquivos
 */
const validateFileList = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { conversationId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context is required'
      });
    }

    // Se está listando arquivos de uma conversa específica
    if (conversationId) {
      const Conversation = require('../models/Conversation');
      const conversation = await Conversation.findOne({
        _id: conversationId,
        tenantId: tenantId
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found or access denied'
        });
      }

      // Verificar se o usuário faz parte da conversa
      const userId = req.user._id.toString();
      const isParticipant = 
        conversation.client.toString() === userId ||
        (conversation.agent && conversation.agent.toString() === userId);

      if (!isParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this conversation'
        });
      }

      req.conversation = conversation;
    }

    // Adicionar filtro de tenant para queries
    req.fileQuery = {
      tenantId: tenantId,
      ...(conversationId && { conversation: conversationId })
    };

    next();
  } catch (error) {
    console.error('File list validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error validating file list access'
    });
  }
};

/**
 * Middleware para sanitizar nomes de arquivo
 */
const sanitizeFilename = (req, res, next) => {
  if (req.files && req.files.length > 0) {
    req.files = req.files.map(file => ({
      ...file,
      originalname: file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, '-')
        .replace(/\.{2,}/g, '.')
        .substring(0, 255)
    }));
  } else if (req.file) {
    req.file.originalname = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  }
  
  next();
};

/**
 * Middleware para adicionar headers de segurança para download de arquivos
 */
const setFileSecurityHeaders = (req, res, next) => {
  // Prevenir XSS em arquivos HTML/SVG
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  
  // Para downloads, forçar como attachment
  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', 'attachment');
  }
  
  next();
};

module.exports = {
  validateFileAccess,
  validateFileUpload,
  validateFileList,
  sanitizeFilename,
  setFileSecurityHeaders
};
