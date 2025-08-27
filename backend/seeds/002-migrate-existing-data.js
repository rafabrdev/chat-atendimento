/**
 * Script de migração para associar todos os dados existentes ao tenant "default"
 * Este script adiciona o campo tenantId a todos os documentos existentes
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Importar todos os modelos que precisam de migração
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const File = require('../models/File');
const QueueEntry = require('../models/QueueEntry');
const Invitation = require('../models/Invitation');

async function migrateExistingData() {
  let defaultTenantId;
  
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Conectado ao MongoDB');
    console.log('🔄 Iniciando migração de dados existentes...\n');
    
    // Buscar o tenant default
    const defaultTenant = await Tenant.findOne({ slug: 'default' });
    
    if (!defaultTenant) {
      console.error('❌ Tenant "default" não encontrado! Execute o seed 001-tenant-default.js primeiro.');
      process.exit(1);
    }
    
    defaultTenantId = defaultTenant._id;
    console.log(`📍 Tenant Default ID: ${defaultTenantId}\n`);
    
    // Lista de coleções para migrar
    const collections = [
      { model: User, name: 'Users' },
      { model: Agent, name: 'Agents' },
      { model: Contact, name: 'Contacts' },
      { model: Conversation, name: 'Conversations' },
      { model: Message, name: 'Messages' },
      { model: File, name: 'Files' },
      { model: QueueEntry, name: 'QueueEntries' },
      { model: Invitation, name: 'Invitations' }
    ];
    
    // Estatísticas de migração
    const stats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0
    };
    
    // Migrar cada coleção
    for (const collection of collections) {
      console.log(`\n📋 Migrando ${collection.name}...`);
      
      try {
        // Contar documentos sem tenantId
        const documentsWithoutTenant = await collection.model.countDocuments({ 
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null }
          ]
        });
        
        if (documentsWithoutTenant === 0) {
          console.log(`   ✓ Todos os documentos já possuem tenantId`);
          stats.skipped += await collection.model.countDocuments({});
          continue;
        }
        
        console.log(`   - ${documentsWithoutTenant} documentos sem tenantId encontrados`);
        
        // Atualizar todos os documentos sem tenantId
        const updateResult = await collection.model.updateMany(
          { 
            $or: [
              { tenantId: { $exists: false } },
              { tenantId: null }
            ]
          },
          { 
            $set: { 
              tenantId: defaultTenantId,
              migratedAt: new Date(),
              migratedFrom: 'legacy-system'
            }
          }
        );
        
        console.log(`   ✅ ${updateResult.modifiedCount} documentos migrados`);
        stats.migrated += updateResult.modifiedCount;
        
        // Verificar documentos já com tenantId
        const documentsWithTenant = await collection.model.countDocuments({ 
          tenantId: { $exists: true, $ne: null }
        });
        
        console.log(`   📊 Total com tenantId: ${documentsWithTenant}`);
        stats.total += documentsWithTenant;
        
      } catch (error) {
        console.error(`   ❌ Erro ao migrar ${collection.name}:`, error.message);
        stats.errors++;
      }
    }
    
    // Criar índices compostos para performance
    console.log('\n🔧 Criando índices compostos para multi-tenancy...');
    
    const indexesToCreate = [
      { model: User, indexes: [{ tenantId: 1, email: 1 }, { tenantId: 1, createdAt: -1 }] },
      { model: Agent, indexes: [{ tenantId: 1, userId: 1 }, { tenantId: 1, isAvailable: 1 }] },
      { model: Contact, indexes: [{ tenantId: 1, email: 1 }, { tenantId: 1, phone: 1 }] },
      { model: Conversation, indexes: [{ tenantId: 1, status: 1 }, { tenantId: 1, createdAt: -1 }] },
      { model: Message, indexes: [{ tenantId: 1, conversationId: 1 }, { tenantId: 1, createdAt: -1 }] },
      { model: File, indexes: [{ tenantId: 1, createdAt: -1 }] },
      { model: QueueEntry, indexes: [{ tenantId: 1, status: 1 }, { tenantId: 1, priority: -1, createdAt: 1 }] },
      { model: Invitation, indexes: [{ tenantId: 1, email: 1 }, { tenantId: 1, status: 1 }] }
    ];
    
    for (const indexConfig of indexesToCreate) {
      try {
        for (const index of indexConfig.indexes) {
          await indexConfig.model.collection.createIndex(index);
          console.log(`   ✅ Índice criado em ${indexConfig.model.collection.name}: ${JSON.stringify(index)}`);
        }
      } catch (error) {
        if (error.code === 11000 || error.code === 85) {
          // Índice já existe
          console.log(`   ⚠️  Índice já existe em ${indexConfig.model.collection.name}`);
        } else {
          console.error(`   ❌ Erro ao criar índice:`, error.message);
        }
      }
    }
    
    // Atualizar estatísticas do tenant
    console.log('\n📊 Atualizando estatísticas do tenant...');
    
    const userCount = await User.countDocuments({ tenantId: defaultTenantId });
    const conversationCount = await Conversation.countDocuments({ tenantId: defaultTenantId });
    const messageCount = await Message.countDocuments({ tenantId: defaultTenantId });
    
    defaultTenant.stats.totalUsers = userCount;
    defaultTenant.stats.totalConversations = conversationCount;
    defaultTenant.stats.totalMessages = messageCount;
    defaultTenant.usage.currentUsers = userCount;
    
    await defaultTenant.save();
    
    // Exibir resumo da migração
    console.log('\n' + '='.repeat(60));
    console.log('📈 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ Documentos migrados: ${stats.migrated}`);
    console.log(`⏭️  Documentos já migrados: ${stats.skipped}`);
    console.log(`📊 Total de documentos com tenantId: ${stats.total}`);
    
    if (stats.errors > 0) {
      console.log(`⚠️  Coleções com erro: ${stats.errors}`);
    }
    
    console.log('\n📊 Estatísticas do Tenant Default:');
    console.log(`   - Total de usuários: ${userCount}`);
    console.log(`   - Total de conversas: ${conversationCount}`);
    console.log(`   - Total de mensagens: ${messageCount}`);
    
    console.log('\n✅ Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    // Desconectar do banco
    await mongoose.disconnect();
    console.log('\n✅ Conexão com o banco fechada');
  }
}

// Executar migração se for chamado diretamente
if (require.main === module) {
  migrateExistingData();
}

module.exports = migrateExistingData;
