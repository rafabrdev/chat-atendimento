const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const fileSchema = new mongoose.Schema({
  // Multi-tenant: referência ao tenant (empresa)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
    // index criado automaticamente pelo plugin
  },
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
    sparse: true, // Allow null for local files
    // S3 key deve incluir tenantId: tenants/{tenantId}/{environment}/{fileType}/{year}/{month}/{uuid}_{filename}
    validate: {
      validator: function(v) {
        if (!v) return true; // Permitir null para arquivos locais
        // Verificar se o s3Key começa com tenants/{tenantId}
        const expectedPrefix = `tenants/${this.tenantId?.toString()}/`;
        return v.startsWith(expectedPrefix);
      },
      message: 'S3 key deve começar com tenants/{tenantId}'
    }
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

// Índices compostos para multi-tenancy e performance
// Índice principal para buscar arquivos de uma conversa dentro do tenant
fileSchema.index({ tenantId: 1, conversation: 1, createdAt: -1 });

// Índice para buscar arquivos enviados por um usuário dentro do tenant
fileSchema.index({ tenantId: 1, uploadedBy: 1, createdAt: -1 });

// Índice para buscar por tipo de arquivo dentro do tenant
fileSchema.index({ tenantId: 1, fileType: 1, createdAt: -1 });

// Índice para buscar arquivos de uma mensagem específica
fileSchema.index({ tenantId: 1, message: 1 });

// Índice para arquivos S3 por chave
fileSchema.index({ tenantId: 1, s3Key: 1 }, { sparse: true });

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

// Pre-save hook to set file type and validate S3 path
fileSchema.pre('save', function(next) {
  if (!this.fileType || this.fileType === 'other') {
    this.fileType = this.determineFileType();
  }
  
  // Se for armazenamento S3, garantir que o caminho inclui tenants/{tenantId}
  if (this.storageType === 's3' && this.s3Key) {
    const expectedPrefix = `tenants/${this.tenantId}/`;
    if (!this.s3Key.startsWith(expectedPrefix)) {
      // Se não começar com o prefixo correto, adicionar
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const environment = process.env.NODE_ENV || 'development';
      // Remover prefixos incorretos se existirem
      let cleanKey = this.s3Key;
      if (cleanKey.startsWith(`${this.tenantId}/`)) {
        cleanKey = cleanKey.substring(`${this.tenantId}/`.length);
      }
      // Montar path correto
      this.s3Key = `tenants/${this.tenantId}/${environment}/${this.fileType || 'other'}/${year}/${month}/${cleanKey}`;
    }
  }
  
  next();
});


// Aplicar plugin de tenant scope
fileSchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('File', fileSchema);
