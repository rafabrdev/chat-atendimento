/**
 * Script para configurar e testar ambientes (dev, staging, prod)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

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
  cyan: '\x1b[36m'
};

async function setupEnvironment() {
  console.log(colors.cyan + '\n=================================');
  console.log('   CONFIGURAÇÃO DE AMBIENTE');
  console.log('=================================' + colors.reset);
  
  // 1. Escolher ambiente
  console.log(colors.blue + '\nEscolha o ambiente para configurar:' + colors.reset);
  console.log('1. Development (local)');
  console.log('2. Staging (teste AWS)');
  console.log('3. Production (produção AWS)');
  
  const choice = await question('\nEscolha (1-3): ');
  
  let environment = 'development';
  let envFile = '.env';
  
  switch(choice) {
    case '1':
      environment = 'development';
      envFile = '.env.development';
      break;
    case '2':
      environment = 'staging';
      envFile = '.env.staging';
      break;
    case '3':
      environment = 'production';
      envFile = '.env.production';
      break;
    default:
      console.log(colors.red + 'Opção inválida!' + colors.reset);
      rl.close();
      return;
  }
  
  console.log(colors.green + `\nConfigurando ambiente: ${environment}` + colors.reset);
  
  // 2. Configurações MongoDB Atlas
  console.log(colors.blue + '\n🗄️ CONFIGURAÇÃO MONGODB ATLAS:' + colors.reset);
  
  const mongoUser = await question('MongoDB User: ');
  const mongoPass = await question('MongoDB Password: ');
  const mongoCluster = await question('MongoDB Cluster (ex: cluster0.xxxxx): ');
  const mongoDb = await question('Database name (ex: chat-atendimento-dev): ');
  
  const mongoUri = `mongodb+srv://${mongoUser}:${mongoPass}@${mongoCluster}.mongodb.net/${mongoDb}?retryWrites=true&w=majority`;
  
  // 3. Configurações AWS S3 (se não for development)
  let awsConfig = {};
  if (environment !== 'development') {
    console.log(colors.blue + '\n☁️ CONFIGURAÇÃO AWS S3:' + colors.reset);
    
    awsConfig.accessKeyId = await question('AWS Access Key ID: ');
    awsConfig.secretAccessKey = await question('AWS Secret Access Key: ');
    awsConfig.bucketName = await question(`S3 Bucket Name (ex: chat-atendimento-${environment}): `);
    awsConfig.region = await question('AWS Region (default: us-east-1): ') || 'us-east-1';
  } else {
    console.log(colors.yellow + '\n⚠️ Development: Usando armazenamento local ao invés de S3' + colors.reset);
  }
  
  // 4. Outras configurações
  console.log(colors.blue + '\n⚙️ OUTRAS CONFIGURAÇÕES:' + colors.reset);
  
  const jwtSecret = await question('JWT Secret (press Enter para gerar automaticamente): ');
  const port = await question(`Porta do servidor (default: ${environment === 'production' ? '80' : '3001'}): `) || (environment === 'production' ? '80' : '3001');
  
  // 5. Criar conteúdo do arquivo .env
  let envContent = `# Ambiente ${environment.toUpperCase()}\n`;
  envContent += `NODE_ENV=${environment}\n\n`;
  
  // MongoDB
  envContent += `# MongoDB Atlas\n`;
  envContent += `MONGODB_URI=${mongoUri}\n\n`;
  
  // JWT
  envContent += `# JWT\n`;
  envContent += `JWT_SECRET=${jwtSecret || generateSecret()}\n\n`;
  
  // Server
  envContent += `# Server\n`;
  envContent += `PORT=${port}\n\n`;
  
  // AWS S3 (se configurado)
  if (environment !== 'development') {
    envContent += `# AWS S3\n`;
    envContent += `AWS_ACCESS_KEY_ID=${awsConfig.accessKeyId}\n`;
    envContent += `AWS_SECRET_ACCESS_KEY=${awsConfig.secretAccessKey}\n`;
    envContent += `S3_BUCKET_NAME=${awsConfig.bucketName}\n`;
    envContent += `AWS_REGION=${awsConfig.region}\n`;
    envContent += `USE_S3=true\n\n`;
  } else {
    envContent += `# Storage\n`;
    envContent += `USE_S3=false\n\n`;
  }
  
  // CORS
  envContent += `# CORS\n`;
  if (environment === 'production') {
    envContent += `CORS_ORIGIN=https://seu-dominio.com.br\n`;
  } else if (environment === 'staging') {
    envContent += `CORS_ORIGIN=http://seu-servidor-staging.com\n`;
  } else {
    envContent += `CORS_ORIGIN=http://localhost:3000\n`;
  }
  
  // 6. Salvar arquivo
  const envPath = path.join(__dirname, '..', envFile);
  fs.writeFileSync(envPath, envContent);
  
  console.log(colors.green + `\n✅ Arquivo ${envFile} criado com sucesso!` + colors.reset);
  
  // 7. Criar arquivo .env principal apontando para o ambiente escolhido
  if (envFile !== '.env') {
    const mainEnvPath = path.join(__dirname, '..', '.env');
    fs.copyFileSync(envPath, mainEnvPath);
    console.log(colors.green + `✅ Arquivo .env principal atualizado para ${environment}` + colors.reset);
  }
  
  // 8. Testar configuração
  const testConfig = await question(colors.yellow + '\nDeseja testar a configuração agora? (s/n): ' + colors.reset);
  
  if (testConfig.toLowerCase() === 's') {
    console.log(colors.cyan + '\nTestando configuração...\n' + colors.reset);
    try {
      execSync('node scripts/verifyConfig.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } catch (error) {
      console.log(colors.red + 'Erro ao testar configuração' + colors.reset);
    }
  }
  
  // 9. Instruções finais
  console.log(colors.cyan + '\n=================================');
  console.log('         PRÓXIMOS PASSOS');
  console.log('=================================' + colors.reset);
  
  if (environment === 'development') {
    console.log('\n1. Para iniciar o ambiente de desenvolvimento:');
    console.log('   cd backend && npm run dev');
    console.log('\n2. Para iniciar o frontend:');
    console.log('   cd frontend && npm start');
  } else if (environment === 'staging') {
    console.log('\n1. Para fazer deploy em staging:');
    console.log('   git push origin staging');
    console.log('\n2. O GitHub Actions fará o deploy automaticamente na EC2');
  } else {
    console.log('\n1. Para fazer deploy em produção:');
    console.log('   git push origin main');
    console.log('\n2. Configure o pipeline de CI/CD para produção');
  }
  
  console.log(colors.cyan + '\n=================================' + colors.reset);
  
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
setupEnvironment().catch(console.error);
