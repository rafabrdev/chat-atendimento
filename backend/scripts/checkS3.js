const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configurar AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'chat-atendimento-uploads-726';

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function checkS3() {
  console.log(colors.cyan + '\n=================================');
  console.log('     VERIFICADOR DE S3 BUCKET');
  console.log('=================================' + colors.reset);
  
  try {
    // 1. Verificar se o bucket existe
    console.log(colors.yellow + '\n🔍 Verificando bucket S3...' + colors.reset);
    console.log(`Bucket: ${BUCKET_NAME}`);
    
    try {
      await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
      console.log(colors.green + '✅ Bucket existe e está acessível!' + colors.reset);
    } catch (error) {
      if (error.code === 'NotFound') {
        console.log(colors.red + '❌ Bucket não encontrado!' + colors.reset);
        console.log(colors.yellow + 'Criando bucket...' + colors.reset);
        
        await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
        console.log(colors.green + '✅ Bucket criado com sucesso!' + colors.reset);
      } else {
        throw error;
      }
    }
    
    // 2. Listar arquivos no bucket
    console.log(colors.cyan + '\n📂 Arquivos no bucket:' + colors.reset);
    
    const listParams = {
      Bucket: BUCKET_NAME,
      MaxKeys: 100
    };
    
    const data = await s3.listObjectsV2(listParams).promise();
    
    if (data.Contents && data.Contents.length > 0) {
      console.log(`Total de arquivos: ${data.Contents.length}`);
      console.log('\nÚltimos 10 arquivos:');
      
      const files = data.Contents
        .sort((a, b) => b.LastModified - a.LastModified)
        .slice(0, 10)
        .map(file => ({
          Nome: file.Key.split('/').pop(),
          Tamanho: `${(file.Size / 1024).toFixed(2)} KB`,
          Modificado: new Date(file.LastModified).toLocaleString('pt-BR'),
          Caminho: file.Key
        }));
      
      console.table(files);
      
      // Estatísticas
      const totalSize = data.Contents.reduce((acc, file) => acc + file.Size, 0);
      const types = {};
      
      data.Contents.forEach(file => {
        const ext = path.extname(file.Key).toLowerCase();
        types[ext] = (types[ext] || 0) + 1;
      });
      
      console.log(colors.cyan + '\n📊 Estatísticas:' + colors.reset);
      console.log(`• Tamanho total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`• Tipos de arquivo:`);
      Object.entries(types).forEach(([ext, count]) => {
        console.log(`  - ${ext || 'sem extensão'}: ${count} arquivo(s)`);
      });
      
    } else {
      console.log(colors.yellow + 'Nenhum arquivo encontrado no bucket.' + colors.reset);
    }
    
    // 3. Fazer upload de teste
    console.log(colors.cyan + '\n🧪 Teste de upload:' + colors.reset);
    
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = `Teste de upload S3 - ${new Date().toISOString()}`;
    
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: `tests/${testFileName}`,
      Body: testContent,
      ContentType: 'text/plain'
    };
    
    console.log('Fazendo upload de arquivo de teste...');
    await s3.upload(uploadParams).promise();
    console.log(colors.green + `✅ Upload realizado: tests/${testFileName}` + colors.reset);
    
    // 4. Verificar se o arquivo foi salvo
    console.log('Verificando arquivo...');
    const headParams = {
      Bucket: BUCKET_NAME,
      Key: `tests/${testFileName}`
    };
    
    const fileInfo = await s3.headObject(headParams).promise();
    console.log(colors.green + '✅ Arquivo confirmado no S3!' + colors.reset);
    console.log(`  • Tamanho: ${fileInfo.ContentLength} bytes`);
    console.log(`  • Tipo: ${fileInfo.ContentType}`);
    console.log(`  • URL: https://${BUCKET_NAME}.s3.amazonaws.com/tests/${testFileName}`);
    
    // 5. Configurar CORS se necessário
    console.log(colors.cyan + '\n⚙️  Verificando configuração CORS...' + colors.reset);
    
    try {
      const corsConfig = await s3.getBucketCors({ Bucket: BUCKET_NAME }).promise();
      console.log(colors.green + '✅ CORS configurado:' + colors.reset);
      console.log(JSON.stringify(corsConfig.CORSRules, null, 2));
    } catch (error) {
      if (error.code === 'NoSuchCORSConfiguration') {
        console.log(colors.yellow + 'CORS não configurado. Configurando...' + colors.reset);
        
        const corsParams = {
          Bucket: BUCKET_NAME,
          CORSConfiguration: {
            CORSRules: [{
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3000
            }]
          }
        };
        
        await s3.putBucketCors(corsParams).promise();
        console.log(colors.green + '✅ CORS configurado com sucesso!' + colors.reset);
      }
    }
    
    console.log(colors.green + '\n✅ Verificação completa! S3 está funcionando corretamente.' + colors.reset);
    
  } catch (error) {
    console.error(colors.red + '\n❌ Erro:', error.message + colors.reset);
    console.log('\nVerifique suas credenciais AWS:');
    console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✓ Configurado' : '✗ Não configurado'}`);
    console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✓ Configurado' : '✗ Não configurado'}`);
    console.log(`S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME || 'Não configurado'}`);
  }
}

// Executar
checkS3();
