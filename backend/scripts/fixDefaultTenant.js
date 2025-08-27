const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Importar o modelo Tenant
const Tenant = require('../models/Tenant');

async function fixDefaultTenant() {
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    
    console.log('✅ Conectado ao MongoDB');
    
    // Buscar tenant com slug default
    const tenant = await Tenant.findOne({ slug: 'default' });
    
    if (tenant) {
      console.log('\n📊 Tenant encontrado:');
      console.log(`   - ID: ${tenant._id}`);
      console.log(`   - Key atual: ${tenant.key}`);
      console.log(`   - isActive atual: ${tenant.isActive}`);
      console.log(`   - Name atual: ${tenant.name}`);
      
      // Garantir que tem todos os campos corretos
      tenant.key = 'default';
      tenant.name = tenant.name || 'Default Organization';
      tenant.isActive = true;
      tenant.plan = 'enterprise';
      tenant.subscription = tenant.subscription || {};
      tenant.subscription.status = 'active';
      tenant.subscription.plan = 'enterprise';
      
      await tenant.save();
      
      console.log('\n✅ Tenant atualizado com sucesso!');
      console.log(`   - Key: ${tenant.key}`);
      console.log(`   - isActive: ${tenant.isActive}`);
      console.log(`   - Plan: ${tenant.plan}`);
      
      // Verificar se agora consegue buscar
      const test = await Tenant.findOne({ 
        key: 'default',
        isActive: true 
      });
      
      if (test) {
        console.log('\n✅ Teste de busca bem sucedido!');
        console.log('   Tenant pode ser encontrado com { key: "default", isActive: true }');
      } else {
        console.log('\n❌ Teste de busca falhou!');
      }
      
    } else {
      console.log('❌ Nenhum tenant com slug "default" encontrado!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

fixDefaultTenant();
