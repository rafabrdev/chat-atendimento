const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
require('dotenv').config();

// Importar o modelo User
const User = require('../models/User');

// Interface para input do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer perguntas
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function createAdmin() {
  try {
    console.log(colors.cyan + '\n=================================');
    console.log('  CRIAR USUÁRIO ADMINISTRADOR');
    console.log('=================================' + colors.reset);
    
    // Conectar ao MongoDB
    console.log(colors.yellow + '\n📡 Conectando ao MongoDB...' + colors.reset);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    console.log(colors.green + '✅ Conectado ao MongoDB!' + colors.reset);
    
    // Verificar conexão e listar usuários existentes
    console.log(colors.cyan + '\n📋 Usuários existentes no banco:' + colors.reset);
    const existingUsers = await User.find({}, 'name email role createdAt');
    
    if (existingUsers.length > 0) {
      console.table(existingUsers.map(u => ({
        Nome: u.name,
        Email: u.email,
        Role: u.role,
        Criado: new Date(u.createdAt).toLocaleString('pt-BR')
      })));
    } else {
      console.log(colors.yellow + 'Nenhum usuário encontrado no banco.' + colors.reset);
    }
    
    // Perguntar se quer criar novo admin
    const continuar = await question('\n🤔 Deseja criar um novo administrador? (s/n): ');
    
    if (continuar.toLowerCase() !== 's') {
      console.log(colors.yellow + '\nOperação cancelada.' + colors.reset);
      process.exit(0);
    }
    
    // Coletar informações
    console.log(colors.cyan + '\n📝 Digite os dados do novo administrador:' + colors.reset);
    const name = await question('Nome completo: ');
    const email = await question('Email: ');
    const password = await question('Senha (mínimo 6 caracteres): ');
    
    // Validar entrada
    if (!name || !email || !password) {
      throw new Error('Todos os campos são obrigatórios!');
    }
    
    if (password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres!');
    }
    
    // Verificar se email já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error(`Email ${email} já está cadastrado!`);
    }
    
    // Criar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário admin
    const admin = new User({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      lastActivity: new Date()
    });
    
    // Salvar no banco
    await admin.save();
    
    console.log(colors.green + '\n✅ Administrador criado com sucesso!' + colors.reset);
    console.log(colors.cyan + '\n📋 Detalhes do usuário criado:' + colors.reset);
    console.table({
      ID: admin._id.toString(),
      Nome: admin.name,
      Email: admin.email,
      Role: admin.role,
      Ativo: admin.isActive ? 'Sim' : 'Não',
      Criado: new Date(admin.createdAt).toLocaleString('pt-BR')
    });
    
    // Verificar persistência
    console.log(colors.yellow + '\n🔍 Verificando persistência...' + colors.reset);
    const savedUser = await User.findById(admin._id);
    
    if (savedUser) {
      console.log(colors.green + '✅ Usuário confirmado no banco de dados!' + colors.reset);
      
      // Mostrar total de usuários
      const totalUsers = await User.countDocuments();
      const totalAdmins = await User.countDocuments({ role: 'admin' });
      const totalAgents = await User.countDocuments({ role: 'agent' });
      
      console.log(colors.cyan + '\n📊 Estatísticas do banco:' + colors.reset);
      console.table({
        'Total de Usuários': totalUsers,
        'Administradores': totalAdmins,
        'Atendentes': totalAgents
      });
    } else {
      console.log(colors.red + '❌ Erro ao verificar persistência!' + colors.reset);
    }
    
    console.log(colors.cyan + '\n🔐 Informações de login:' + colors.reset);
    console.log('URL: http://52.90.17.204/login');
    console.log(`Email: ${email}`);
    console.log(`Senha: ${password}`);
    console.log(colors.yellow + '\n⚠️  Guarde essas informações com segurança!' + colors.reset);
    
  } catch (error) {
    console.error(colors.red + '\n❌ Erro:', error.message + colors.reset);
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log(colors.cyan + '\n👋 Conexão fechada.' + colors.reset);
    process.exit(0);
  }
}

// Executar
createAdmin();
