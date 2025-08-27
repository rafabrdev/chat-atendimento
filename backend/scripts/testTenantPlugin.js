const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Importar modelos e plugin
const User = require('../models/User');
const Message = require('../models/Message');
const { setTenantContext, withTenant, withoutTenant } = require('../plugins/tenantScopePlugin');

async function testTenantPlugin() {
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    
    console.log('✅ Conectado ao MongoDB');
    console.log('\n🧪 Testando TenantScopePlugin\n');
    console.log('=' .repeat(60));
    
    // 1. Teste: Buscar usuários sem contexto de tenant
    console.log('\n1️⃣ Teste: Buscar usuários SEM contexto de tenant');
    console.log('   Esperado: Retorna todos os usuários (sem filtro)');
    
    const allUsers = await User.find({}).limit(10);
    console.log(`   ✅ Encontrados ${allUsers.length} usuários`);
    
    // Pegar um usuário não-master para testes
    const nonMasterUsers = allUsers.filter(u => u.role !== 'master' && u.tenantId);
    const masterUsers = allUsers.filter(u => u.role === 'master');
    
    if (nonMasterUsers.length > 0) {
      console.log(`   Exemplo não-master: ${nonMasterUsers[0].email} (Tenant: ${nonMasterUsers[0].tenantId})`);
    }
    if (masterUsers.length > 0) {
      console.log(`   Exemplo master: ${masterUsers[0].email} (Tenant: ${masterUsers[0].tenantId || 'nenhum'})`);
    }
    
    // 2. Teste: Buscar com contexto de tenant
    console.log('\n2️⃣ Teste: Buscar usuários COM contexto de tenant específico');
    console.log('   Esperado: Retorna apenas usuários do tenant');
    
    // Pegar o tenantId de um usuário não-master
    if (nonMasterUsers.length > 0 && nonMasterUsers[0].tenantId) {
      const testTenantId = nonMasterUsers[0].tenantId;
      
      // Método 1: Usando setTenantContext
      const cleanup = setTenantContext(User, testTenantId);
      const tenantUsers = await User.find({}).limit(5);
      cleanup(); // Limpar contexto
      
      console.log(`   ✅ Com contexto do tenant ${testTenantId}:`);
      console.log(`      Encontrados ${tenantUsers.length} usuários`);
      
      // Verificar se todos são do mesmo tenant
      const allSameTenant = tenantUsers.every(u => u.tenantId?.toString() === testTenantId.toString());
      if (allSameTenant) {
        console.log(`   ✅ Todos os usuários são do tenant correto!`);
      } else {
        console.log(`   ❌ Alguns usuários são de tenants diferentes!`);
      }
    }
    
    // 3. Teste: Usar métodos estáticos do plugin
    console.log('\n3️⃣ Teste: Métodos estáticos do plugin');
    
    // Buscar sem tenant (bypass)
    const withoutTenantUsers = await User.findWithoutTenant({}).limit(3);
    console.log(`   ✅ findWithoutTenant: ${withoutTenantUsers.length} usuários`);
    
    // Buscar por tenant específico
    if (nonMasterUsers.length > 0 && nonMasterUsers[0].tenantId) {
      const testTenantId = nonMasterUsers[0].tenantId;
      const byTenantUsers = await User.findByTenant(testTenantId, {}, { limit: 3 });
      console.log(`   ✅ findByTenant: ${byTenantUsers.length} usuários do tenant ${testTenantId}`);
      
      const count = await User.countByTenant(testTenantId);
      console.log(`   ✅ countByTenant: ${count} usuários no total`);
    }
    
    // 4. Teste: Query methods
    console.log('\n4️⃣ Teste: Query methods do plugin');
    
    // Usar withoutTenant() em query
    const queryWithoutTenant = await User.find({}).withoutTenant().limit(3);
    console.log(`   ✅ Query.withoutTenant(): ${queryWithoutTenant.length} usuários`);
    
    // Usar forTenant() em query
    if (nonMasterUsers.length > 0 && nonMasterUsers[0].tenantId) {
      const testTenantId = nonMasterUsers[0].tenantId;
      const queryForTenant = await User.find({}).forTenant(testTenantId).limit(3);
      console.log(`   ✅ Query.forTenant(): ${queryForTenant.length} usuários do tenant ${testTenantId}`);
    }
    
    // 5. Teste: Verificar proteção contra modificação de tenantId
    console.log('\n5️⃣ Teste: Proteção contra modificação de tenantId');
    console.log('   Esperado: Plugin deve bloquear tentativas de modificar tenantId');
    
    if (allUsers.length > 0) {
      const testUser = allUsers[0];
      const originalTenantId = testUser.tenantId;
      
      try {
        // Tentar modificar tenantId via update
        await User.updateOne(
          { _id: testUser._id },
          { $set: { tenantId: new mongoose.Types.ObjectId() } }
        );
        
        // Verificar se foi modificado
        const updatedUser = await User.findById(testUser._id);
        
        if (updatedUser.tenantId?.toString() === originalTenantId?.toString()) {
          console.log('   ✅ Plugin bloqueou modificação de tenantId!');
        } else {
          console.log('   ❌ TenantId foi modificado (não deveria)');
        }
      } catch (error) {
        console.log('   ✅ Plugin bloqueou modificação com erro:', error.message);
      }
    }
    
    // 6. Teste: Aggregate com tenant scope
    console.log('\n6️⃣ Teste: Aggregate com tenant scope');
    
    if (nonMasterUsers.length > 0 && nonMasterUsers[0].tenantId) {
      const testTenantId = nonMasterUsers[0].tenantId;
      
      // Definir contexto
      const cleanup = setTenantContext(User, testTenantId);
      
      const aggregateResult = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);
      
      cleanup();
      
      console.log(`   ✅ Aggregate com tenant scope:`, aggregateResult);
      
      // Aggregate sem tenant
      const aggregateWithoutTenant = await User.aggregateWithoutTenant([
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
        { $limit: 5 }
      ]);
      
      console.log(`   ✅ Aggregate sem tenant: ${aggregateWithoutTenant.length} tenants diferentes`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Testes do TenantScopePlugin concluídos!');
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

// Executar testes
testTenantPlugin();
