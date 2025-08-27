const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Importar o modelo Tenant
const Tenant = require('../models/Tenant');

async function checkTenant() {
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    
    console.log('✅ Conectado ao MongoDB');
    
    // Buscar todos os tenants
    const tenants = await Tenant.find({});
    console.log(`\n📊 Total de tenants: ${tenants.length}`);
    
    tenants.forEach(tenant => {
      console.log('\n----------------------------');
      console.log(`ID: ${tenant._id}`);
      console.log(`Key: ${tenant.key}`);
      console.log(`Name: ${tenant.name}`);
      console.log(`CompanyName: ${tenant.companyName}`);
      console.log(`Slug: ${tenant.slug}`);
      console.log(`Plan: ${tenant.plan}`);
      console.log(`isActive: ${tenant.isActive}`);
      console.log(`isSuspended: ${tenant.isSuspended}`);
    });
    
    // Tentar buscar pelo key 'default'
    console.log('\n🔍 Buscando tenant com key "default"...');
    const defaultTenant = await Tenant.findOne({ key: 'default' });
    
    if (defaultTenant) {
      console.log('✅ Tenant default encontrado!');
    } else {
      console.log('❌ Tenant default NÃO encontrado!');
      
      // Tentar buscar pelo slug
      const bySlug = await Tenant.findOne({ slug: 'default' });
      if (bySlug) {
        console.log('⚠️ Mas existe tenant com slug "default":');
        console.log(`   - Key: ${bySlug.key || 'NÃO DEFINIDA'}`);
        console.log(`   - ID: ${bySlug._id}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

checkTenant();
