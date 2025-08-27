const File = require('../models/File');
const Conversation = require('../models/Conversation');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { getSubDirectory, getFileUrl, useS3 } = require('../config/uploadS3');
const s3Service = require('../services/s3Service');

// Generate thumbnail for images
const generateThumbnail = async (filePath, fileType) => {
  if (fileType !== 'image') return null;
  
  try {
    const thumbnailDir = path.join(__dirname, '..', 'uploads', 'thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
    
    const filename = path.basename(filePath);
    const thumbnailPath = path.join(thumbnailDir, `thumb_${filename}`);
    
    await sharp(filePath)
      .resize(200, 200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    
    return `/uploads/thumbnails/thumb_${filename}`;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
};

// Upload files
exports.uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    
    const { conversationId } = req.body;
    
    // Verify conversation exists and user has access
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    // Check if user is part of the conversation
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
    
    const uploadedFiles = [];
    
    for (const file of req.files) {
      // Get file URL (S3 or local) with tenant validation
      const fileUrl = getFileUrl(file, req.tenantId);
      
      // Validate S3 key belongs to tenant
      if (useS3 && file.key) {
        if (!s3Service.validateTenantAccess(file.key, req.tenantId)) {
          console.error(`Security warning: File key ${file.key} does not belong to tenant ${req.tenantId}`);
          return res.status(403).json({
            success: false,
            error: 'File upload validation failed'
          });
        }
      }
      
      // Create file record
      const fileDoc = new File({
        tenantId: req.tenantId, // Add tenant ID for multi-tenant
        filename: file.filename || file.key, // Use key for S3
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: useS3 ? file.location : file.path, // S3 location or local path
        url: fileUrl,
        uploadedBy: req.user._id,
        conversation: conversationId,
        storageType: useS3 ? 's3' : 'local',
        // Store S3 specific data
        ...(useS3 && {
          s3Key: file.key,
          s3Bucket: file.bucket || process.env.S3_BUCKET_NAME,
          s3Location: file.location
        })
      });
      
      // Generate thumbnail for images
      if (fileDoc.fileType === 'image') {
        fileDoc.thumbnail = await generateThumbnail(file.path, 'image');
        
        // Get image dimensions
        try {
          const metadata = await sharp(file.path).metadata();
          fileDoc.metadata = {
            width: metadata.width,
            height: metadata.height
          };
        } catch (error) {
          console.error('Error getting image metadata:', error);
        }
      }
      
      await fileDoc.save();
      uploadedFiles.push(fileDoc);
    }
    
    res.status(201).json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Error uploading files'
    });
  }
};

// Get files for a conversation
exports.getConversationFiles = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { fileType, page = 1, limit = 20 } = req.query;
    
    // Verify conversation exists and user has access
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    // Check if user is part of the conversation
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
    
    // Build query with tenant filter
    const query = { 
      tenantId: req.tenantId,
      conversation: conversationId 
    };
    if (fileType) {
      query.fileType = fileType;
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const files = await File.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await File.countDocuments(query);
    
    res.json({
      success: true,
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching files'
    });
  }
};

// Download file
exports.downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await File.findOne({
      tenantId: req.tenantId,
      _id: fileId
    }).populate('conversation');
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Check if user has access to the conversation
    const userId = req.user._id.toString();
    const isParticipant = 
      file.conversation.client.toString() === userId ||
      (file.conversation.agent && file.conversation.agent.toString() === userId);
    
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this file'
      });
    }
    
    // Handle S3 files
    if (file.storageType === 's3' && file.s3Key) {
      // Validate tenant access to S3 file
      if (!s3Service.validateTenantAccess(file.s3Key, req.tenantId)) {
        console.error(`Security violation: Attempted cross-tenant file access ${fileId}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      try {
        // Generate signed URL for S3 download
        const downloadUrl = await s3Service.getSignedDownloadUrl(
          file.s3Key,
          req.tenantId,
          3600 // 1 hour expiration
        );
        
        // Return signed URL for client to download
        return res.json({
          success: true,
          downloadUrl,
          filename: file.originalName,
          mimetype: file.mimetype,
          size: file.size
        });
      } catch (s3Error) {
        console.error('S3 download error:', s3Error);
        return res.status(500).json({
          success: false,
          error: 'Error generating download link'
        });
      }
    }
    
    // Handle local files
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Length', file.size);
    
    // Stream the file
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      error: 'Error downloading file'
    });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = await File.findOne({
      tenantId: req.tenantId,
      _id: fileId
    }).populate('conversation');
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Check if user is the uploader or admin
    const userId = req.user._id.toString();
    if (file.uploadedBy.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You can only delete files you uploaded'
      });
    }
    
    // Delete file from S3 if applicable
    if (file.storageType === 's3' && file.s3Key) {
      // Validate tenant access before deletion
      if (!s3Service.validateTenantAccess(file.s3Key, req.tenantId)) {
        console.error(`Security violation: Attempted cross-tenant file deletion ${fileId}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      try {
        await s3Service.deleteFile(file.s3Key, req.tenantId);
      } catch (s3Error) {
        console.error('S3 deletion error:', s3Error);
        // Continue with database deletion even if S3 fails
      }
    } else {
      // Delete local file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
    
    // Delete thumbnail if exists (usually local)
    if (file.thumbnail) {
      const thumbnailPath = path.join(__dirname, '..', file.thumbnail);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    
    // Delete from database
    await file.deleteOne();
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting file'
    });
  }
};
