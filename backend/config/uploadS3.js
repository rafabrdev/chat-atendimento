const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

// Configuração do ambiente
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const useS3 = isProduction || isStaging || process.env.USE_S3 === 'true';

console.log(`📁 Upload Storage: ${useS3 ? 'AWS S3' : 'Local Disk'}`);
if (useS3) {
  console.log(`🪣 S3 Bucket: ${process.env.S3_BUCKET_NAME}`);
}

// Configurar cliente S3
let s3Client = null;
if (useS3) {
  s3Client = new S3Client({
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
}

// Função para determinar o subdiretório baseado no tipo de arquivo
const getSubDirectory = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (
    mimetype.includes('pdf') ||
    mimetype.includes('document') ||
    mimetype.includes('msword') ||
    mimetype.includes('spreadsheet') ||
    mimetype.includes('presentation')
  ) {
    return 'documents';
  }
  return 'others';
};

// Configuração do Storage (S3 ou Local)
let storage;

if (useS3) {
  // Storage S3
  storage = multerS3({
    s3: s3Client,
    bucket: process.env.S3_BUCKET_NAME,
    // acl removido - buckets modernos usam políticas de bucket
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, {
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedBy: req.user ? req.user.id : 'anonymous',
        environment: process.env.NODE_ENV
      });
    },
    key: function (req, file, cb) {
      const subDir = getSubDirectory(file.mimetype);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '-');
      
      // Organizar por ambiente
      const environment = process.env.NODE_ENV || 'development';
      const key = `${environment}/${subDir}/${name}-${uniqueSuffix}${ext}`;
      
      cb(null, key);
    }
  });
} else {
  // Storage Local (desenvolvimento)
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const subDirs = ['images', 'documents', 'videos', 'audio', 'others'];

  // Criar diretórios locais
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    subDirs.forEach(dir => {
      const dirPath = path.join(uploadsDir, dir);
      if (!fs.existsSync(dirPath)) {
        try {
          fs.mkdirSync(dirPath, { recursive: true });
        } catch (err) {
          console.log(`Directory ${dir} might already exist:`, err.message);
        }
      }
    });
  } catch (err) {
    console.log('Upload directories setup:', err.message);
  }

  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const subDir = getSubDirectory(file.mimetype);
      const uploadPath = path.join(uploadsDir, subDir);
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '-');
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
  });
}

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    // Videos
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/mp3',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Configurar multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 5 // Max 5 files per request
  }
});

// Middleware para tratamento de erros
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 50MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 5 files per upload'
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
};

// Função para obter URL do arquivo
const getFileUrl = (file) => {
  if (useS3) {
    // URL do S3
    if (file.location) {
      return file.location;
    }
    // Construir URL manualmente se necessário
    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';
    const key = file.key;
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } else {
    // URL local
    const subDir = getSubDirectory(file.mimetype);
    return `/uploads/${subDir}/${file.filename}`;
  }
};

module.exports = {
  upload,
  handleUploadError,
  getFileUrl,
  getSubDirectory,
  useS3,
  s3Client
};
