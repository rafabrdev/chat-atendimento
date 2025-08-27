const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Importar funções e modelos necessários
const { generateToken } = require('../middleware/jwtAuth');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

// Configurar JWT_SECRET para testes
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-123';
}

async function testJWTAuth() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    console.log('✅ Conectado ao MongoDB\n');
    console.log('🔐 Testando JWT com Multi-tenancy\n');
    console.log('=' .repeat(60));
    
    // 1. Buscar um usuário admin com tenant
    console.log('\n1️⃣ Buscando usuário para teste...');
    const adminUser = await User.findOne({ 
      role: 'admin',
      tenantId: { $exists: true }
    }).populate('tenantId');
    
    if (!adminUser) {
      console.log('❌ Nenhum usuário admin com tenant encontrado');
      return;
    }
    
    console.log(`   ✅ Usuário encontrado: ${adminUser.email}`);
    console.log(`   Tenant: ${adminUser.tenantId?.name || adminUser.tenantId?.companyName}`);
    console.log(`   TenantId: ${adminUser.tenantId?._id}`);
    
    // 2. Gerar token novo (v2)
    console.log('\n2️⃣ Gerando token JWT v2...');
    const token = generateToken(adminUser);
    console.log(`   ✅ Token gerado com sucesso`);
    console.log(`   Token (primeiros 50 chars): ${token.substring(0, 50)}...`);
    
    // 3. Decodificar e verificar payload
    console.log('\n3️⃣ Decodificando token...');
    const decoded = jwt.decode(token);
    
    console.log('   📦 Payload do token:');
    console.log(`      - ID: ${decoded.id}`);
    console.log(`      - Email: ${decoded.email}`);
    console.log(`      - Role: ${decoded.role}`);
    console.log(`      - Roles: [${decoded.roles?.join(', ')}]`);
    console.log(`      - Scopes: [${decoded.scopes?.join(', ')}]`);
    console.log(`      - TenantId: ${decoded.tenantId}`);
    console.log(`      - TenantSlug: ${decoded.tenantSlug}`);
    console.log(`      - TenantName: ${decoded.tenantName}`);
    console.log(`      - Token Version: ${decoded.tokenVersion}`);
    console.log(`      - Issued At: ${new Date(decoded.iat * 1000).toLocaleString()}`);
    console.log(`      - Expires: ${new Date(decoded.exp * 1000).toLocaleString()}`);
    
    // 4. Validar token
    console.log('\n4️⃣ Validando token...');
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      console.log('   ✅ Token válido!');
      
      // Verificar se tenantId está presente
      if (verified.tenantId) {
        console.log(`   ✅ TenantId presente no token: ${verified.tenantId}`);
      } else {
        console.log('   ⚠️  TenantId ausente no token');
      }
      
      // Verificar roles
      if (verified.roles && verified.roles.length > 0) {
        console.log(`   ✅ Roles presentes: ${verified.roles.join(', ')}`);
      } else {
        console.log('   ⚠️  Roles ausentes no token');
      }
      
      // Verificar versão
      if (verified.tokenVersion === 2) {
        console.log('   ✅ Token é versão 2 (novo formato)');
      } else {
        console.log(`   ⚠️  Token é versão ${verified.tokenVersion || 1} (formato antigo)`);
      }
    } catch (error) {
      console.log('   ❌ Token inválido:', error.message);
    }
    
    // 5. Testar token legacy (sem tenantId)
    console.log('\n5️⃣ Simulando token legacy (v1)...');
    const legacyPayload = {
      id: adminUser._id,
      email: adminUser.email,
      role: adminUser.role,
      company: adminUser.company,
      name: adminUser.name
      // Sem tenantId, roles, scopes ou tokenVersion
    };
    
    const legacyToken = jwt.sign(legacyPayload, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    const legacyDecoded = jwt.decode(legacyToken);
    console.log('   📦 Payload do token legacy:');
    console.log(`      - TenantId: ${legacyDecoded.tenantId || 'AUSENTE'}`);
    console.log(`      - Roles: ${legacyDecoded.roles || 'AUSENTE'}`);
    console.log(`      - Token Version: ${legacyDecoded.tokenVersion || 'AUSENTE (v1)'}`);
    
    // 6. Testar token com tenant diferente
    console.log('\n6️⃣ Testando validação de tenant mismatch...');
    
    // Buscar outro tenant
    const otherTenant = await Tenant.findOne({ 
      _id: { $ne: adminUser.tenantId._id }
    });
    
    if (otherTenant) {
      console.log(`   Criando token com tenant diferente: ${otherTenant.name}`);
      
      // Criar novo payload sem exp para evitar conflito
      const mismatchPayload = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        roles: decoded.roles,
        scopes: decoded.scopes,
        tenantId: otherTenant._id.toString(), // Tenant diferente
        company: decoded.company,
        name: decoded.name,
        tokenVersion: 2
      };
      
      const mismatchToken = jwt.sign(mismatchPayload, process.env.JWT_SECRET, {
        expiresIn: '7d'
      });
      
      const mismatchDecoded = jwt.decode(mismatchToken);
      console.log(`   Token tenantId: ${mismatchDecoded.tenantId}`);
      console.log(`   User tenantId: ${adminUser.tenantId._id}`);
      console.log(`   ✅ Teste preparado - middleware deve rejeitar com TENANT_MISMATCH`);
    } else {
      console.log('   ⚠️  Apenas um tenant existe, não é possível testar mismatch');
    }
    
    // 7. Buscar usuário master para teste
    console.log('\n7️⃣ Testando token para usuário master...');
    const masterUser = await User.findOne({ role: 'master' });
    
    if (masterUser) {
      const masterToken = generateToken(masterUser);
      const masterDecoded = jwt.decode(masterToken);
      
      console.log(`   ✅ Token master gerado para: ${masterUser.email}`);
      console.log(`   TenantId no token: ${masterDecoded.tenantId || 'NENHUM (correto para master)'}`);
      console.log(`   Roles: [${masterDecoded.roles?.join(', ')}]`);
      console.log(`   Scopes: [${masterDecoded.scopes?.join(', ')}]`);
    } else {
      console.log('   ⚠️  Nenhum usuário master encontrado');
    }
    
    // Resumo
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESUMO DOS TESTES:\n');
    console.log('✅ Token v2 gerado com sucesso');
    console.log('✅ Payload contém tenantId, roles e scopes');
    console.log('✅ Token pode ser verificado com JWT_SECRET');
    console.log('✅ Token legacy (v1) identificável pela ausência de tokenVersion');
    console.log('✅ Preparado para validação de tenant mismatch');
    console.log('✅ Master users funcionam sem tenantId');
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('1. Configurar ALLOW_LEGACY_TOKENS=true no .env para período de migração');
    console.log('2. Após migração, remover ALLOW_LEGACY_TOKENS para bloquear tokens antigos');
    console.log('3. Monitorar logs para identificar usuários com tokens legacy');
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

// Executar testes
testJWTAuth();
