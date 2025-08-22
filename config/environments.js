/**
 * Configuração de Ambientes
 * 
 * Development: Local com MongoDB Atlas Dev
 * Staging: EC2 Staging com MongoDB Atlas Staging
 * Production: EC2 Prod com MongoDB Atlas Prod
 */

const environments = {
  // Desenvolvimento Local
  development: {
    name: 'Development',
    mongodb: {
      // Usar MongoDB Atlas para desenvolvimento
      uri: process.env.MONGODB_URI_DEV || 'mongodb+srv://[USERNAME]:[PASSWORD]@chat-atendimento.7mtwmy0.mongodb.net/chat-dev?retryWrites=true&w=majority',
      dbName: 'chat-dev'
    },
    s3: {
      useS3: false, // Usar armazenamento local em dev
      bucket: 'chat-atendimento-uploads-dev',
      region: 'us-east-1'
    },
    urls: {
      frontend: 'http://localhost:3000',
      backend: 'http://localhost:5000'
    },
    features: {
      swagger: true,
      debug: true,
      hotReload: true
    }
  },

  // Staging (Pré-produção)
  staging: {
    name: 'Staging',
    mongodb: {
      // MongoDB Atlas Staging (criar novo cluster ou database)
      uri: process.env.MONGODB_URI_STAGING || 'mongodb+srv://[USERNAME]:[PASSWORD]@chat-atendimento.7mtwmy0.mongodb.net/chat-staging?retryWrites=true&w=majority',
      dbName: 'chat-staging'
    },
    s3: {
      useS3: true,
      bucket: process.env.S3_BUCKET_STAGING || 'chat-atendimento-uploads-staging',
      region: 'us-east-1'
    },
    urls: {
      frontend: process.env.STAGING_URL || 'http://staging.suporte.brsi.net.br',
      backend: process.env.STAGING_API_URL || 'http://staging.suporte.brsi.net.br:5000'
    },
    features: {
      swagger: true, // Manter swagger em staging para testes
      debug: false,
      hotReload: false
    }
  },

  // Produção
  production: {
    name: 'Production',
    mongodb: {
      // MongoDB Atlas Produção
      uri: process.env.MONGODB_URI || 'mongodb+srv://[USERNAME]:[PASSWORD]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento?retryWrites=true&w=majority',
      dbName: 'chat-atendimento'
    },
    s3: {
      useS3: true,
      bucket: process.env.S3_BUCKET_NAME || '[S3_BUCKET_NAME]',
      region: 'us-east-1'
    },
    urls: {
      frontend: process.env.CLIENT_URL || 'https://suporte.brsi.net.br',
      backend: process.env.API_URL || 'https://suporte.brsi.net.br:5000'
    },
    features: {
      swagger: false, // Desabilitar swagger em produção
      debug: false,
      hotReload: false
    }
  }
};

// Obter configuração atual baseada no NODE_ENV
const currentEnv = process.env.NODE_ENV || 'development';
const config = environments[currentEnv] || environments.development;

// Adicionar informações do ambiente atual
config.currentEnv = currentEnv;
config.isDevelopment = currentEnv === 'development';
config.isStaging = currentEnv === 'staging';
config.isProduction = currentEnv === 'production';

// Log da configuração atual
console.log(`
🌍 Environment Configuration
============================
Environment: ${config.name}
MongoDB: ${config.mongodb.dbName}
S3: ${config.s3.useS3 ? config.s3.bucket : 'Local Storage'}
Frontend URL: ${config.urls.frontend}
Backend URL: ${config.urls.backend}
Features: Swagger ${config.features.swagger ? '✓' : '✗'} | Debug ${config.features.debug ? '✓' : '✗'}
============================
`);

module.exports = config;
