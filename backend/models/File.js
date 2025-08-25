const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  fileType: {
    type: String,
    enum: ['image', 'video', 'document', 'audio', 'other'],
    default: 'other'
  },
  thumbnail: {
    type: String // For image/video preview
  },
  metadata: {
    width: Number,
    height: Number,
    duration: Number, // For video/audio
    pages: Number // For documents
  },
  // S3 specific fields
  s3Key: {
    type: String,
    sparse: true // Allow null for local files
  },
  s3Bucket: {
    type: String,
    sparse: true
  },
  s3Location: {
    type: String,
    sparse: true
  },
  storageType: {
    type: String,
    enum: ['local', 's3'],
    default: 'local'
  }
}, {
  timestamps: true
});

// Index for faster queries
fileSchema.index({ conversation: 1, createdAt: -1 });
fileSchema.index({ uploadedBy: 1, createdAt: -1 });

// Virtual for file extension
fileSchema.virtual('extension').get(function() {
  return this.filename.split('.').pop().toLowerCase();
});

// Method to determine file type based on mimetype
fileSchema.methods.determineFileType = function() {
  const mimetype = this.mimetype.toLowerCase();
  
  if (mimetype.startsWith('image/')) {
    return 'image';
  } else if (mimetype.startsWith('video/')) {
    return 'video';
  } else if (mimetype.startsWith('audio/')) {
    return 'audio';
  } else if (
    mimetype.includes('pdf') ||
    mimetype.includes('document') ||
    mimetype.includes('msword') ||
    mimetype.includes('spreadsheet') ||
    mimetype.includes('presentation')
  ) {
    return 'document';
  }
  
  return 'other';
};

// Pre-save hook to set file type
fileSchema.pre('save', function(next) {
  if (!this.fileType || this.fileType === 'other') {
    this.fileType = this.determineFileType();
  }
  next();
});

module.exports = mongoose.model('File', fileSchema);
