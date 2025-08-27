const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Importar modelos e plugin
const User = require('../models/User');
const { setTenantContext } = require('../plugins/tenantScopePlugin');

async function testTenantContext() {
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    console.log('✅ Conectado ao MongoDB\n');
    
    // Buscar todos os tenants diferentes
    const tenantIds = await User.distinct('tenantId');
    console.log(`📊 Encontrados ${tenantIds.length} tenants diferentes:\n`);
    
    for (const tenantId of tenantIds) {
      if (!tenantId) {
        const mastersCount = await User.countDocuments({ tenantId: null, role: 'master' });
        console.log(`   ❌ NULL (${mastersCount} masters sem tenant)`);
        continue;
      }
      
      const count = await User.countDocuments({ tenantId });
      console.log(`   ✅ ${tenantId}: ${count} usuários`);
    }
    
    // Pegar um tenant para teste
    const testTenantId = tenantIds.find(id => id != null);
    
    if (!testTenantId) {
      console.log('\n❌ Nenhum tenant válido encontrado!');
      return;
    }
    
    console.log(`\n🧪 Testando contexto com tenant: ${testTenantId}`);
    console.log('=' .repeat(60));
    
    // Teste 1: Sem contexto
    console.log('\n1️⃣ Busca SEM contexto de tenant:');
    const usersWithoutContext = await User.find({}).select('email role tenantId');
    console.log(`   Total: ${usersWithoutContext.length} usuários`);
    
    const byTenant = {};
    for (const user of usersWithoutContext) {
      const tid = user.tenantId?.toString() || 'null';
      if (!byTenant[tid]) byTenant[tid] = 0;
      byTenant[tid]++;
    }
    
    console.log('   Distribuição por tenant:');
    for (const [tid, count] of Object.entries(byTenant)) {
      console.log(`      ${tid}: ${count} usuários`);
    }
    
    // Teste 2: Com contexto
    console.log('\n2️⃣ Busca COM contexto de tenant:');
    
    const cleanup = setTenantContext(User, testTenantId);
    
    const usersWithContext = await User.find({}).select('email role tenantId');
    
    cleanup();
    
    console.log(`   Total: ${usersWithContext.length} usuários`);
    
    // Verificar se todos são do mesmo tenant
    const wrongTenant = usersWithContext.filter(u => {
      return u.tenantId?.toString() !== testTenantId.toString();
    });
    
    if (wrongTenant.length > 0) {
      console.log(`   ❌ ${wrongTenant.length} usuários de tenants diferentes encontrados!`);
      console.log('   Detalhes dos usuários errados:');
      for (const user of wrongTenant) {
        console.log(`      - ${user.email} (${user.role}) - Tenant: ${user.tenantId || 'null'}`);
      }
    } else {
      console.log(`   ✅ Todos os ${usersWithContext.length} usuários são do tenant correto!`);
    }
    
    // Teste 3: Verificar se o contexto funciona com diferentes queries
    console.log('\n3️⃣ Teste com diferentes tipos de query:');
    
    const cleanup2 = setTenantContext(User, testTenantId);
    
    // findOne
    const oneUser = await User.findOne({});
    console.log(`   findOne: ${oneUser?.email} (Tenant: ${oneUser?.tenantId})`);
    
    // count
    const count = await User.countDocuments({});
    console.log(`   countDocuments: ${count} usuários`);
    
    // find com filtro adicional
    const admins = await User.find({ role: 'admin' }).select('email tenantId');
    console.log(`   find com filtro (admins): ${admins.length} usuários`);
    
    if (admins.every(a => a.tenantId?.toString() === testTenantId.toString())) {
      console.log(`      ✅ Todos os admins são do tenant correto`);
    } else {
      console.log(`      ❌ Alguns admins são de tenants diferentes`);
    }
    
    cleanup2();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Testes concluídos!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

// Executar
testTenantContext();
