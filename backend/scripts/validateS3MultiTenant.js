#!/usr/bin/env node

/**
 * Script de validação do sistema S3 Multi-Tenant
 * Executa testes de validação sem modificar dados reais
 */

require('dotenv').config();
const s3Service = require('../services/s3Service');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const File = require('../models/File');

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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function validateS3MultiTenant() {
  log('\n🔍 VALIDAÇÃO DO SISTEMA S3 MULTI-TENANT', 'bright');
  log('='.repeat(60), 'bright');

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // 1. Verificar configuração S3
  log('\n1. Verificando configuração S3...', 'cyan');
  if (s3Service.isEnabled) {
    log(`   ✅ S3 habilitado`, 'green');
    log(`   📦 Bucket: ${process.env.S3_BUCKET_NAME}`, 'blue');
    log(`   🌍 Region: ${process.env.AWS_REGION || 'us-east-1'}`, 'blue');
    results.passed.push('S3 Configuration');
  } else {
    log(`   ⚠️  S3 não está habilitado`, 'yellow');
    results.warnings.push('S3 not enabled in current environment');
  }

  // 2. Testar geração de keys
  log('\n2. Testando geração de keys com tenant prefix...', 'cyan');
  try {
    const testTenantId = '507f1f77bcf86cd799439011';
    const key1 = s3Service.generateS3Key(testTenantId, 'images', 'test.jpg');
    const key2 = s3Service.generateS3Key(testTenantId, 'documents', 'document.pdf');
    
    const hasCorrectPrefix = key1.startsWith(`tenants/${testTenantId}/`);
    const hasEnvironment = key1.includes(`/${process.env.NODE_ENV || 'development'}/`);
    const hasDate = key1.match(/\/\d{4}\/\d{2}\//);
    const isUnique = key1 !== key2;

    if (hasCorrectPrefix && hasEnvironment && hasDate && isUnique) {
      log(`   ✅ Keys geradas corretamente`, 'green');
      log(`   📝 Exemplo: ${key1}`, 'blue');
      results.passed.push('S3 Key Generation');
    } else {
      throw new Error('Key generation validation failed');
    }
  } catch (error) {
    log(`   ❌ Erro na geração de keys: ${error.message}`, 'red');
    results.failed.push('S3 Key Generation');
  }

  // 3. Testar validação de acesso
  log('\n3. Testando validação de acesso cross-tenant...', 'cyan');
  try {
    const tenant1 = '507f1f77bcf86cd799439011';
    const tenant2 = '507f1f77bcf86cd799439012';
    const key = `tenants/${tenant1}/production/images/file.jpg`;
    
    const validAccess = s3Service.validateTenantAccess(key, tenant1);
    const invalidAccess = s3Service.validateTenantAccess(key, tenant2);
    
    if (validAccess === true && invalidAccess === false) {
      log(`   ✅ Validação de acesso funcionando corretamente`, 'green');
      results.passed.push('Cross-Tenant Access Validation');
    } else {
      throw new Error('Access validation failed');
    }
  } catch (error) {
    log(`   ❌ Erro na validação de acesso: ${error.message}`, 'red');
    results.failed.push('Cross-Tenant Access Validation');
  }

  // 4. Conectar ao MongoDB e verificar tenants
  log('\n4. Verificando configuração de tenants no banco...', 'cyan');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log(`   ✅ Conectado ao MongoDB`, 'green');
    
    const tenants = await Tenant.find({ isActive: true }).select('companyName storageQuota');
    log(`   📊 ${tenants.length} tenants ativos encontrados`, 'blue');
    
    // Verificar configuração de quota
    let tenantsWithQuota = 0;
    for (const tenant of tenants) {
      if (tenant.storageQuota && tenant.storageQuota.enabled) {
        tenantsWithQuota++;
        const maxGB = (tenant.storageQuota.maxBytes / (1024 * 1024 * 1024)).toFixed(2);
        log(`      • ${tenant.companyName}: Quota ${maxGB}GB`, 'blue');
      }
    }
    
    if (tenantsWithQuota > 0) {
      log(`   ✅ ${tenantsWithQuota} tenants com quota configurada`, 'green');
      results.passed.push('Tenant Storage Quotas');
    } else {
      log(`   ⚠️  Nenhum tenant com quota configurada`, 'yellow');
      results.warnings.push('No tenants with storage quotas configured');
    }

  } catch (error) {
    log(`   ❌ Erro ao conectar MongoDB: ${error.message}`, 'red');
    results.failed.push('MongoDB Connection');
  }

  // 5. Verificar arquivos migrados
  log('\n5. Verificando arquivos migrados...', 'cyan');
  try {
    const filesWithNewStructure = await File.countDocuments({
      s3Key: { $regex: /^tenants\// }
    });
    
    const filesWithOldStructure = await File.countDocuments({
      s3Key: { $exists: true, $not: { $regex: /^tenants\// } }
    });
    
    log(`   📁 Arquivos com nova estrutura: ${filesWithNewStructure}`, 'blue');
    log(`   📁 Arquivos com estrutura antiga: ${filesWithOldStructure}`, filesWithOldStructure > 0 ? 'yellow' : 'blue');
    
    if (filesWithOldStructure === 0) {
      log(`   ✅ Todos os arquivos estão migrados`, 'green');
      results.passed.push('File Migration');
    } else {
      log(`   ⚠️  ${filesWithOldStructure} arquivos precisam ser migrados`, 'yellow');
      results.warnings.push(`${filesWithOldStructure} files need migration`);
    }
  } catch (error) {
    log(`   ❌ Erro ao verificar arquivos: ${error.message}`, 'red');
    results.failed.push('File Verification');
  }

  // 6. Testar cálculo de uso de armazenamento
  if (s3Service.isEnabled) {
    log('\n6. Testando cálculo de uso de armazenamento...', 'cyan');
    try {
      const tenants = await Tenant.find({ isActive: true }).limit(1);
      if (tenants.length > 0) {
        const usage = await s3Service.calculateTenantStorageUsage(tenants[0]._id);
        log(`   📊 Tenant: ${tenants[0].companyName}`, 'blue');
        log(`      • Arquivos: ${usage.fileCount}`, 'blue');
        log(`      • Uso total: ${usage.totalSizeMB}MB`, 'blue');
        log(`   ✅ Cálculo de uso funcionando`, 'green');
        results.passed.push('Storage Usage Calculation');
      }
    } catch (error) {
      log(`   ❌ Erro no cálculo: ${error.message}`, 'red');
      results.failed.push('Storage Usage Calculation');
    }
  }

  // 7. Verificar middleware e rotas
  log('\n7. Verificando middleware e rotas...', 'cyan');
  try {
    const fileAccessMiddleware = require('../middleware/fileAccessMiddleware');
    const requiredFunctions = [
      'validateFileAccess',
      'validateFileUpload',
      'validateFileList',
      'sanitizeFilename',
      'setFileSecurityHeaders'
    ];
    
    let allFunctionsExist = true;
    for (const fn of requiredFunctions) {
      if (typeof fileAccessMiddleware[fn] !== 'function') {
        log(`   ❌ Função ${fn} não encontrada`, 'red');
        allFunctionsExist = false;
      }
    }
    
    if (allFunctionsExist) {
      log(`   ✅ Todas as funções de middleware estão implementadas`, 'green');
      results.passed.push('Middleware Functions');
    } else {
      throw new Error('Missing middleware functions');
    }
  } catch (error) {
    log(`   ❌ Erro no middleware: ${error.message}`, 'red');
    results.failed.push('Middleware Functions');
  }

  // Resumo Final
  log('\n' + '='.repeat(60), 'bright');
  log('📊 RESUMO DA VALIDAÇÃO', 'bright');
  log('='.repeat(60), 'bright');
  
  log(`\n✅ Testes Aprovados: ${results.passed.length}`, 'green');
  results.passed.forEach(test => {
    log(`   • ${test}`, 'green');
  });
  
  if (results.warnings.length > 0) {
    log(`\n⚠️  Avisos: ${results.warnings.length}`, 'yellow');
    results.warnings.forEach(warning => {
      log(`   • ${warning}`, 'yellow');
    });
  }
  
  if (results.failed.length > 0) {
    log(`\n❌ Testes Falhados: ${results.failed.length}`, 'red');
    results.failed.forEach(test => {
      log(`   • ${test}`, 'red');
    });
  }

  // Status final
  const totalTests = results.passed.length + results.failed.length;
  const successRate = ((results.passed.length / totalTests) * 100).toFixed(1);
  
  log(`\n📈 Taxa de Sucesso: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');
  
  if (results.failed.length === 0) {
    log('\n🎉 SISTEMA S3 MULTI-TENANT ESTÁ TOTALMENTE OPERACIONAL!', 'green');
  } else if (results.failed.length <= 2) {
    log('\n⚠️  Sistema operacional com algumas pendências', 'yellow');
  } else {
    log('\n❌ Sistema precisa de correções', 'red');
  }

  // Fechar conexão
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }

  return results;
}

// Executar validação
if (require.main === module) {
  validateS3MultiTenant()
    .then(results => {
      process.exit(results.failed.length > 0 ? 1 : 0);
    })
    .catch(error => {
      log(`\n❌ Erro fatal: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = validateS3MultiTenant;
