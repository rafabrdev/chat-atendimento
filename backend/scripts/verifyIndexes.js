const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function verifyIndexes() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    console.log('✅ Conectado ao MongoDB\n');
    console.log('📊 Verificando índices das coleções:\n');
    console.log('=' .repeat(60));
    
    const collections = [
      'users',
      'conversations',
      'messages',
      'files',
      'settings',
      'tenants'
    ];
    
    for (const collectionName of collections) {
      console.log(`\n📑 ${collectionName.toUpperCase()}:`);
      
      try {
        const collection = mongoose.connection.collection(collectionName);
        const indexes = await collection.indexes();
        
        console.log(`   Total de índices: ${indexes.length}`);
        
        indexes.forEach(index => {
          const keys = Object.entries(index.key)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
          
          const options = [];
          if (index.unique) options.push('unique');
          if (index.sparse) options.push('sparse');
          if (index.partialFilterExpression) options.push('partial');
          
          const optionsStr = options.length > 0 ? ` [${options.join(', ')}]` : '';
          
          console.log(`   ✓ {${keys}}${optionsStr} - ${index.name}`);
        });
      } catch (error) {
        console.log(`   ⚠️  Coleção não encontrada ou erro: ${error.message}`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Verificação de índices concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

// Executar
verifyIndexes();
