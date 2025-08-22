#!/usr/bin/env node

/**
 * Script de Verificação Completa do Projeto
 * Verifica configurações, infraestrutura e identifica problemas
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bright}${colors.blue}${msg}${colors.reset}`),
};

// Configurações esperadas
const REQUIRED_SECRETS = [
  'EC2_USER',
  'EC2_HOST_STAGING', 
  'EC2_HOST_PROD',
  'EC2_SSH_KEY',
  'EC2_SSH_KEY_STAGING',
  'EC2_SSH_KEY_PROD',
  'S3_BUCKET_STAGING',
  'S3_BUCKET_PROD',
  'API_URL_DEV',
  'API_URL_STAGING',
  'API_URL_PROD',
  'PRODUCTION_DOMAIN',
  'MONGODB_URI_DEV',
  'MONGODB_URI_STAGING',
  'MONGODB_URI_PROD',
  'JWT_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'S3_BUCKET_NAME'
];

const REQUIRED_FILES = [
  'docker-compose.yml',
  'docker-compose.dev.yml',
  'docker-compose.staging.yml',
  'docker-compose.production.yml',
  '.github/workflows/deploy-develop.yml',
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/deploy-production.yml',
  'backend/.env.development',
  'backend/.env.staging',
  'backend/.env.production',
  'frontend/.env.example',
  'backend/Dockerfile',
  'frontend/Dockerfile'
];

const EXPECTED_CONFIGS = {
  mongodb: {
    cluster: 'chat-atendimento.7mtwmy0.mongodb.net',
    databases: ['chat-atendimento-dev', 'chat-atendimento-prod']
  },
  aws: {
    ec2: {
      staging: '52.90.17.204',
      production: '52.90.17.204' // Mesmo servidor?
    },
    s3: {
      bucket: 'chat-atendimento-uploads-726',
      region: 'us-east-1'
    }
  },
  domain: {
    production: 'suporte.brsi.net.br',
    staging: '52.90.17.204'
  }
};

// Função para verificar arquivos
function checkFiles() {
  log.header();
  log.title('📁 VERIFICANDO ARQUIVOS ESSENCIAIS');
  log.header();
  
  let missingFiles = [];
  let existingFiles = [];
  
  REQUIRED_FILES.forEach(file => {
    const filePath = path.join(process.cwd(), '..', file);
    if (fs.existsSync(filePath)) {
      existingFiles.push(file);
      log.success(`Arquivo encontrado: ${file}`);
    } else {
      missingFiles.push(file);
      log.error(`Arquivo faltando: ${file}`);
    }
  });
  
  return { missingFiles, existingFiles };
}

// Função para verificar variáveis de ambiente
function checkEnvVars() {
  log.header();
  log.title('🔐 VERIFICANDO VARIÁVEIS DE AMBIENTE');
  log.header();
  
  const envFile = path.join(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`);
  
  if (!fs.existsSync(envFile)) {
    log.warning(`Arquivo .env não encontrado: ${envFile}`);
    return { missing: REQUIRED_SECRETS, configured: [] };
  }
  
  const envContent = fs.readFileSync(envFile, 'utf8');
  const missing = [];
  const configured = [];
  
  // Verificar MongoDB
  if (envContent.includes('MONGODB_URI')) {
    log.success('MongoDB URI configurado');
    configured.push('MONGODB_URI');
    
    // Verificar conexão MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri && mongoUri.includes(EXPECTED_CONFIGS.mongodb.cluster)) {
      log.success(`MongoDB apontando para cluster correto: ${EXPECTED_CONFIGS.mongodb.cluster}`);
    } else {
      log.warning('MongoDB pode estar apontando para cluster incorreto');
    }
  } else {
    log.error('MongoDB URI não configurado');
    missing.push('MONGODB_URI');
  }
  
  // Verificar JWT
  if (envContent.includes('JWT_SECRET')) {
    log.success('JWT Secret configurado');
    configured.push('JWT_SECRET');
  } else {
    log.error('JWT Secret não configurado');
    missing.push('JWT_SECRET');
  }
  
  // Verificar AWS
  if (envContent.includes('AWS_ACCESS_KEY_ID')) {
    log.success('AWS Access Key configurado');
    configured.push('AWS_ACCESS_KEY_ID');
  } else {
    log.warning('AWS Access Key não configurado (necessário para S3)');
  }
  
  // Verificar S3
  if (envContent.includes('USE_S3=true')) {
    log.info('S3 habilitado para este ambiente');
    if (!envContent.includes('S3_BUCKET_NAME')) {
      log.error('S3 habilitado mas bucket não configurado');
      missing.push('S3_BUCKET_NAME');
    }
  } else {
    log.info('Usando armazenamento local (USE_S3=false)');
  }
  
  return { missing, configured };
}

// Função para verificar branches Git
function checkGitBranches() {
  log.header();
  log.title('🌿 VERIFICANDO BRANCHES GIT');
  log.header();
  
  try {
    const branches = execSync('git branch -a', { encoding: 'utf8' });
    
    const requiredBranches = ['main', 'develop', 'staging'];
    const missingBranches = [];
    
    requiredBranches.forEach(branch => {
      if (branches.includes(branch)) {
        log.success(`Branch ${branch} existe`);
      } else {
        log.error(`Branch ${branch} não encontrada`);
        missingBranches.push(branch);
      }
    });
    
    // Verificar branch atual
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    log.info(`Branch atual: ${currentBranch}`);
    
    return { missingBranches, currentBranch };
  } catch (error) {
    log.error('Erro ao verificar branches Git');
    return { missingBranches: [], currentBranch: 'unknown' };
  }
}

// Função para testar conexão MongoDB
async function testMongoConnection() {
  log.header();
  log.title('🗄️ TESTANDO CONEXÃO MONGODB');
  log.header();
  
  try {
    const mongoose = require('mongoose');
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      log.error('MONGODB_URI não configurado');
      return false;
    }
    
    log.info('Conectando ao MongoDB...');
    await mongoose.connect(uri, { 
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    });
    
    log.success('Conexão com MongoDB estabelecida!');
    
    // Verificar collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    log.info(`Collections encontradas: ${collections.map(c => c.name).join(', ') || 'nenhuma'}`);
    
    await mongoose.disconnect();
    return true;
  } catch (error) {
    log.error(`Erro ao conectar MongoDB: ${error.message}`);
    return false;
  }
}

// Função para verificar configuração AWS
function checkAWSConfig() {
  log.header();
  log.title('☁️ VERIFICANDO CONFIGURAÇÃO AWS');
  log.header();
  
  const issues = [];
  
  // Verificar credenciais
  if (!process.env.AWS_ACCESS_KEY_ID) {
    log.warning('AWS_ACCESS_KEY_ID não configurado');
    issues.push('AWS_ACCESS_KEY_ID faltando');
  } else {
    log.success('AWS_ACCESS_KEY_ID configurado');
  }
  
  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    log.warning('AWS_SECRET_ACCESS_KEY não configurado');
    issues.push('AWS_SECRET_ACCESS_KEY faltando');
  } else {
    log.success('AWS_SECRET_ACCESS_KEY configurado');
  }
  
  // Verificar S3
  const s3Bucket = process.env.S3_BUCKET_NAME;
  if (s3Bucket) {
    log.success(`S3 Bucket configurado: ${s3Bucket}`);
    if (s3Bucket === EXPECTED_CONFIGS.aws.s3.bucket) {
      log.success('Bucket S3 corresponde ao esperado');
    } else {
      log.warning(`Bucket diferente do esperado. Esperado: ${EXPECTED_CONFIGS.aws.s3.bucket}`);
    }
  } else {
    log.warning('S3_BUCKET_NAME não configurado');
  }
  
  // Informações EC2
  log.info(`EC2 Staging esperado: ${EXPECTED_CONFIGS.aws.ec2.staging}`);
  log.info(`EC2 Production esperado: ${EXPECTED_CONFIGS.aws.ec2.production}`);
  
  if (EXPECTED_CONFIGS.aws.ec2.staging === EXPECTED_CONFIGS.aws.ec2.production) {
    log.warning('⚠️ Mesmo IP para staging e production - considere separar os ambientes');
  }
  
  return issues;
}

// Função para gerar relatório
function generateReport(results) {
  log.header();
  log.title('📊 RELATÓRIO FINAL');
  log.header();
  
  console.log('\n' + colors.bright + 'RESUMO:' + colors.reset);
  
  // Arquivos
  console.log(`\n${colors.cyan}Arquivos:${colors.reset}`);
  console.log(`  ✅ Encontrados: ${results.files.existingFiles.length}/${REQUIRED_FILES.length}`);
  if (results.files.missingFiles.length > 0) {
    console.log(`  ❌ Faltando: ${results.files.missingFiles.length}`);
    results.files.missingFiles.forEach(f => console.log(`     - ${f}`));
  }
  
  // Variáveis de Ambiente
  console.log(`\n${colors.cyan}Variáveis de Ambiente:${colors.reset}`);
  console.log(`  ✅ Configuradas: ${results.env.configured.length}`);
  if (results.env.missing.length > 0) {
    console.log(`  ❌ Faltando: ${results.env.missing.length}`);
  }
  
  // Git
  console.log(`\n${colors.cyan}Git:${colors.reset}`);
  console.log(`  Branch atual: ${results.git.currentBranch}`);
  if (results.git.missingBranches.length > 0) {
    console.log(`  ❌ Branches faltando: ${results.git.missingBranches.join(', ')}`);
  }
  
  // MongoDB
  console.log(`\n${colors.cyan}MongoDB:${colors.reset}`);
  console.log(`  Status: ${results.mongodb ? '✅ Conectado' : '❌ Não conectado'}`);
  
  // AWS
  console.log(`\n${colors.cyan}AWS:${colors.reset}`);
  if (results.aws.length === 0) {
    console.log(`  Status: ✅ Configurado`);
  } else {
    console.log(`  Problemas: ${results.aws.length}`);
    results.aws.forEach(issue => console.log(`     - ${issue}`));
  }
  
  // Ações Necessárias
  log.header();
  log.title('🎯 AÇÕES NECESSÁRIAS');
  log.header();
  
  const actions = [];
  
  if (results.files.missingFiles.length > 0) {
    actions.push('1. Criar arquivos faltantes (especialmente docker-compose files)');
  }
  
  if (results.env.missing.length > 0) {
    actions.push('2. Configurar variáveis de ambiente faltantes');
  }
  
  if (results.git.missingBranches.length > 0) {
    actions.push('3. Criar branches Git faltantes');
  }
  
  if (!results.mongodb) {
    actions.push('4. Verificar configuração do MongoDB Atlas');
  }
  
  if (results.aws.length > 0) {
    actions.push('5. Completar configuração AWS (credenciais e buckets)');
  }
  
  actions.push('6. Adicionar secrets faltantes no GitHub Actions');
  actions.push('7. Configurar domínio no Hostinger (equipe TI)');
  actions.push('8. Testar deploy para staging');
  
  if (actions.length > 0) {
    actions.forEach(action => console.log(`  ${colors.yellow}→${colors.reset} ${action}`));
  } else {
    log.success('Nenhuma ação crítica necessária!');
  }
  
  // Link para documentação
  console.log(`\n${colors.bright}📚 Consulte DOCUMENTACAO_COMPLETA.md para instruções detalhadas${colors.reset}`);
}

// Função principal
async function main() {
  console.clear();
  log.title(`
╔════════════════════════════════════════════════════════════╗
║     VERIFICAÇÃO COMPLETA - CHAT ATENDIMENTO BR SISTEMAS    ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  log.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  log.info(`Data: ${new Date().toLocaleString('pt-BR')}`);
  
  const results = {
    files: checkFiles(),
    env: checkEnvVars(),
    git: checkGitBranches(),
    mongodb: await testMongoConnection(),
    aws: checkAWSConfig()
  };
  
  generateReport(results);
  
  log.header();
  console.log('\n' + colors.bright + colors.green + '✨ Verificação concluída!' + colors.reset);
}

// Executar
main().catch(error => {
  log.error(`Erro fatal: ${error.message}`);
  process.exit(1);
});
