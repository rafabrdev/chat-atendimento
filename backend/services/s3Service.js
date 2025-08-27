const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CopyObjectCommand, CreateMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

class S3Service {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'production' || 
                     process.env.NODE_ENV === 'staging' || 
                     process.env.USE_S3 === 'true';
    
    if (this.isEnabled) {
      this.client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        // Para LocalStack em desenvolvimento
        ...(process.env.S3_ENDPOINT && {
          endpoint: process.env.S3_ENDPOINT,
          forcePathStyle: true
        })
      });
      
      this.bucket = process.env.S3_BUCKET_NAME;
      console.log(`🚀 S3Service initialized for bucket: ${this.bucket}`);
    } else {
      console.log('📁 S3Service: Using local file system');
    }
  }

  /**
   * Gera a key do S3 com prefixo do tenant
   * Formato: tenants/{tenantId}/{environment}/{fileType}/{year}/{month}/{filename}
   */
  generateS3Key(tenantId, fileType, filename) {
    if (!tenantId) {
      throw new Error('TenantId is required for S3 key generation');
    }

    const environment = process.env.NODE_ENV || 'development';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Sanitize filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '-');
    
    // Generate unique suffix
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(sanitizedFilename);
    const name = path.basename(sanitizedFilename, ext);
    
    return `tenants/${tenantId}/${environment}/${fileType}/${year}/${month}/${name}-${uniqueSuffix}${ext}`;
  }

  /**
   * Valida se uma key pertence ao tenant
   */
  validateTenantAccess(s3Key, tenantId) {
    if (!s3Key || !tenantId) return false;
    
    const expectedPrefix = `tenants/${tenantId}/`;
    return s3Key.startsWith(expectedPrefix);
  }

  /**
   * Upload de arquivo com isolamento por tenant
   */
  async uploadFile(tenantId, file, fileType = 'others') {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    const s3Key = this.generateS3Key(tenantId, fileType, file.originalname);
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        tenantId: tenantId.toString(),
        originalName: file.originalname,
        uploadedAt: new Date().toISOString()
      },
      // Tags para facilitar gerenciamento e billing
      Tagging: `tenantId=${tenantId}&environment=${process.env.NODE_ENV || 'development'}`
    });

    try {
      await this.client.send(command);
      
      return {
        key: s3Key,
        bucket: this.bucket,
        location: this.getPublicUrl(s3Key),
        size: file.size
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Gera URL pública para o arquivo
   */
  getPublicUrl(s3Key) {
    const region = process.env.AWS_REGION || 'us-east-1';
    
    // Para LocalStack
    if (process.env.S3_ENDPOINT) {
      return `${process.env.S3_ENDPOINT}/${this.bucket}/${s3Key}`;
    }
    
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${s3Key}`;
  }

  /**
   * Gera presigned URL para upload
   */
  async generatePresignedUploadUrl(options) {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    const {
      key,
      contentType,
      metadata = {},
      conditions = [],
      expiresIn = 3600
    } = options;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata
    });

    try {
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating presigned upload URL:', error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Obtém metadados de um arquivo no S3
   */
  async getFileMetadata(s3Key, tenantId) {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    // Validar acesso ao tenant
    if (!this.validateTenantAccess(s3Key, tenantId)) {
      throw new Error('Access denied: File does not belong to this tenant');
    }

    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: s3Key
    });

    try {
      const response = await this.client.send(command);
      return {
        contentType: response.ContentType,
        size: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
        originalName: response.Metadata?.originalName || null
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Gera URL assinada para download com validação de tenant
   */
  async getSignedDownloadUrl(s3Key, tenantId, expiresIn = 3600) {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    // Validar acesso ao tenant
    if (!this.validateTenantAccess(s3Key, tenantId)) {
      throw new Error('Access denied: File does not belong to this tenant');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key
    });

    try {
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Deleta arquivo do S3 com validação de tenant
   */
  async deleteFile(s3Key, tenantId) {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    // Validar acesso ao tenant
    if (!this.validateTenantAccess(s3Key, tenantId)) {
      throw new Error('Access denied: File does not belong to this tenant');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key
    });

    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Verifica se arquivo existe no S3
   */
  async fileExists(s3Key, tenantId) {
    if (!this.isEnabled) return false;

    // Validar acesso ao tenant
    if (!this.validateTenantAccess(s3Key, tenantId)) {
      return false;
    }

    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: s3Key
    });

    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lista arquivos de um tenant
   */
  async listTenantFiles(tenantId, options = {}) {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    const {
      fileType = null,
      maxKeys = 1000,
      continuationToken = null
    } = options;

    let prefix = `tenants/${tenantId}/`;
    if (fileType) {
      prefix += `${process.env.NODE_ENV || 'development'}/${fileType}/`;
    }

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken
    });

    try {
      const response = await this.client.send(command);
      
      return {
        files: response.Contents || [],
        isTruncated: response.IsTruncated,
        nextContinuationToken: response.NextContinuationToken,
        keyCount: response.KeyCount
      };
    } catch (error) {
      console.error('S3 list error:', error);
      throw new Error(`Failed to list files from S3: ${error.message}`);
    }
  }

  /**
   * Calcula o uso de armazenamento de um tenant
   */
  async calculateTenantStorageUsage(tenantId) {
    if (!this.isEnabled) {
      return { totalSize: 0, fileCount: 0 };
    }

    const prefix = `tenants/${tenantId}/`;
    let totalSize = 0;
    let fileCount = 0;
    let continuationToken = null;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken
      });

      try {
        const response = await this.client.send(command);
        
        if (response.Contents) {
          response.Contents.forEach(obj => {
            totalSize += obj.Size;
            fileCount++;
          });
        }

        continuationToken = response.NextContinuationToken;
      } catch (error) {
        console.error('Error calculating storage:', error);
        throw new Error(`Failed to calculate storage usage: ${error.message}`);
      }
    } while (continuationToken);

    return {
      totalSize,
      fileCount,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2)
    };
  }

  /**
   * Copia arquivo entre tenants (para migração)
   */
  async copyFileBetweenTenants(sourceKey, sourceTenantId, targetTenantId) {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    // Validar acesso ao tenant de origem
    if (!this.validateTenantAccess(sourceKey, sourceTenantId)) {
      throw new Error('Access denied: Source file does not belong to source tenant');
    }

    // Extrair informações do arquivo original
    const pathParts = sourceKey.split('/');
    const filename = pathParts[pathParts.length - 1];
    const fileType = pathParts[3] || 'others'; // tenants/id/env/fileType/...

    // Gerar nova key para o tenant de destino
    const targetKey = this.generateS3Key(targetTenantId, fileType, filename);

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: targetKey,
      MetadataDirective: 'REPLACE',
      Metadata: {
        tenantId: targetTenantId.toString(),
        copiedFrom: sourceTenantId.toString(),
        copiedAt: new Date().toISOString()
      }
    });

    try {
      await this.client.send(command);
      return {
        sourceKey,
        targetKey,
        targetTenantId
      };
    } catch (error) {
      console.error('S3 copy error:', error);
      throw new Error(`Failed to copy file between tenants: ${error.message}`);
    }
  }

  /**
   * Move arquivo para nova estrutura com tenant (migração)
   */
  async migrateFileToTenantStructure(oldKey, tenantId, fileType = 'others') {
    if (!this.isEnabled) {
      throw new Error('S3 is not enabled');
    }

    // Extrair nome do arquivo da key antiga
    const filename = path.basename(oldKey);
    
    // Gerar nova key com estrutura de tenant
    const newKey = this.generateS3Key(tenantId, fileType, filename);

    // Copiar arquivo para nova localização
    const copyCommand = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${oldKey}`,
      Key: newKey,
      MetadataDirective: 'REPLACE',
      Metadata: {
        tenantId: tenantId.toString(),
        migratedFrom: oldKey,
        migratedAt: new Date().toISOString()
      }
    });

    try {
      // Copiar arquivo
      await this.client.send(copyCommand);
      
      // Deletar arquivo antigo
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: oldKey
      });
      await this.client.send(deleteCommand);
      
      return {
        oldKey,
        newKey,
        tenantId
      };
    } catch (error) {
      console.error('S3 migration error:', error);
      throw new Error(`Failed to migrate file: ${error.message}`);
    }
  }
}

// Singleton instance
const s3Service = new S3Service();

module.exports = s3Service;
