/**
 * Upload Service
 * 
 * Centralizes file upload logic with tenant-aware S3 presigned URLs
 */

import api from '../config/api';

class UploadService {
  /**
   * Request presigned URL for file upload
   * @param {Object} fileInfo - File information
   * @param {string} fileInfo.filename - Original filename
   * @param {string} fileInfo.contentType - MIME type
   * @param {number} fileInfo.size - File size in bytes
   * @param {string} fileInfo.conversationId - Optional conversation ID
   * @returns {Promise<Object>} Upload URL and metadata
   */
  async getPresignedUploadUrl(fileInfo) {
    try {
      console.log('[UploadService] Requesting presigned URL for:', fileInfo);
      const response = await api.post('/upload/presigned-url', {
        filename: fileInfo.filename,
        contentType: fileInfo.contentType,
        size: fileInfo.size,
        conversationId: fileInfo.conversationId || null
      });
      console.log('[UploadService] Presigned URL response:', response.data);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get upload URL');
      }

      return {
        uploadUrl: response.data.uploadUrl,
        key: response.data.key,
        fields: response.data.fields,
        expires: response.data.expires
      };
    } catch (error) {
      console.error('[UploadService] Error getting presigned URL:', error);
      
      // Handle specific error codes
      if (error.response?.data?.code === 'FILE_SIZE_EXCEEDED') {
        throw new Error(`Arquivo muito grande. ${error.response.data.error}`);
      }
      if (error.response?.data?.code === 'STORAGE_LIMIT_EXCEEDED') {
        throw new Error(`Limite de armazenamento excedido. Faça upgrade do seu plano.`);
      }
      if (error.response?.data?.code === 'TENANT_INACTIVE') {
        throw new Error('Sua conta está inativa. Entre em contato com o administrador.');
      }
      
      throw error;
    }
  }

  /**
   * Upload file directly to S3 using presigned URL
   * @param {File} file - File object to upload
   * @param {string} uploadUrl - Presigned URL from backend
   * @param {Object} fields - Additional fields for upload
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<void>}
   */
  async uploadToS3(file, uploadUrl, fields = {}, onProgress = null) {
    try {
      // Create FormData for S3 upload
      const formData = new FormData();
      
      // Add fields first (S3 requirement)
      Object.entries(fields).forEach(([key, value]) => {
        if (key !== 'key') { // Skip key field as it's in the URL
          formData.append(key, value);
        }
      });
      
      // Add file last
      formData.append('file', file);

      // Use XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Setup progress listener
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded * 100) / event.total);
              onProgress(percentComplete);
            }
          });
        }
        
        // Setup completion listeners
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
        
        // Send request
        xhr.open('PUT', uploadUrl);
        xhr.send(file);
      });
    } catch (error) {
      console.error('[UploadService] Error uploading to S3:', error);
      throw error;
    }
  }

  /**
   * Confirm upload completion with backend
   * @param {string} key - S3 key of uploaded file
   * @param {string} conversationId - Optional conversation ID
   * @param {string} messageId - Optional message ID
   * @returns {Promise<Object>} File record from backend
   */
  async confirmUpload(key, conversationId = null, messageId = null) {
    try {
      const response = await api.post('/upload/confirm', {
        key,
        conversationId,
        messageId
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to confirm upload');
      }

      return response.data.file;
    } catch (error) {
      console.error('[UploadService] Error confirming upload:', error);
      throw error;
    }
  }

  /**
   * Get presigned URL for file download
   * @param {string} key - S3 key or fileId
   * @param {boolean} isFileId - Whether the key is a fileId
   * @returns {Promise<string>} Download URL
   */
  async getPresignedDownloadUrl(key, isFileId = false) {
    try {
      const response = await api.post('/upload/presigned-download-url', {
        [isFileId ? 'fileId' : 'key']: key
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get download URL');
      }

      return response.data.downloadUrl;
    } catch (error) {
      console.error('[UploadService] Error getting download URL:', error);
      throw error;
    }
  }

  /**
   * Get tenant storage usage
   * @returns {Promise<Object>} Storage usage information
   */
  async getStorageUsage() {
    try {
      const response = await api.get('/upload/storage-usage');

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get storage usage');
      }

      return response.data.usage;
    } catch (error) {
      console.error('[UploadService] Error getting storage usage:', error);
      throw error;
    }
  }

  /**
   * Complete file upload flow
   * @param {File} file - File to upload
   * @param {Object} options - Upload options
   * @param {string} options.conversationId - Optional conversation ID
   * @param {string} options.messageId - Optional message ID
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<Object>} Uploaded file record
   */
  async uploadFile(file, options = {}) {
    const { conversationId, messageId, onProgress } = options;
    
    try {
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file size (max 100MB for safety)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
      }
      
      console.log('[UploadService] Starting upload for:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      // Step 1: Get presigned URL
      const urlData = await this.getPresignedUploadUrl({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        conversationId
      });
      
      console.log('[UploadService] Got presigned URL:', {
        key: urlData.key,
        expires: urlData.expires
      });
      
      // Step 2: Upload to S3
      await this.uploadToS3(
        file,
        urlData.uploadUrl,
        urlData.fields,
        onProgress
      );
      
      console.log('[UploadService] File uploaded to S3');
      
      // Step 3: Confirm upload with backend
      const fileRecord = await this.confirmUpload(
        urlData.key,
        conversationId,
        messageId
      );
      
      console.log('[UploadService] Upload confirmed:', fileRecord);
      
      return fileRecord;
    } catch (error) {
      console.error('[UploadService] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   * @param {File[]} files - Array of files to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object[]>} Array of uploaded file records
   */
  async uploadMultipleFiles(files, options = {}) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const fileRecord = await this.uploadFile(file, {
          ...options,
          onProgress: (progress) => {
            if (options.onProgress) {
              // Calculate total progress
              const totalProgress = ((i * 100) + progress) / files.length;
              options.onProgress(totalProgress, i, file.name);
            }
          }
        });
        
        results.push(fileRecord);
      } catch (error) {
        console.error(`[UploadService] Failed to upload ${file.name}:`, error);
        errors.push({
          file: file.name,
          error: error.message
        });
      }
    }
    
    if (errors.length > 0 && results.length === 0) {
      // All uploads failed
      throw new Error(`All uploads failed: ${errors.map(e => e.error).join(', ')}`);
    }
    
    return {
      successful: results,
      failed: errors
    };
  }

  /**
   * Validate file before upload
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateFile(file, options = {}) {
    const {
      maxSize = 50 * 1024 * 1024, // 50MB default
      allowedTypes = null,
      allowedExtensions = null
    } = options;
    
    const errors = [];
    
    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
    }
    
    // Check file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }
    
    // Check file extension
    if (allowedExtensions) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        errors.push(`File extension .${ext} is not allowed`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get file type category
   * @param {string} mimeType - MIME type
   * @returns {string} File category
   */
  getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
    if (mimeType.startsWith('text/')) return 'text';
    return 'other';
  }
}

// Export singleton instance
const uploadService = new UploadService();

export default uploadService;

// Also export class for testing
export { UploadService };
