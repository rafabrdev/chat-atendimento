const s3Service = require('../services/s3Service');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Tenant = require('../models/Tenant');

// Validação de tipos de arquivo permitidos
const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']
};

// Limites de tamanho por tipo e plano (em bytes)
const SIZE_LIMITS = {
  free: {
    image: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
    video: 50 * 1024 * 1024, // 50MB
    audio: 10 * 1024 * 1024, // 10MB
    total: 100 * 1024 * 1024 // 100MB total
  },
  basic: {
    image: 10 * 1024 * 1024, // 10MB
    document: 25 * 1024 * 1024, // 25MB
    video: 100 * 1024 * 1024, // 100MB
    audio: 25 * 1024 * 1024, // 25MB
    total: 500 * 1024 * 1024 // 500MB total
  },
  pro: {
    image: 25 * 1024 * 1024, // 25MB
    document: 50 * 1024 * 1024, // 50MB
    video: 500 * 1024 * 1024, // 500MB
    audio: 50 * 1024 * 1024, // 50MB
    total: 2 * 1024 * 1024 * 1024 // 2GB total
  },
  enterprise: {
    image: 100 * 1024 * 1024, // 100MB
    document: 100 * 1024 * 1024, // 100MB
    video: 2 * 1024 * 1024 * 1024, // 2GB
    audio: 100 * 1024 * 1024, // 100MB
    total: 10 * 1024 * 1024 * 1024 // 10GB total
  }
};

/**
 * Determina o tipo de arquivo baseado no mimetype
 */
const getFileType = (mimetype) => {
  for (const [type, mimetypes] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (mimetypes.includes(mimetype)) {
      return type;
    }
  }
  return 'other';
};

/**
 * Valida se o tipo de arquivo é permitido
 */
const isAllowedFileType = (mimetype, tenant) => {
  const fileType = getFileType(mimetype);
  
  // Se o tenant tem restrições específicas de tipos de arquivo
  if (tenant.settings?.allowedFileTypes) {
    return tenant.settings.allowedFileTypes.includes(fileType);
  }
  
  // Por padrão, permitir tipos conhecidos
  return fileType !== 'other';
};

/**
 * Valida tamanho do arquivo baseado no plano do tenant
 */
const validateFileSize = (size, mimetype, tenant) => {
  const fileType = getFileType(mimetype);
  const plan = tenant.subscription?.plan || 'free';
  const limits = SIZE_LIMITS[plan] || SIZE_LIMITS.free;
  
  // Verificar limite por tipo de arquivo
  const typeLimit = limits[fileType] || limits.image; // Default para limite de imagem
  if (size > typeLimit) {
    return {
      valid: false,
      error: `File size exceeds limit for ${fileType} (max: ${Math.round(typeLimit / 1024 / 1024)}MB)`
    };
  }
  
  return { valid: true };
};

/**
 * Gera presigned URL para upload direto ao S3
 * @route POST /api/upload/presigned-url
 */
exports.generatePresignedUploadUrl = async (req, res) => {
  try {
    const { filename, contentType, size, conversationId } = req.body;
    const tenantId = req.tenantId;
    
    // Validações básicas
    if (!filename || !contentType || !size) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: filename, contentType, size'
      });
    }
    
    // Buscar tenant para validar plano e limites
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }
    
    // Verificar se tenant está ativo
    if (!tenant.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Tenant is not active',
        code: 'TENANT_INACTIVE'
      });
    }
    
    // Validar tipo de arquivo
    if (!isAllowedFileType(contentType, tenant)) {
      return res.status(400).json({
        success: false,
        error: 'File type not allowed',
        allowedTypes: Object.keys(ALLOWED_FILE_TYPES)
      });
    }
    
    // Validar tamanho do arquivo
    const sizeValidation = validateFileSize(size, contentType, tenant);
    if (!sizeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: sizeValidation.error,
        code: 'FILE_SIZE_EXCEEDED'
      });
    }
    
    // Verificar limite de armazenamento total do tenant
    const currentUsage = await s3Service.calculateTenantStorageUsage(tenantId);
    const plan = tenant.subscription?.plan || 'free';
    const totalLimit = SIZE_LIMITS[plan]?.total || SIZE_LIMITS.free.total;
    
    if (currentUsage.totalSize + size > totalLimit) {
      return res.status(403).json({
        success: false,
        error: 'Storage limit exceeded for your plan',
        code: 'STORAGE_LIMIT_EXCEEDED',
        currentUsage: currentUsage.totalSizeMB,
        limit: Math.round(totalLimit / 1024 / 1024) + 'MB'
      });
    }
    
    // Gerar nome único para o arquivo
    const fileType = getFileType(contentType);
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const uniqueName = `${sanitizedName}_${uuidv4()}${ext}`;
    
    // Gerar key do S3 com estrutura de tenant
    const s3Key = s3Service.generateS3Key(tenantId, fileType, uniqueName);
    
    // Gerar presigned URL para upload
    const presignedUrl = await s3Service.generatePresignedUploadUrl({
      key: s3Key,
      contentType,
      metadata: {
        tenantId: tenantId.toString(),
        userId: req.user._id.toString(),
        conversationId: conversationId || '',
        originalName: filename,
        uploadedAt: new Date().toISOString()
      },
      // Adicionar condições de upload para segurança
      conditions: [
        ['content-length-range', 0, size + 1024], // Permitir pequena margem
        ['starts-with', '$Content-Type', contentType.split('/')[0]] // Validar tipo
      ],
      expiresIn: 3600 // 1 hora
    });
    
    res.json({
      success: true,
      uploadUrl: presignedUrl,
      key: s3Key,
      fields: {
        key: s3Key,
        contentType,
        'x-amz-meta-tenant-id': tenantId.toString(),
        'x-amz-meta-user-id': req.user._id.toString()
      },
      expires: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL'
    });
  }
};

/**
 * Gera presigned URL para download com validação de tenant
 * @route POST /api/upload/presigned-download-url
 */
exports.generatePresignedDownloadUrl = async (req, res) => {
  try {
    const { key, fileId } = req.body;
    const tenantId = req.tenantId;
    
    if (!key && !fileId) {
      return res.status(400).json({
        success: false,
        error: 'Either key or fileId is required'
      });
    }
    
    let s3Key = key;
    
    // Se fileId foi fornecido, buscar a key do banco
    if (fileId) {
      const File = require('../models/File');
      const file = await File.findOne({
        _id: fileId,
        tenantId: tenantId
      });
      
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      
      s3Key = file.s3Key;
    }
    
    // Validar que o arquivo pertence ao tenant
    if (!s3Service.validateTenantAccess(s3Key, tenantId)) {
      console.error(`Security: Cross-tenant file access attempted for key ${s3Key}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Gerar URL assinada para download
    const downloadUrl = await s3Service.getSignedDownloadUrl(
      s3Key,
      tenantId,
      3600 // 1 hora
    );
    
    res.json({
      success: true,
      downloadUrl,
      expires: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate download URL'
    });
  }
};

/**
 * Verifica status de upload após presigned URL
 * @route POST /api/upload/confirm
 */
exports.confirmUpload = async (req, res) => {
  try {
    const { key, conversationId, messageId } = req.body;
    const tenantId = req.tenantId;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'S3 key is required'
      });
    }
    
    // Validar que o arquivo pertence ao tenant
    if (!s3Service.validateTenantAccess(key, tenantId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Verificar se o arquivo existe no S3
    const exists = await s3Service.fileExists(key, tenantId);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'File not found in storage'
      });
    }
    
    // Buscar metadados do arquivo no S3
    const metadata = await s3Service.getFileMetadata(key, tenantId);
    
    // Criar registro no banco de dados
    const File = require('../models/File');
    const file = await File.create({
      tenantId,
      filename: path.basename(key),
      originalName: metadata.originalName || path.basename(key),
      mimetype: metadata.contentType,
      size: metadata.size,
      path: key, // S3 key
      url: s3Service.getPublicUrl(key),
      uploadedBy: req.user._id,
      conversation: conversationId,
      message: messageId,
      storageType: 's3',
      s3Key: key,
      s3Bucket: process.env.S3_BUCKET_NAME,
      s3Location: s3Service.getPublicUrl(key),
      fileType: getFileType(metadata.contentType)
    });
    
    res.json({
      success: true,
      file
    });
    
  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm upload'
    });
  }
};

/**
 * Obtém informações de uso de armazenamento do tenant
 * @route GET /api/upload/storage-usage
 */
exports.getStorageUsage = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Buscar tenant para obter limites do plano
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }
    
    // Calcular uso atual
    const usage = await s3Service.calculateTenantStorageUsage(tenantId);
    
    // Obter limite do plano
    const plan = tenant.subscription?.plan || 'free';
    const limit = SIZE_LIMITS[plan]?.total || SIZE_LIMITS.free.total;
    
    res.json({
      success: true,
      usage: {
        totalSize: usage.totalSize,
        totalSizeMB: usage.totalSizeMB,
        totalSizeGB: usage.totalSizeGB,
        fileCount: usage.fileCount,
        limit: limit,
        limitMB: Math.round(limit / 1024 / 1024),
        limitGB: (limit / 1024 / 1024 / 1024).toFixed(2),
        percentUsed: Math.round((usage.totalSize / limit) * 100),
        plan: plan
      }
    });
    
  } catch (error) {
    console.error('Error getting storage usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get storage usage'
    });
  }
};
