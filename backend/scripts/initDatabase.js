/**
 * Script para inicializar e testar a conexão com MongoDB Atlas
 * Execute com: node scripts/initDatabase.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Importar modelos
const User = require('../models/User');
const Agent = require('../models/Agent');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const QueueEntry = require('../models/QueueEntry');
const File = require('../models/File');

// Cores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function connectDB() {
  try {
    console.log(`${colors.cyan}🔄 Conectando ao MongoDB Atlas...${colors.reset}`);
    console.log(`${colors.yellow}URI: ${process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@')}${colors.reset}`);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log(`${colors.green}✅ Conectado ao MongoDB Atlas com sucesso!${colors.reset}`);
    console.log(`${colors.blue}📊 Database: ${mongoose.connection.db.databaseName}${colors.reset}`);
    console.log(`${colors.blue}🖥️  Host: ${mongoose.connection.host}${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Erro ao conectar ao MongoDB Atlas:${colors.reset}`, error.message);
    return false;
  }
}

async function listCollections() {
  try {
    console.log(`\n${colors.cyan}📚 Listando coleções existentes...${colors.reset}`);
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log(`${colors.yellow}⚠️  Nenhuma coleção encontrada no banco de dados${colors.reset}`);
    } else {
      console.log(`${colors.green}Coleções encontradas:${colors.reset}`);
      for (const collection of collections) {
        const stats = await mongoose.connection.db.collection(collection.name).countDocuments();
        console.log(`  • ${collection.name}: ${stats} documentos`);
      }
    }
  } catch (error) {
    console.error(`${colors.red}❌ Erro ao listar coleções:${colors.reset}`, error.message);
  }
}

async function createIndexes() {
  try {
    console.log(`\n${colors.cyan}🔨 Criando índices...${colors.reset}`);
    
    // Índices para User
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ company: 1 });
    await User.collection.createIndex({ role: 1 });
    console.log(`  ✓ Índices criados para User`);
    
    // Índices para Agent
    await Agent.collection.createIndex({ userId: 1 });
    await Agent.collection.createIndex({ status: 1 });
    console.log(`  ✓ Índices criados para Agent`);
    
    // Índices para Contact
    await Contact.collection.createIndex({ phone: 1 });
    await Contact.collection.createIndex({ email: 1 });
    console.log(`  ✓ Índices criados para Contact`);
    
    // Índices para Conversation
    await Conversation.collection.createIndex({ contactId: 1 });
    await Conversation.collection.createIndex({ agentId: 1 });
    await Conversation.collection.createIndex({ status: 1 });
    await Conversation.collection.createIndex({ createdAt: -1 });
    console.log(`  ✓ Índices criados para Conversation`);
    
    // Índices para Message
    await Message.collection.createIndex({ conversationId: 1 });
    await Message.collection.createIndex({ senderId: 1 });
    await Message.collection.createIndex({ createdAt: -1 });
    console.log(`  ✓ Índices criados para Message`);
    
    // Índices para QueueEntry
    await QueueEntry.collection.createIndex({ contactId: 1 });
    await QueueEntry.collection.createIndex({ status: 1 });
    await QueueEntry.collection.createIndex({ priority: -1, createdAt: 1 });
    console.log(`  ✓ Índices criados para QueueEntry`);
    
    console.log(`${colors.green}✅ Todos os índices foram criados com sucesso!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Erro ao criar índices:${colors.reset}`, error.message);
  }
}

async function createAdminUser() {
  try {
    console.log(`\n${colors.cyan}👤 Verificando usuário administrador...${colors.reset}`);
    
    const adminEmail = 'admin@brsi.net.br';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log(`${colors.yellow}⚠️  Usuário administrador já existe${colors.reset}`);
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Nome: ${existingAdmin.name}`);
      console.log(`  Empresa: ${existingAdmin.company}`);
    } else {
      const adminUser = new User({
        email: adminEmail,
        password: 'Admin@2024!', // Será hasheada automaticamente
        name: 'Administrador',
        company: 'BR Sistemas',
        role: 'admin',
        status: 'offline',
        isActive: true,
        active: true
      });
      
      await adminUser.save();
      console.log(`${colors.green}✅ Usuário administrador criado com sucesso!${colors.reset}`);
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Senha: Admin@2024! ${colors.red}(MUDE ESTA SENHA!)${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Erro ao criar usuário admin:${colors.reset}`, error.message);
  }
}

async function createTestUsers() {
  try {
    console.log(`\n${colors.cyan}👥 Criando usuários de teste...${colors.reset}`);
    
    const testUsers = [
      {
        email: 'agente@brsi.net.br',
        password: 'Agente@2024',
        name: 'Agente Teste',
        company: 'BR Sistemas',
        role: 'agent',
        status: 'offline'
      },
      {
        email: 'cliente@exemplo.com',
        password: 'Cliente@2024',
        name: 'Cliente Teste',
        company: 'Empresa Exemplo',
        role: 'client',
        status: 'offline'
      }
    ];
    
    for (const userData of testUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (!existing) {
        const user = new User(userData);
        await user.save();
        console.log(`  ✓ Criado: ${userData.email} (${userData.role})`);
      } else {
        console.log(`  • Já existe: ${userData.email}`);
      }
    }
    
    console.log(`${colors.green}✅ Usuários de teste verificados!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Erro ao criar usuários de teste:${colors.reset}`, error.message);
  }
}

async function showStatistics() {
  try {
    console.log(`\n${colors.cyan}📊 Estatísticas do banco de dados:${colors.reset}`);
    
    const stats = {
      users: await User.countDocuments(),
      agents: await Agent.countDocuments(),
      contacts: await Contact.countDocuments(),
      conversations: await Conversation.countDocuments(),
      messages: await Message.countDocuments(),
      queueEntries: await QueueEntry.countDocuments(),
      files: await File.countDocuments()
    };
    
    console.log(`  Usuários: ${stats.users}`);
    console.log(`  Agentes: ${stats.agents}`);
    console.log(`  Contatos: ${stats.contacts}`);
    console.log(`  Conversas: ${stats.conversations}`);
    console.log(`  Mensagens: ${stats.messages}`);
    console.log(`  Fila: ${stats.queueEntries}`);
    console.log(`  Arquivos: ${stats.files}`);
    
    // Estatísticas por role
    const adminCount = await User.countDocuments({ role: 'admin' });
    const agentCount = await User.countDocuments({ role: 'agent' });
    const clientCount = await User.countDocuments({ role: 'client' });
    
    console.log(`\n  Distribuição de usuários:`);
    console.log(`    Admins: ${adminCount}`);
    console.log(`    Agentes: ${agentCount}`);
    console.log(`    Clientes: ${clientCount}`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Erro ao obter estatísticas:${colors.reset}`, error.message);
  }
}

async function main() {
  console.log(`${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   Inicialização do MongoDB Atlas          ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}`);
  
  // Conectar ao banco
  const connected = await connectDB();
  if (!connected) {
    console.log(`\n${colors.red}❌ Não foi possível conectar ao banco. Verifique suas credenciais.${colors.reset}`);
    process.exit(1);
  }
  
  // Listar coleções existentes
  await listCollections();
  
  // Criar índices
  await createIndexes();
  
  // Criar usuário admin
  await createAdminUser();
  
  // Criar usuários de teste
  await createTestUsers();
  
  // Mostrar estatísticas
  await showStatistics();
  
  console.log(`\n${colors.green}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.green}║   ✅ Inicialização concluída com sucesso!  ║${colors.reset}`);
  console.log(`${colors.green}╚════════════════════════════════════════════╝${colors.reset}`);
  
  console.log(`\n${colors.cyan}📝 Próximos passos:${colors.reset}`);
  console.log(`  1. Teste o login com: admin@brsi.net.br / Admin@2024!`);
  console.log(`  2. Inicie o servidor: npm run dev`);
  console.log(`  3. Acesse: http://localhost:5000/api-docs para a documentação`);
  
  // Desconectar
  await mongoose.connection.close();
  console.log(`\n${colors.blue}👋 Conexão fechada${colors.reset}`);
  process.exit(0);
}

// Executar
main().catch(error => {
  console.error(`${colors.red}❌ Erro fatal:${colors.reset}`, error);
  process.exit(1);
});
