/**
 * Script para configurar MongoDB Atlas com múltiplos databases
 * - chat-atendimento-dev: usado por desenvolvimento e staging
 * - chat-atendimento-prod: usado apenas por produção
 */

const mongoose = require('mongoose');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Cores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function setupMongoDB() {
  console.log(colors.cyan + '\n╔════════════════════════════════════════╗');
  console.log('║   CONFIGURAÇÃO MONGODB ATLAS - 3 AMBIENTES   ║');
  console.log('╚════════════════════════════════════════╝' + colors.reset);

  console.log(colors.yellow + '\n📋 ESTRATÉGIA DE DATABASES:' + colors.reset);
  console.log('• ' + colors.green + 'chat-atendimento-dev' + colors.reset + ' → Development + Staging');
  console.log('• ' + colors.blue + 'chat-atendimento-prod' + colors.reset + ' → Production');

  console.log(colors.yellow + '\n🌿 BRANCHES GIT:' + colors.reset);
  console.log('• ' + colors.green + 'develop' + colors.reset + ' → Development (local)');
  console.log('• ' + colors.yellow + 'staging' + colors.reset + ' → Staging (teste)');
  console.log('• ' + colors.red + 'main' + colors.reset + ' → Production');

  // Obter credenciais do MongoDB Atlas
  console.log(colors.cyan + '\n🔐 CREDENCIAIS MONGODB ATLAS:' + colors.reset);
  console.log('Vamos configurar as credenciais do seu cluster MongoDB Atlas.\n');

  const mongoUser = await question('MongoDB Atlas Username: ');
  const mongoPassword = await question('MongoDB Atlas Password: ');
  const mongoCluster = await question('MongoDB Cluster (ex: cluster0.xxxxx): ');

  // Configurar conexões
  const connections = {
    development: {
      database: 'chat-atendimento-dev',
      uri: `mongodb+srv://${mongoUser}:${mongoPassword}@${mongoCluster}.mongodb.net/chat-atendimento-dev?retryWrites=true&w=majority`
    },
    staging: {
      database: 'chat-atendimento-dev', // Compartilha com dev
      uri: `mongodb+srv://${mongoUser}:${mongoPassword}@${mongoCluster}.mongodb.net/chat-atendimento-dev?retryWrites=true&w=majority`
    },
    production: {
      database: 'chat-atendimento-prod',
      uri: `mongodb+srv://${mongoUser}:${mongoPassword}@${mongoCluster}.mongodb.net/chat-atendimento-prod?retryWrites=true&w=majority`
    }
  };

  // Testar conexões
  console.log(colors.cyan + '\n🔍 TESTANDO CONEXÕES:' + colors.reset);
  
  for (const [env, config] of Object.entries(connections)) {
    process.stdout.write(`${env}: `);
    try {
      await mongoose.connect(config.uri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(colors.green + '✅ Conectado' + colors.reset);
      
      // Criar database se não existir (MongoDB cria automaticamente ao inserir dados)
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      
      if (collections.length === 0) {
        // Criar uma collection inicial para garantir que o database existe
        await db.createCollection('_init');
        console.log(`  └─ Database '${config.database}' criado`);
      } else {
        console.log(`  └─ Database '${config.database}' já existe (${collections.length} collections)`);
      }
      
      await mongoose.disconnect();
    } catch (error) {
      console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
    }
  }

  // Configurar AWS S3
  console.log(colors.cyan + '\n☁️ CONFIGURAÇÃO AWS S3:' + colors.reset);
  const useS3 = await question('Deseja configurar AWS S3 agora? (s/n): ');
  
  let awsConfig = {};
  if (useS3.toLowerCase() === 's') {
    awsConfig.accessKeyId = await question('AWS Access Key ID: ');
    awsConfig.secretAccessKey = await question('AWS Secret Access Key: ');
    awsConfig.region = await question('AWS Region (default: us-east-1): ') || 'us-east-1';
    awsConfig.buckets = {
      development: await question('S3 Bucket Development (ex: chat-atendimento-dev): '),
      staging: await question('S3 Bucket Staging (ex: chat-atendimento-staging): '),
      production: await question('S3 Bucket Production (ex: chat-atendimento-prod): ')
    };
  }

  // Outras configurações
  console.log(colors.cyan + '\n⚙️ OUTRAS CONFIGURAÇÕES:' + colors.reset);
  const jwtSecret = await question('JWT Secret (Enter para gerar automaticamente): ') || generateSecret();
  const corsOrigins = {
    development: await question('CORS Origin Development (default: http://localhost:3000): ') || 'http://localhost:3000',
    staging: await question('CORS Origin Staging (ex: https://staging.seudominio.com): '),
    production: await question('CORS Origin Production (ex: https://www.seudominio.com): ')
  };

  // Criar arquivos .env para cada ambiente
  console.log(colors.cyan + '\n📝 CRIANDO ARQUIVOS DE CONFIGURAÇÃO:' + colors.reset);

  // .env.development
  const envDevelopment = `# AMBIENTE DEVELOPMENT
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=${connections.development.uri}

# JWT
JWT_SECRET=${jwtSecret}

# Server
PORT=3001

# Storage (Local para development)
USE_S3=false

# CORS
CORS_ORIGIN=${corsOrigins.development}

# Debug
DEBUG=true
LOG_LEVEL=debug
`;

  // .env.staging
  const envStaging = `# AMBIENTE STAGING
NODE_ENV=staging

# MongoDB Atlas (compartilhado com dev)
MONGODB_URI=${connections.staging.uri}

# JWT
JWT_SECRET=${jwtSecret}

# Server
PORT=3001

# AWS S3
${awsConfig.accessKeyId ? `AWS_ACCESS_KEY_ID=${awsConfig.accessKeyId}
AWS_SECRET_ACCESS_KEY=${awsConfig.secretAccessKey}
S3_BUCKET_NAME=${awsConfig.buckets?.staging}
AWS_REGION=${awsConfig.region}
USE_S3=true` : 'USE_S3=false'}

# CORS
CORS_ORIGIN=${corsOrigins.staging}

# Debug
DEBUG=false
LOG_LEVEL=info
`;

  // .env.production
  const envProduction = `# AMBIENTE PRODUCTION
NODE_ENV=production

# MongoDB Atlas (database isolado)
MONGODB_URI=${connections.production.uri}

# JWT
JWT_SECRET=${jwtSecret}

# Server
PORT=80

# AWS S3
${awsConfig.accessKeyId ? `AWS_ACCESS_KEY_ID=${awsConfig.accessKeyId}
AWS_SECRET_ACCESS_KEY=${awsConfig.secretAccessKey}
S3_BUCKET_NAME=${awsConfig.buckets?.production}
AWS_REGION=${awsConfig.region}
USE_S3=true` : 'USE_S3=false'}

# CORS
CORS_ORIGIN=${corsOrigins.production}

# Debug
DEBUG=false
LOG_LEVEL=error

# Security
RATE_LIMIT=100
SESSION_TIMEOUT=3600000
`;

  // Salvar arquivos
  const envDir = path.join(__dirname, '..');
  
  fs.writeFileSync(path.join(envDir, '.env.development'), envDevelopment);
  console.log(colors.green + '✅ .env.development criado' + colors.reset);
  
  fs.writeFileSync(path.join(envDir, '.env.staging'), envStaging);
  console.log(colors.green + '✅ .env.staging criado' + colors.reset);
  
  fs.writeFileSync(path.join(envDir, '.env.production'), envProduction);
  console.log(colors.green + '✅ .env.production criado' + colors.reset);

  // Criar .env padrão apontando para development
  fs.copyFileSync(path.join(envDir, '.env.development'), path.join(envDir, '.env'));
  console.log(colors.green + '✅ .env (development) criado' + colors.reset);

  // Resumo final
  console.log(colors.cyan + '\n╔════════════════════════════════════════╗');
  console.log('║            CONFIGURAÇÃO COMPLETA            ║');
  console.log('╚════════════════════════════════════════╝' + colors.reset);

  console.log(colors.magenta + '\n📊 RESUMO DOS AMBIENTES:' + colors.reset);
  console.log('\n┌─────────────┬──────────────────────┬─────────────────┐');
  console.log('│ Ambiente    │ Database             │ Branch Git      │');
  console.log('├─────────────┼──────────────────────┼─────────────────┤');
  console.log('│ Development │ chat-atendimento-dev │ develop         │');
  console.log('│ Staging     │ chat-atendimento-dev │ staging         │');
  console.log('│ Production  │ chat-atendimento-prod│ main            │');
  console.log('└─────────────┴──────────────────────┴─────────────────┘');

  console.log(colors.yellow + '\n🚀 PRÓXIMOS PASSOS:' + colors.reset);
  console.log('\n1. Criar as branches no Git:');
  console.log('   git checkout -b develop');
  console.log('   git checkout -b staging');
  console.log('\n2. Testar cada ambiente:');
  console.log('   npm run dev         # Development');
  console.log('   npm run staging     # Staging');
  console.log('   npm run prod        # Production');
  console.log('\n3. Configurar GitHub Actions (será criado automaticamente)');

  rl.close();
}

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Executar
setupMongoDB().catch(console.error);
