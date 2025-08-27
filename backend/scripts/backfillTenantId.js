const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Importar modelos
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const File = require('../models/File');
const Setting = require('../models/Setting');

async function backfillTenantId() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    console.log('✅ Conectado ao MongoDB');
    console.log('\n🔧 Iniciando migração de dados para Multi-tenancy\n');
    console.log('=' .repeat(60));
    
    // 1. Garantir que o tenant default existe
    let defaultTenant = await Tenant.findOne({ key: 'default' });
    
    if (!defaultTenant) {
      console.log('⚠️  Tenant default não encontrado. Criando...');
      defaultTenant = await Tenant.create({
        key: 'default',
        name: 'Default Organization',
        status: 'active',
        plan: {
          name: 'standard',
          maxUsers: 100,
          maxChatsPerMonth: 10000,
          features: ['chat', 'file_upload', 'email_notifications']
        }
      });
      console.log('✅ Tenant default criado:', defaultTenant.name);
    } else {
      console.log('✅ Tenant default encontrado:', defaultTenant.name);
    }
    
    const defaultTenantId = defaultTenant._id;
    console.log(`   ID: ${defaultTenantId}`);
    
    // 2. Atualizar Users (exceto masters)
    console.log('\n📊 Atualizando Users...');
    const usersWithoutTenant = await User.countDocuments({
      tenantId: { $exists: false },
      role: { $ne: 'master' }
    });
    
    if (usersWithoutTenant > 0) {
      const result = await User.updateMany(
        {
          tenantId: { $exists: false },
          role: { $ne: 'master' }
        },
        {
          $set: { tenantId: defaultTenantId }
        }
      );
      console.log(`   ✅ ${result.modifiedCount} usuários atualizados com tenantId`);
    } else {
      console.log('   ✅ Todos os usuários já têm tenantId');
    }
    
    // 3. Atualizar Conversations
    console.log('\n📊 Atualizando Conversations...');
    const conversationsWithoutTenant = await Conversation.countDocuments({
      tenantId: { $exists: false }
    });
    
    if (conversationsWithoutTenant > 0) {
      const result = await Conversation.updateMany(
        { tenantId: { $exists: false } },
        { $set: { tenantId: defaultTenantId } }
      );
      console.log(`   ✅ ${result.modifiedCount} conversas atualizadas com tenantId`);
    } else {
      console.log('   ✅ Todas as conversas já têm tenantId');
    }
    
    // 4. Atualizar Messages
    console.log('\n📊 Atualizando Messages...');
    const messagesWithoutTenant = await Message.countDocuments({
      tenantId: { $exists: false }
    });
    
    if (messagesWithoutTenant > 0) {
      const result = await Message.updateMany(
        { tenantId: { $exists: false } },
        { $set: { tenantId: defaultTenantId } }
      );
      console.log(`   ✅ ${result.modifiedCount} mensagens atualizadas com tenantId`);
    } else {
      console.log('   ✅ Todas as mensagens já têm tenantId');
    }
    
    // 5. Atualizar Files
    console.log('\n📊 Atualizando Files...');
    const filesWithoutTenant = await File.countDocuments({
      tenantId: { $exists: false }
    });
    
    if (filesWithoutTenant > 0) {
      const result = await File.updateMany(
        { tenantId: { $exists: false } },
        { $set: { tenantId: defaultTenantId } }
      );
      console.log(`   ✅ ${result.modifiedCount} arquivos atualizados com tenantId`);
    } else {
      console.log('   ✅ Todos os arquivos já têm tenantId');
    }
    
    // 6. Criar índices
    console.log('\n🗄️  Criando índices...\n');
    
    // User índices
    console.log('   📑 User:');
    await User.collection.createIndex(
      { tenantId: 1, email: 1 },
      { unique: true, partialFilterExpression: { tenantId: { $exists: true } } }
    );
    console.log('      ✅ Índice único {tenantId, email}');
    
    await User.collection.createIndex({ tenantId: 1, status: 1, lastSeen: -1 });
    console.log('      ✅ Índice {tenantId, status, lastSeen}');
    
    await User.collection.createIndex({ tenantId: 1, role: 1 });
    console.log('      ✅ Índice {tenantId, role}');
    
    // Conversation índices
    console.log('   📑 Conversation:');
    await Conversation.collection.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, status, createdAt}');
    
    await Conversation.collection.createIndex({ tenantId: 1, assignedAgent: 1, status: 1 });
    console.log('      ✅ Índice {tenantId, assignedAgent, status}');
    
    await Conversation.collection.createIndex({ tenantId: 1, client: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, client, createdAt}');
    
    await Conversation.collection.createIndex({ tenantId: 1, status: 1, priority: -1, createdAt: 1 });
    console.log('      ✅ Índice {tenantId, status, priority, createdAt}');
    
    // Message índices
    console.log('   📑 Message:');
    await Message.collection.createIndex({ tenantId: 1, conversationId: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, conversationId, createdAt}');
    
    await Message.collection.createIndex({ tenantId: 1, sender: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, sender, createdAt}');
    
    await Message.collection.createIndex({ tenantId: 1, isRead: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, isRead, createdAt}');
    
    // File índices
    console.log('   📑 File:');
    await File.collection.createIndex({ tenantId: 1, conversation: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, conversation, createdAt}');
    
    await File.collection.createIndex({ tenantId: 1, uploadedBy: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, uploadedBy, createdAt}');
    
    await File.collection.createIndex({ tenantId: 1, fileType: 1, createdAt: -1 });
    console.log('      ✅ Índice {tenantId, fileType, createdAt}');
    
    // Setting índices
    console.log('   📑 Setting:');
    await Setting.collection.createIndex({ tenantId: 1, key: 1 }, { unique: true });
    console.log('      ✅ Índice único {tenantId, key}');
    
    await Setting.collection.createIndex({ tenantId: 1, category: 1 });
    console.log('      ✅ Índice {tenantId, category}');
    
    // 7. Estatísticas finais
    console.log('\n' + '=' .repeat(60));
    console.log('\n📈 Estatísticas Finais:\n');
    
    const models = [
      { Model: User, name: 'Users', filter: { role: { $ne: 'master' } } },
      { Model: Conversation, name: 'Conversations' },
      { Model: Message, name: 'Messages' },
      { Model: File, name: 'Files' },
      { Model: Setting, name: 'Settings' }
    ];
    
    for (const { Model, name, filter = {} } of models) {
      const total = await Model.countDocuments(filter);
      const withTenant = await Model.countDocuments({ ...filter, tenantId: { $exists: true } });
      const percentage = total > 0 ? ((withTenant / total) * 100).toFixed(1) : 100;
      
      console.log(`   ${name}: ${withTenant}/${total} (${percentage}%) com tenantId`);
    }
    
    // 8. Criar configurações padrão para o tenant default
    console.log('\n⚙️  Criando configurações padrão...');
    
    const defaultSettings = [
      {
        key: 'chat.timeout',
        value: 300000, // 5 minutos em ms
        valueType: 'number',
        category: 'chat',
        description: 'Tempo de timeout do chat em milissegundos',
        isPublic: false
      },
      {
        key: 'chat.max_file_size',
        value: 10485760, // 10MB em bytes
        valueType: 'number',
        category: 'chat',
        description: 'Tamanho máximo de arquivo em bytes',
        isPublic: true
      },
      {
        key: 'chat.allowed_file_types',
        value: ['image/*', 'application/pdf', 'text/*'],
        valueType: 'array',
        category: 'chat',
        description: 'Tipos de arquivo permitidos',
        isPublic: true
      },
      {
        key: 'notification.email_enabled',
        value: true,
        valueType: 'boolean',
        category: 'notification',
        description: 'Habilitar notificações por email',
        isPublic: false
      }
    ];
    
    for (const settingData of defaultSettings) {
      const exists = await Setting.findOne({
        tenantId: defaultTenantId,
        key: settingData.key
      });
      
      if (!exists) {
        await Setting.create({
          ...settingData,
          tenantId: defaultTenantId
        });
        console.log(`   ✅ Configuração criada: ${settingData.key}`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Migração concluída com sucesso!');
    console.log('\n🎉 Sistema preparado para Multi-tenancy!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

// Executar
backfillTenantId();
