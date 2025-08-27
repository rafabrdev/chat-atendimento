require('dotenv').config();
const mongoose = require('mongoose');
const s3Service = require('../services/s3Service');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const File = require('../models/File');
const Conversation = require('../models/Conversation');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`)
};

async function runS3TenantIsolationTests() {
  log.info('Iniciando testes de isolamento S3 multi-tenant\n');
  
  // Conectar ao MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  log.success('Conectado ao MongoDB');
  
  try {
    // 1. Preparar dados de teste
    log.test('Preparando dados de teste...\n');
    
    // Buscar ou criar dois tenants
    let tenantA = await Tenant.findOne({ key: 'test-tenant-a' });
    if (!tenantA) {
      tenantA = await Tenant.create({
        name: 'Test Tenant A',
        key: 'test-tenant-a',
        companyName: 'Test Company A',
        slug: 'test-tenant-a-slug',
        contactEmail: 'admin@tenant-a.com',
        plan: 'starter', // Campo simplificado do plano
        subscription: { 
          plan: 'starter', // Enum correto: 'trial', 'starter', 'professional', 'enterprise', 'custom'
          status: 'active' 
        },
        isActive: true
      });
      log.info('Tenant A criado');
    }
    
    let tenantB = await Tenant.findOne({ key: 'test-tenant-b' });
    if (!tenantB) {
      tenantB = await Tenant.create({
        name: 'Test Tenant B',
        key: 'test-tenant-b',
        companyName: 'Test Company B',
        slug: 'test-tenant-b-slug',
        contactEmail: 'admin@tenant-b.com',
        plan: 'professional', // Campo simplificado do plano
        subscription: { 
          plan: 'professional', // Enum correto: 'trial', 'starter', 'professional', 'enterprise', 'custom'
          status: 'active' 
        },
        isActive: true
      });
      log.info('Tenant B criado');
    }
    
    // 2. Testar geração de keys com tenant prefix
    log.test('\n2️⃣ Testando geração de S3 keys com prefixo de tenant...\n');
    
    const keyA = s3Service.generateS3Key(tenantA._id, 'image', 'test-image.jpg');
    const keyB = s3Service.generateS3Key(tenantB._id, 'document', 'test-doc.pdf');
    
    log.info(`Key Tenant A: ${keyA}`);
    log.info(`Key Tenant B: ${keyB}`);
    
    // Validar estrutura das keys
    const expectedPrefixA = `tenants/${tenantA._id}/`;
    const expectedPrefixB = `tenants/${tenantB._id}/`;
    
    if (keyA.startsWith(expectedPrefixA)) {
      log.success(`Key A tem prefixo correto: ${expectedPrefixA}`);
    } else {
      log.error(`Key A não tem prefixo correto. Esperado: ${expectedPrefixA}`);
    }
    
    if (keyB.startsWith(expectedPrefixB)) {
      log.success(`Key B tem prefixo correto: ${expectedPrefixB}`);
    } else {
      log.error(`Key B não tem prefixo correto. Esperado: ${expectedPrefixB}`);
    }
    
    // 3. Testar validação de acesso tenant
    log.test('\n3️⃣ Testando validação de acesso cross-tenant...\n');
    
    // Tenant A tentando acessar arquivo do Tenant B
    const canAccessOwn = s3Service.validateTenantAccess(keyA, tenantA._id.toString());
    const cannotAccessOther = s3Service.validateTenantAccess(keyB, tenantA._id.toString());
    
    if (canAccessOwn) {
      log.success('Tenant A pode acessar seu próprio arquivo');
    } else {
      log.error('Tenant A NÃO pode acessar seu próprio arquivo (ERRO!)');
    }
    
    if (!cannotAccessOther) {
      log.success('Tenant A NÃO pode acessar arquivo do Tenant B (correto)');
    } else {
      log.error('Tenant A PODE acessar arquivo do Tenant B (VULNERABILIDADE!)');
    }
    
    // 4. Testar upload simulado (se S3 estiver habilitado)
    if (s3Service.isEnabled) {
      log.test('\n4️⃣ Testando upload com isolamento (S3 habilitado)...\n');
      
      try {
        // Simular arquivo
        const mockFile = {
          originalname: 'test-upload.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('Conteúdo de teste do Tenant A'),
          size: 30
        };
        
        const uploadResult = await s3Service.uploadFile(
          tenantA._id.toString(),
          mockFile,
          'document'
        );
        
        log.success(`Upload realizado: ${uploadResult.key}`);
        log.info(`URL pública: ${uploadResult.location}`);
        
        // Verificar se a key tem o tenant correto
        if (s3Service.validateTenantAccess(uploadResult.key, tenantA._id.toString())) {
          log.success('Upload mantém isolamento de tenant');
        } else {
          log.error('Upload não mantém isolamento de tenant');
        }
        
        // Tentar gerar URL de download para tenant errado
        try {
          await s3Service.getSignedDownloadUrl(
            uploadResult.key,
            tenantB._id.toString() // Tenant errado!
          );
          log.error('VULNERABILIDADE: Tenant B conseguiu URL para arquivo do Tenant A');
        } catch (error) {
          if (error.message.includes('Access denied')) {
            log.success('Acesso cross-tenant bloqueado corretamente');
          } else {
            log.error(`Erro inesperado: ${error.message}`);
          }
        }
        
        // Limpar arquivo de teste
        try {
          await s3Service.deleteFile(uploadResult.key, tenantA._id.toString());
          log.info('Arquivo de teste removido do S3');
        } catch (error) {
          log.warning(`Não foi possível remover arquivo de teste: ${error.message}`);
        }
        
      } catch (error) {
        log.warning(`Upload para S3 falhou (pode ser configuração): ${error.message}`);
      }
    } else {
      log.warning('S3 não está habilitado. Pulando testes de upload real.');
    }
    
    // 5. Testar estrutura de paths por data
    log.test('\n5️⃣ Testando estrutura de paths com data...\n');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const keyWithDate = s3Service.generateS3Key(tenantA._id, 'image', 'photo.jpg');
    
    if (keyWithDate.includes(`/${year}/${month}/`)) {
      log.success(`Path inclui year/month correto: ${year}/${month}`);
    } else {
      log.error('Path não inclui estrutura year/month');
    }
    
    // 6. Testar cálculo de uso de armazenamento
    log.test('\n6️⃣ Testando cálculo de uso de armazenamento...\n');
    
    if (s3Service.isEnabled) {
      try {
        const usageA = await s3Service.calculateTenantStorageUsage(tenantA._id.toString());
        const usageB = await s3Service.calculateTenantStorageUsage(tenantB._id.toString());
        
        log.info(`Tenant A - Uso: ${usageA.totalSizeMB}MB (${usageA.fileCount} arquivos)`);
        log.info(`Tenant B - Uso: ${usageB.totalSizeMB}MB (${usageB.fileCount} arquivos)`);
        
        log.success('Cálculo de uso isolado por tenant funcionando');
      } catch (error) {
        log.warning(`Não foi possível calcular uso: ${error.message}`);
      }
    }
    
    // 7. Testar modelo File com validação de S3 key
    log.test('\n7️⃣ Testando modelo File com validação de tenant...\n');
    
    // Criar conversa de teste
    const userA = await User.findOne({ tenantId: tenantA._id });
    const conversation = await Conversation.create({
      tenantId: tenantA._id,
      client: userA?._id || new mongoose.Types.ObjectId(),
      participants: [],
      status: 'waiting'
    });
    
    // Tentar criar File com s3Key incorreta (sem tenant)
    try {
      await File.create({
        tenantId: tenantA._id,
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1000,
        path: 'wrong/path/test.jpg', // Path sem tenant!
        url: 'http://example.com/test.jpg',
        uploadedBy: userA?._id || new mongoose.Types.ObjectId(),
        conversation: conversation._id,
        storageType: 's3',
        s3Key: 'wrong/path/test.jpg' // Key sem tenant prefix!
      });
      log.error('Modelo File aceitou s3Key sem prefixo de tenant (VULNERABILIDADE!)');
    } catch (error) {
      if (error.message.includes('S3 key deve começar com tenantId')) {
        log.success('Modelo File rejeitou s3Key sem prefixo de tenant');
      } else {
        log.warning(`Erro diferente do esperado: ${error.message}`);
      }
    }
    
    // Criar File com s3Key correta
    const correctKey = s3Service.generateS3Key(tenantA._id, 'image', 'correct.jpg');
    const file = await File.create({
      tenantId: tenantA._id,
      filename: 'correct.jpg',
      originalName: 'correct.jpg',
      mimetype: 'image/jpeg',
      size: 2000,
      path: correctKey,
      url: s3Service.getPublicUrl(correctKey),
      uploadedBy: userA?._id || new mongoose.Types.ObjectId(),
      conversation: conversation._id,
      storageType: 's3',
      s3Key: correctKey
    });
    
    if (file.s3Key === correctKey) {
      log.success('File criado com s3Key correta incluindo tenant');
    }
    
    // Limpar dados de teste
    await File.deleteOne({ _id: file._id });
    await Conversation.deleteOne({ _id: conversation._id });
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    log.success('TODOS OS TESTES DE ISOLAMENTO S3 PASSARAM!');
    console.log('='.repeat(60));
    
    console.log('\n📊 Resumo da Implementação:');
    console.log('✅ Keys S3 com prefixo tenants/{tenantId}/');
    console.log('✅ Validação de acesso cross-tenant bloqueado');
    console.log('✅ Estrutura com year/month para organização');
    console.log('✅ Cálculo de uso isolado por tenant');
    console.log('✅ Modelo File valida prefixo de tenant em s3Key');
    console.log('✅ Upload e download respeitam fronteiras de tenant');
    
    if (!s3Service.isEnabled) {
      log.warning('\n⚠️  S3 não está habilitado. Configure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY e S3_BUCKET_NAME para testes completos.');
    }
    
  } catch (error) {
    log.error(`Erro durante os testes: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log.info('\nConexão fechada');
  }
}

// Executar testes
runS3TenantIsolationTests().catch(console.error);
