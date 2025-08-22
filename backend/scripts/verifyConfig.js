/**
 * Script para verificar configurações de MongoDB Atlas e S3
 */

const mongoose = require('mongoose');
const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Cores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function verifyConfiguration() {
  console.log(colors.cyan + '\n=================================');
  console.log('   VERIFICAÇÃO DE CONFIGURAÇÃO');
  console.log('=================================' + colors.reset);
  
  // 1. Verificar ambiente
  console.log(colors.blue + '\n📋 AMBIENTE:' + colors.reset);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Produção: ${process.env.NODE_ENV === 'production' ? '✓' : '✗'}`);
  console.log(`Staging: ${process.env.NODE_ENV === 'staging' ? '✓' : '✗'}`);
  console.log(`Development: ${!process.env.NODE_ENV || process.env.NODE_ENV === 'development' ? '✓' : '✗'}`);
  
  // 2. Verificar MongoDB Atlas
  console.log(colors.blue + '\n🗄️ MONGODB ATLAS:' + colors.reset);
  
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log(colors.red + '❌ MONGODB_URI não configurado!' + colors.reset);
  } else {
    // Extrair informações da URI
    const uriMatch = mongoUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
    if (uriMatch) {
      const [, user, , cluster, database] = uriMatch;
      console.log(`User: ${user}`);
      console.log(`Cluster: ${cluster}`);
      console.log(`Database: ${database}`);
      
      // Tentar conectar
      console.log(colors.yellow + '\nTestando conexão...' + colors.reset);
      try {
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 5000
        });
        console.log(colors.green + '✅ MongoDB Atlas conectado com sucesso!' + colors.reset);
        
        // Verificar collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`\nCollections encontradas: ${collections.length}`);
        if (collections.length > 0) {
          console.table(collections.map(c => ({
            Nome: c.name,
            Tipo: c.type
          })));
        }
        
        // Contar documentos
        const stats = {};
        for (const collection of collections) {
          const count = await mongoose.connection.db.collection(collection.name).countDocuments();
          stats[collection.name] = count;
        }
        
        console.log('\nDocumentos por collection:');
        console.table(stats);
        
        await mongoose.disconnect();
      } catch (error) {
        console.log(colors.red + '❌ Erro ao conectar:' + colors.reset, error.message);
      }
    } else {
      console.log(colors.yellow + '⚠️ URI do MongoDB parece estar em formato incorreto' + colors.reset);
    }
  }
  
  // 3. Verificar S3
  console.log(colors.blue + '\n☁️ AWS S3:' + colors.reset);
  
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.S3_BUCKET_NAME;
  
  console.log(`AWS_ACCESS_KEY_ID: ${accessKeyId ? '✓ Configurado' : '✗ Não configurado'}`);
  console.log(`AWS_SECRET_ACCESS_KEY: ${secretAccessKey ? '✓ Configurado' : '✗ Não configurado'}`);
  console.log(`S3_BUCKET_NAME: ${bucketName || 'Não configurado'}`);
  
  if (accessKeyId && secretAccessKey && bucketName) {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
    
    console.log(colors.yellow + '\nTestando acesso ao S3...' + colors.reset);
    
    try {
      // Verificar se bucket existe
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log(colors.green + '✅ Bucket S3 acessível!' + colors.reset);
      
      // Listar alguns arquivos
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 10
      });
      
      const { Contents, KeyCount } = await s3Client.send(listCommand);
      console.log(`\nArquivos no bucket: ${KeyCount || 0}`);
      
      if (Contents && Contents.length > 0) {
        console.log('\nÚltimos arquivos:');
        console.table(Contents.slice(0, 5).map(file => ({
          Nome: file.Key.split('/').pop(),
          Tamanho: `${(file.Size / 1024).toFixed(2)} KB`,
          Modificado: new Date(file.LastModified).toLocaleString('pt-BR')
        })));
      }
      
    } catch (error) {
      console.log(colors.red + '❌ Erro ao acessar S3:' + colors.reset, error.message);
      
      if (error.name === 'NoSuchBucket') {
        console.log(colors.yellow + 'ℹ️ Bucket não existe. Será criado automaticamente no primeiro upload.' + colors.reset);
      }
    }
  } else {
    console.log(colors.yellow + '⚠️ S3 não está totalmente configurado' + colors.reset);
  }
  
  // 4. Verificar configuração de Upload
  console.log(colors.blue + '\n📤 CONFIGURAÇÃO DE UPLOAD:' + colors.reset);
  
  const isProduction = process.env.NODE_ENV === 'production';
  const isStaging = process.env.NODE_ENV === 'staging';
  const useS3 = isProduction || isStaging || process.env.USE_S3 === 'true';
  
  console.log(`Modo de armazenamento: ${useS3 ? 'S3' : 'Local'}`);
  if (useS3) {
    console.log(`Bucket para uploads: ${bucketName}`);
    console.log(`Região: ${process.env.AWS_REGION || 'us-east-1'}`);
  } else {
    console.log('Uploads serão salvos localmente em: backend/uploads/');
  }
  
  // 5. Resumo
  console.log(colors.cyan + '\n=================================');
  console.log('           RESUMO');
  console.log('=================================' + colors.reset);
  
  const mongoOk = mongoUri && mongoUri.includes('mongodb');
  const s3Ok = !useS3 || (accessKeyId && secretAccessKey && bucketName);
  
  if (mongoOk && s3Ok) {
    console.log(colors.green + '✅ Configuração está correta!' + colors.reset);
    console.log('\nSua aplicação está configurada para usar:');
    console.log(`• MongoDB Atlas: ${mongoUri.split('@')[1].split('/')[0]}`);
    console.log(`• Armazenamento: ${useS3 ? 'AWS S3' : 'Local'}`);
  } else {
    console.log(colors.red + '❌ Existem problemas na configuração:' + colors.reset);
    if (!mongoOk) {
      console.log('• MongoDB não está configurado corretamente');
    }
    if (!s3Ok) {
      console.log('• S3 não está configurado corretamente');
    }
    console.log('\nVerifique seu arquivo .env');
  }
  
  console.log(colors.cyan + '\n=================================' + colors.reset);
}

// Executar
verifyConfiguration().catch(console.error).finally(() => process.exit(0));
