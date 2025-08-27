const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Importar o modelo Tenant
const Tenant = require('../models/Tenant');

async function addKeyToTenants() {
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    
    console.log('✅ Conectado ao MongoDB');
    console.log(`   URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento'}`);
    
    // Buscar todos os tenants
    const tenants = await Tenant.find({});
    console.log(`\n📊 Total de tenants encontrados: ${tenants.length}`);
    
    for (const tenant of tenants) {
      console.log('\n----------------------------');
      console.log(`Processando tenant: ${tenant.companyName || tenant.name}`);
      console.log(`   - ID: ${tenant._id}`);
      console.log(`   - Slug: ${tenant.slug}`);
      console.log(`   - Key atual: ${tenant.key || 'NÃO DEFINIDA'}`);
      
      // Se não tem key, usar o slug como key
      if (!tenant.key) {
        tenant.key = tenant.slug || tenant._id.toString();
        console.log(`   ✅ Adicionando key: ${tenant.key}`);
      }
      
      // Garantir que tem o campo name
      if (!tenant.name) {
        tenant.name = tenant.companyName || tenant.slug || 'Sem nome';
        console.log(`   ✅ Adicionando name: ${tenant.name}`);
      }
      
      // Garantir que tem o campo plan
      if (!tenant.plan && tenant.subscription) {
        tenant.plan = tenant.subscription.plan || 'trial';
        console.log(`   ✅ Adicionando plan: ${tenant.plan}`);
      }
      
      // Garantir que está ativo
      if (tenant.isActive === undefined || tenant.isActive === null) {
        tenant.isActive = true;
        console.log(`   ✅ Definindo isActive: true`);
      }
      
      await tenant.save();
      console.log(`   ✅ Tenant salvo com sucesso!`);
    }
    
    // Verificar se agora consegue buscar o tenant default
    console.log('\n🔍 Verificando tenant default...');
    const defaultTenant = await Tenant.findOne({ key: 'default' });
    
    if (defaultTenant) {
      console.log('✅ Tenant default encontrado com key "default"!');
      console.log(`   - ID: ${defaultTenant._id}`);
      console.log(`   - Key: ${defaultTenant.key}`);
      console.log(`   - Name: ${defaultTenant.name}`);
      console.log(`   - isActive: ${defaultTenant.isActive}`);
    } else {
      console.log('⚠️ Tenant default não encontrado com key "default"');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

addKeyToTenants();
