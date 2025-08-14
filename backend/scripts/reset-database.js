const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const QueueEntry = require('../models/QueueEntry');
const Agent = require('../models/Agent');
const File = require('../models/File');
require('dotenv').config({ path: '../.env' });

async function resetDatabase() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔗 Conectado ao MongoDB');

    // Limpar todas as coleções
    console.log('🗑️  Limpando banco de dados...');
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await QueueEntry.deleteMany({});
    await Agent.deleteMany({});
    await File.deleteMany({});
    
    console.log('✅ Banco de dados limpo!');

    // Criar usuários de teste com empresa
    console.log('👥 Criando usuários de teste...');

    // Admin
    const admin = await User.create({
      name: 'Admin Sistema',
      email: 'admin@teste.com',
      password: '123456',
      company: 'Tech Solutions',
      role: 'admin',
      status: 'online',
      isActive: true,
      active: true
    });

    // Agentes
    const agent1 = await User.create({
      name: 'Rafael França',
      email: 'rafael@teste.com',
      password: '123456',
      company: 'Tech Solutions',
      role: 'agent',
      status: 'online',
      isActive: true,
      active: true
    });

    const agent2 = await User.create({
      name: 'Maria Silva',
      email: 'maria@teste.com',
      password: '123456',
      company: 'Tech Solutions',
      role: 'agent',
      status: 'online',
      isActive: true,
      active: true
    });

    // Clientes
    const client1 = await User.create({
      name: 'João Santos',
      email: 'joao@teste.com',
      password: '123456',
      company: 'Empresa ABC',
      role: 'client',
      status: 'online',
      isActive: true,
      active: true
    });

    const client2 = await User.create({
      name: 'Ana Costa',
      email: 'ana@teste.com',
      password: '123456',
      company: 'StartUp XYZ',
      role: 'client',
      status: 'online',
      isActive: true,
      active: true
    });

    const client3 = await User.create({
      name: 'Pedro Oliveira',
      email: 'pedro@teste.com',
      password: '123456',
      company: 'Indústria 123',
      role: 'client',
      status: 'online',
      isActive: true,
      active: true
    });

    console.log('✅ Usuários criados com sucesso!');
    
    console.log('\n📋 USUÁRIOS CRIADOS:');
    console.log('=====================================');
    console.log('ADMIN:');
    console.log('  Email: admin@teste.com');
    console.log('  Senha: 123456');
    console.log('  Empresa: Tech Solutions');
    console.log('');
    console.log('AGENTES:');
    console.log('  Rafael França (Tech Solutions)');
    console.log('  - Email: rafael@teste.com');
    console.log('  - Senha: 123456');
    console.log('');
    console.log('  Maria Silva (Tech Solutions)');
    console.log('  - Email: maria@teste.com');
    console.log('  - Senha: 123456');
    console.log('');
    console.log('CLIENTES:');
    console.log('  João Santos (Empresa ABC)');
    console.log('  - Email: joao@teste.com');
    console.log('  - Senha: 123456');
    console.log('');
    console.log('  Ana Costa (StartUp XYZ)');
    console.log('  - Email: ana@teste.com');
    console.log('  - Senha: 123456');
    console.log('');
    console.log('  Pedro Oliveira (Indústria 123)');
    console.log('  - Email: pedro@teste.com');
    console.log('  - Senha: 123456');
    console.log('=====================================');

    // Criar algumas conversas de exemplo
    console.log('\n💬 Criando conversas de exemplo...');

    // Conversa ativa
    const conv1 = await Conversation.create({
      client: client1._id,
      assignedAgent: agent1._id,
      status: 'active',
      priority: 'normal',
      tags: ['suporte', 'urgente'],
      participants: [client1._id, agent1._id],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 horas atrás
    });

    // Adicionar mensagens
    await Message.create({
      conversationId: conv1._id,
      sender: client1._id,
      senderType: 'client',
      content: 'Olá, preciso de ajuda com o sistema!',
      type: 'text',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    });

    await Message.create({
      conversationId: conv1._id,
      sender: agent1._id,
      senderType: 'agent',
      content: 'Olá João! Sou Rafael da Tech Solutions. Como posso ajudá-lo hoje?',
      type: 'text',
      createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000)
    });

    // Conversa em espera
    const conv2 = await Conversation.create({
      client: client2._id,
      status: 'waiting',
      priority: 'high',
      tags: ['dúvida'],
      participants: [client2._id],
      createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutos atrás
    });

    await Message.create({
      conversationId: conv2._id,
      sender: client2._id,
      senderType: 'client',
      content: 'Boa tarde! Gostaria de saber mais sobre os planos disponíveis.',
      type: 'text',
      createdAt: new Date(Date.now() - 30 * 60 * 1000)
    });

    // Conversa fechada
    const conv3 = await Conversation.create({
      client: client3._id,
      assignedAgent: agent2._id,
      status: 'closed',
      priority: 'low',
      tags: ['resolvido'],
      participants: [client3._id, agent2._id],
      closedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      rating: 5,
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 dias atrás
    });

    await Message.create({
      conversationId: conv3._id,
      sender: client3._id,
      senderType: 'client',
      content: 'Bom dia, consegui resolver o problema. Obrigado!',
      type: 'text',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
    });

    await Message.create({
      conversationId: conv3._id,
      sender: agent2._id,
      senderType: 'agent',
      content: 'Que ótimo, Pedro! Fico feliz em saber. Qualquer dúvida estamos à disposição!',
      type: 'text',
      createdAt: new Date(Date.now() - 47 * 60 * 60 * 1000)
    });

    console.log('✅ Conversas de exemplo criadas!');
    console.log('\n🎉 BANCO DE DADOS RESETADO COM SUCESSO!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao resetar banco de dados:', error);
    process.exit(1);
  }
}

// Executar reset
resetDatabase();
