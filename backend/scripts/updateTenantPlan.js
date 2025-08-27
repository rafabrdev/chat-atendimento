const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Importar o modelo Tenant
const Tenant = require('../models/Tenant');

async function updateTenantPlan() {
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Conectado ao MongoDB');
    
    // Atualizar o campo plan em todos os tenants que não têm
    const result = await Tenant.updateMany(
      { plan: { $exists: false } },
      { $set: { plan: 'enterprise' } }
    );
    
    console.log(`✅ ${result.modifiedCount} tenants atualizados com campo plan`);
    
    // Verificar o tenant default
    const defaultTenant = await Tenant.findOne({ key: 'default' });
    
    if (defaultTenant) {
      console.log('\n📊 Tenant Default:');
      console.log(`   - ID: ${defaultTenant._id}`);
      console.log(`   - Key: ${defaultTenant.key}`);
      console.log(`   - Plan: ${defaultTenant.plan}`);
      console.log(`   - Nome: ${defaultTenant.companyName}`);
    } else {
      console.log('⚠️  Tenant default não encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro ao atualizar tenants:', error);
    process.exit(1);
  } finally {
    // Desconectar do banco
    await mongoose.disconnect();
    console.log('\n✅ Script concluído e conexão fechada');
  }
}

// Executar script
updateTenantPlan();
