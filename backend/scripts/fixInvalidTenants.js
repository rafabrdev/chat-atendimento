/**
 * Script para corrigir documentos com tenantId inválido
 * 
 * Este script identifica documentos que referenciam tenants inexistentes
 * e os corrige atribuindo a um tenant padrão ou removendo-os.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

async function main() {
  console.log('🔧 Iniciando correção de tenantIds inválidos');
  console.log('=============================================\n');
  
  try {
    // Conectar ao MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot';
    console.log(`📡 Conectando ao MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`✅ Conectado ao MongoDB\n`);
    
    // Buscar tenant padrão (default) ou o primeiro tenant disponível
    let defaultTenant = await Tenant.findOne({ slug: 'default' });
    
    if (!defaultTenant) {
      console.log('⚠️  Tenant padrão não encontrado. Buscando primeiro tenant disponível...');
      defaultTenant = await Tenant.findOne({ isActive: true });
    }
    
    if (!defaultTenant) {
      console.log('❌ Nenhum tenant válido encontrado. Criando tenant padrão...');
      defaultTenant = new Tenant({
        companyName: 'Default Organization',
        slug: 'default',
        contactEmail: 'admin@default.com',
        subscription: {
          plan: 'trial',
          status: 'active'
        },
        modules: {
          chat: { enabled: true }
        }
      });
      await defaultTenant.save();
      console.log('✅ Tenant padrão criado com sucesso');
    }
    
    console.log(`📌 Usando tenant: ${defaultTenant.companyName} (${defaultTenant.slug})`);
    console.log(`   ID: ${defaultTenant._id}\n`);
    
    // Obter todos os tenantIds válidos
    const validTenants = await Tenant.find({}, '_id');
    const validTenantIds = validTenants.map(t => t._id.toString());
    
    // Buscar usuários com tenantId inválido
    const usersWithInvalidTenant = await User.find({
      tenantId: { $exists: true, $ne: null }
    });
    
    let fixedCount = 0;
    const invalidUsers = [];
    
    for (const user of usersWithInvalidTenant) {
      if (!validTenantIds.includes(user.tenantId.toString())) {
        invalidUsers.push({
          _id: user._id,
          email: user.email,
          role: user.role,
          oldTenantId: user.tenantId
        });
        
        // Se for master, remover tenantId
        if (user.role === 'master') {
          console.log(`🔧 Removendo tenantId do usuário master: ${user.email}`);
          user.tenantId = undefined;
        } else {
          // Para outros usuários, atribuir ao tenant padrão
          console.log(`🔧 Corrigindo usuário: ${user.email}`);
          console.log(`   Tenant antigo: ${user.tenantId}`);
          console.log(`   Novo tenant: ${defaultTenant._id}`);
          user.tenantId = defaultTenant._id;
        }
        
        await user.save();
        fixedCount++;
      }
    }
    
    // Relatório final
    console.log('\n=============================================');
    console.log('📊 RESUMO DA CORREÇÃO');
    console.log('=============================================\n');
    
    if (fixedCount > 0) {
      console.log(`✅ ${fixedCount} usuário(s) corrigido(s) com sucesso:`);
      invalidUsers.forEach(u => {
        if (u.role === 'master') {
          console.log(`   - ${u.email} (master) - tenantId removido`);
        } else {
          console.log(`   - ${u.email} (${u.role}) - migrado para tenant padrão`);
        }
      });
    } else {
      console.log('✅ Nenhum usuário com tenantId inválido encontrado');
    }
    
    // Verificação final
    console.log('\n📝 Verificando integridade após correção...');
    const remainingInvalid = [];
    const usersAfterFix = await User.find({
      tenantId: { $exists: true, $ne: null }
    });
    
    for (const user of usersAfterFix) {
      if (!validTenantIds.includes(user.tenantId.toString())) {
        remainingInvalid.push(user);
      }
    }
    
    if (remainingInvalid.length === 0) {
      console.log('✅ Todos os usuários agora têm tenantId válido!');
    } else {
      console.log(`⚠️  Ainda há ${remainingInvalid.length} usuário(s) com problema`);
    }
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado do MongoDB');
  }
}

// Executar script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
