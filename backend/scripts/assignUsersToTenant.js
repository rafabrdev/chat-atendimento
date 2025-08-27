const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Importar modelos
const User = require('../models/User');
const Tenant = require('../models/Tenant');

async function assignUsersToTenant() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    console.log('✅ Conectado ao MongoDB');
    
    // Buscar o tenant default
    const defaultTenant = await Tenant.findOne({ key: 'default' });
    
    if (!defaultTenant) {
      console.log('❌ Tenant default não encontrado. Execute o seed primeiro!');
      return;
    }
    
    console.log(`✅ Tenant default encontrado: ${defaultTenant.name} (${defaultTenant._id})`);
    
    // Buscar usuários sem tenantId (exceto master)
    const usersWithoutTenant = await User.find({
      tenantId: { $exists: false },
      role: { $ne: 'master' }
    });
    
    console.log(`\n📊 Encontrados ${usersWithoutTenant.length} usuários sem tenant`);
    
    if (usersWithoutTenant.length > 0) {
      console.log('\n🔧 Atualizando usuários...\n');
      
      for (const user of usersWithoutTenant) {
        // Atualizar usuário com tenantId
        await User.updateOne(
          { _id: user._id },
          { $set: { tenantId: defaultTenant._id } }
        );
        
        console.log(`   ✅ ${user.email} - atribuído ao tenant ${defaultTenant.name}`);
      }
      
      console.log(`\n✅ Total de ${usersWithoutTenant.length} usuários atualizados!`);
    }
    
    // Verificar master users (não devem ter tenantId)
    const masterUsers = await User.find({ role: 'master' });
    console.log(`\n👑 ${masterUsers.length} usuários master encontrados (não precisam de tenant)`);
    
    for (const master of masterUsers) {
      if (master.tenantId) {
        // Remover tenantId de master
        await User.updateOne(
          { _id: master._id },
          { $unset: { tenantId: '' } }
        );
        console.log(`   ⚠️  Removido tenantId de master: ${master.email}`);
      } else {
        console.log(`   ✅ Master sem tenant (correto): ${master.email}`);
      }
    }
    
    // Estatísticas finais
    console.log('\n📈 Estatísticas Finais:');
    console.log('=' .repeat(50));
    
    const stats = await User.aggregate([
      {
        $group: {
          _id: {
            role: '$role',
            hasTenant: { $cond: [{ $ifNull: ['$tenantId', false] }, true, false] }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.role': 1 } }
    ]);
    
    stats.forEach(stat => {
      console.log(`   ${stat._id.role} (${stat._id.hasTenant ? 'COM' : 'SEM'} tenant): ${stat.count}`);
    });
    
    // Verificar se todos os não-master têm tenant agora
    const nonMasterWithoutTenant = await User.countDocuments({
      tenantId: { $exists: false },
      role: { $ne: 'master' }
    });
    
    if (nonMasterWithoutTenant === 0) {
      console.log('\n✅ SUCESSO: Todos os usuários não-master têm tenant!');
    } else {
      console.log(`\n⚠️  ATENÇÃO: Ainda existem ${nonMasterWithoutTenant} usuários não-master sem tenant`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

// Executar
assignUsersToTenant();
