const File = require('../models/File');
const Conversation = require('../models/Conversation');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { getSubDirectory } = require('../config/upload');

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
      const subDir = getSubDirectory(file.mimetype);
      const fileUrl = `/uploads/${subDir}/${file.filename}`;
      
      // Create file record
      const fileDoc = new File({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        url: fileUrl,
        uploadedBy: req.user._id,
        conversation: conversationId
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
    
    // Build query
    const query = { conversation: conversationId };
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
    
    const file = await File.findById(fileId)
      .populate('conversation');
    
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
    
    // Check if file exists on disk
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
    
    const file = await File.findById(fileId)
      .populate('conversation');
    
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
    
    // Delete file from disk
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    // Delete thumbnail if exists
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
