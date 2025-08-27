#!/usr/bin/env node

/**
 * Script de migração para mover arquivos existentes no S3 
 * para a nova estrutura com prefixos de tenant
 * 
 * USO: node scripts/migrateS3Files.js [--dry-run] [--tenant-id=ID]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const File = require('../models/File');
const Tenant = require('../models/Tenant');
const s3Service = require('../services/s3Service');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Parse argumentos da linha de comando
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const tenantIdArg = args.find(arg => arg.startsWith('--tenant-id='));
const specificTenantId = tenantIdArg ? tenantIdArg.split('=')[1] : null;

// Configuração
const BATCH_SIZE = 100;
let totalProcessed = 0;
let totalMigrated = 0;
let totalErrors = 0;

// Cores para output no console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log('✅ Conectado ao MongoDB', 'green');
  } catch (error) {
    log(`❌ Erro ao conectar ao MongoDB: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Migra um arquivo específico
 */
async function migrateFile(file, tenant) {
  try {
    // Verificar se o arquivo já está na estrutura nova
    if (file.s3Key && file.s3Key.startsWith(`tenants/${tenant._id}/`)) {
      log(`  ↩️  Arquivo já migrado: ${file.originalName}`, 'cyan');
      return { status: 'skipped', reason: 'already_migrated' };
    }

    // Se não tem S3 key, é arquivo local
    if (!file.s3Key || file.storageType !== 's3') {
      log(`  ⚠️  Arquivo local ignorado: ${file.originalName}`, 'yellow');
      return { status: 'skipped', reason: 'local_file' };
    }

    const oldKey = file.s3Key;
    
    // Determinar o tipo de arquivo
    const fileType = file.fileType || 'others';

    if (isDryRun) {
      log(`  🔄 [DRY-RUN] Migraria: ${oldKey}`, 'blue');
      const newKey = s3Service.generateS3Key(tenant._id, fileType, file.originalName);
      log(`     → Nova key: ${newKey}`, 'blue');
      return { status: 'dry_run', oldKey, newKey };
    }

    // Executar migração
    log(`  🔄 Migrando: ${file.originalName}...`, 'yellow');
    
    const result = await s3Service.migrateFileToTenantStructure(
      oldKey,
      tenant._id,
      fileType
    );

    // Atualizar registro no banco de dados
    file.s3Key = result.newKey;
    file.path = s3Service.getPublicUrl(result.newKey);
    file.url = file.path;
    await file.save();

    log(`  ✅ Migrado: ${oldKey} → ${result.newKey}`, 'green');
    return { status: 'migrated', oldKey, newKey: result.newKey };

  } catch (error) {
    log(`  ❌ Erro ao migrar ${file.originalName}: ${error.message}`, 'red');
    return { status: 'error', error: error.message };
  }
}

/**
 * Migra arquivos de um tenant específico
 */
async function migrateTenantFiles(tenant) {
  log(`\n📁 Processando tenant: ${tenant.companyName} (${tenant._id})`, 'bright');
  
  let skip = 0;
  let hasMore = true;
  const stats = {
    migrated: 0,
    skipped: 0,
    errors: 0
  };

  while (hasMore) {
    // Buscar arquivos em lote
    const files = await File.find({ 
      tenantId: tenant._id,
      storageType: 's3'
    })
    .limit(BATCH_SIZE)
    .skip(skip);

    if (files.length === 0) {
      hasMore = false;
      continue;
    }

    log(`  Processando lote: ${skip + 1} - ${skip + files.length} arquivos...`, 'cyan');

    // Processar cada arquivo
    for (const file of files) {
      const result = await migrateFile(file, tenant);
      
      switch(result.status) {
        case 'migrated':
          stats.migrated++;
          totalMigrated++;
          break;
        case 'error':
          stats.errors++;
          totalErrors++;
          break;
        default:
          stats.skipped++;
      }
      
      totalProcessed++;
    }

    skip += BATCH_SIZE;

    // Verificar se há mais arquivos
    if (files.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  log(`  📊 Resumo do tenant:`, 'cyan');
  log(`     • Migrados: ${stats.migrated}`, stats.migrated > 0 ? 'green' : 'reset');
  log(`     • Ignorados: ${stats.skipped}`, 'yellow');
  log(`     • Erros: ${stats.errors}`, stats.errors > 0 ? 'red' : 'reset');

  return stats;
}

/**
 * Lista arquivos órfãos no S3 (sem referência no banco)
 */
async function findOrphanedFiles() {
  log('\n🔍 Procurando arquivos órfãos no S3...', 'bright');
  
  if (!s3Service.isEnabled) {
    log('  S3 não está habilitado', 'yellow');
    return [];
  }

  const orphaned = [];
  let continuationToken = null;

  do {
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
      MaxKeys: 1000,
      ContinuationToken: continuationToken
    });

    try {
      const response = await s3Service.client.send(command);
      
      if (response.Contents) {
        for (const object of response.Contents) {
          // Verificar se existe no banco
          const fileExists = await File.findOne({ s3Key: object.Key });
          
          if (!fileExists) {
            orphaned.push({
              key: object.Key,
              size: object.Size,
              lastModified: object.LastModified
            });
            log(`  ⚠️  Órfão encontrado: ${object.Key}`, 'yellow');
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } catch (error) {
      log(`  ❌ Erro ao listar S3: ${error.message}`, 'red');
      break;
    }
  } while (continuationToken);

  if (orphaned.length > 0) {
    const totalSize = orphaned.reduce((acc, file) => acc + file.size, 0);
    log(`  📊 Total de arquivos órfãos: ${orphaned.length}`, 'yellow');
    log(`  📊 Espaço ocupado: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`, 'yellow');
  } else {
    log(`  ✅ Nenhum arquivo órfão encontrado`, 'green');
  }

  return orphaned;
}

/**
 * Função principal de migração
 */
async function migrate() {
  log('\n🚀 MIGRAÇÃO DE ARQUIVOS S3 PARA ESTRUTURA MULTI-TENANT', 'bright');
  log('━'.repeat(60), 'bright');
  
  if (isDryRun) {
    log('⚠️  Modo DRY-RUN: Nenhuma alteração será feita', 'yellow');
  }

  if (!s3Service.isEnabled) {
    log('❌ S3 não está habilitado. Verifique as variáveis de ambiente.', 'red');
    process.exit(1);
  }

  // Conectar ao banco
  await connectDatabase();

  try {
    let tenants;
    
    // Buscar tenants para processar
    if (specificTenantId) {
      const tenant = await Tenant.findById(specificTenantId);
      if (!tenant) {
        log(`❌ Tenant ${specificTenantId} não encontrado`, 'red');
        process.exit(1);
      }
      tenants = [tenant];
      log(`🎯 Migrando apenas tenant: ${tenant.companyName}`, 'cyan');
    } else {
      tenants = await Tenant.find({ isActive: true });
      log(`📋 Encontrados ${tenants.length} tenants ativos`, 'cyan');
    }

    // Processar cada tenant
    const allStats = [];
    for (const tenant of tenants) {
      const stats = await migrateTenantFiles(tenant);
      allStats.push({ tenant: tenant.companyName, ...stats });
    }

    // Procurar arquivos órfãos
    const orphanedFiles = await findOrphanedFiles();

    // Resumo final
    log('\n' + '='.repeat(60), 'bright');
    log('📊 RESUMO DA MIGRAÇÃO', 'bright');
    log('='.repeat(60), 'bright');
    log(`Total de arquivos processados: ${totalProcessed}`, 'cyan');
    log(`Total de arquivos migrados: ${totalMigrated}`, 'green');
    log(`Total de erros: ${totalErrors}`, totalErrors > 0 ? 'red' : 'green');
    log(`Arquivos órfãos encontrados: ${orphanedFiles.length}`, orphanedFiles.length > 0 ? 'yellow' : 'green');
    
    if (isDryRun) {
      log('\n⚠️  Esta foi uma execução DRY-RUN. Para executar a migração real, remova o flag --dry-run', 'yellow');
    }

    // Salvar relatório em arquivo
    if (!isDryRun && (totalMigrated > 0 || orphanedFiles.length > 0)) {
      const report = {
        date: new Date().toISOString(),
        totalProcessed,
        totalMigrated,
        totalErrors,
        orphanedFiles: orphanedFiles.length,
        tenantStats: allStats,
        orphanedFilesList: orphanedFiles.slice(0, 100) // Limitar a 100 para não ficar muito grande
      };

      const fs = require('fs');
      const reportPath = `./migration-report-${Date.now()}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      log(`\n📄 Relatório salvo em: ${reportPath}`, 'green');
    }

  } catch (error) {
    log(`\n❌ Erro durante a migração: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log('\n✅ Migração concluída!', 'green');
    process.exit(0);
  }
}

// Executar migração
migrate().catch(error => {
  log(`❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
