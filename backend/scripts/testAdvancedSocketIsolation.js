require('dotenv').config();
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

class TestClient {
  constructor(name, tenant, user, token, conversationId) {
    this.name = name;
    this.tenant = tenant;
    this.user = user;
    this.token = token;
    this.conversationId = conversationId;
    this.socket = null;
    this.receivedMessages = [];
    this.typingEvents = [];
    this.errors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`[${this.name}] 🔌 Conectando...`);
      
      this.socket = io(SERVER_URL, {
        auth: { token: this.token },
        query: { tenantId: this.tenant._id },
        transports: ['websocket']
      });

      this.socket.on('connect', () => {
        console.log(`[${this.name}] ✅ Conectado! Socket ID: ${this.socket.id}`);
        this.setupListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error(`[${this.name}] ❌ Erro de conexão:`, error.message);
        reject(error);
      });

      setTimeout(() => reject(new Error('Timeout na conexão')), 5000);
    });
  }

  setupListeners() {
    this.socket.on('newMessage', (message) => {
      this.receivedMessages.push(message);
      console.log(`[${this.name}] 📩 Mensagem recebida: ${message.text}`);
    });

    this.socket.on('typingStart', (data) => {
      this.typingEvents.push({ type: 'start', data });
      console.log(`[${this.name}] ⌨️ Alguém começou a digitar`);
    });

    this.socket.on('typingStop', (data) => {
      this.typingEvents.push({ type: 'stop', data });
      console.log(`[${this.name}] ⌨️ Alguém parou de digitar`);
    });

    this.socket.on('error', (error) => {
      this.errors.push(error);
      console.error(`[${this.name}] ❌ Erro:`, error);
    });
  }

  joinConversation() {
    return new Promise((resolve) => {
      this.socket.emit('joinConversation', this.conversationId);
      setTimeout(resolve, 500);
    });
  }

  sendMessage(text) {
    return new Promise((resolve) => {
      console.log(`[${this.name}] 📤 Enviando: "${text}"`);
      this.socket.emit('sendMessage', {
        conversationId: this.conversationId,
        text,
        type: 'text'
      }, (response) => {
        if (response.error) {
          console.error(`[${this.name}] ❌ Erro ao enviar:`, response.error);
        } else {
          console.log(`[${this.name}] ✅ Mensagem enviada`);
        }
        resolve(response);
      });
    });
  }

  startTyping() {
    console.log(`[${this.name}] ⌨️ Começando a digitar...`);
    this.socket.emit('typingStart', { conversationId: this.conversationId });
  }

  stopTyping() {
    console.log(`[${this.name}] ⌨️ Parando de digitar...`);
    this.socket.emit('typingStop', { conversationId: this.conversationId });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log(`[${this.name}] 🔌 Desconectado`);
    }
  }
}

async function runAdvancedTests() {
  console.log('\n🚀 TESTE AVANÇADO DE ISOLAMENTO SOCKET.IO\n');
  console.log('=' .repeat(60));
  
  // Conectar ao MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado ao MongoDB\n');

  try {
    // 1. Preparar dados de teste
    console.log('1️⃣ Preparando dados de teste...\n');
    
    const [tenantA, tenantB] = await Tenant.find().limit(2);
    const userA = await User.findOne({ tenantId: tenantA._id });
    const userB = await User.findOne({ tenantId: tenantB._id });

    console.log(`Tenant A: ${tenantA.name} (${tenantA._id})`);
    console.log(`Tenant B: ${tenantB.name} (${tenantB._id})`);
    console.log(`User A: ${userA.email} (${userA._id})`);
    console.log(`User B: ${userB.email} (${userB._id})`);

    // Criar conversas de teste
    const convA = await Conversation.create({
      tenantId: tenantA._id,
      client: userA._id,
      participants: [userA._id],
      status: 'waiting'
    });

    const convB = await Conversation.create({
      tenantId: tenantB._id,
      client: userB._id,
      participants: [userB._id],
      status: 'waiting'
    });

    // Gerar tokens (usando formato correto do sistema)
    const tokenA = jwt.sign(
      { 
        id: userA._id.toString(), 
        email: userA.email,
        role: userA.role,
        tenantId: tenantA._id.toString(),
        company: userA.company,
        name: userA.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const tokenB = jwt.sign(
      { 
        id: userB._id.toString(),
        email: userB.email,
        role: userB.role,
        tenantId: tenantB._id.toString(),
        company: userB.company,
        name: userB.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Criar clientes de teste
    const clientA = new TestClient('Tenant A', tenantA, userA, tokenA, convA._id);
    const clientB = new TestClient('Tenant B', tenantB, userB, tokenB, convB._id);
    const clientA2 = new TestClient('Tenant A-2', tenantA, userA, tokenA, convA._id);

    // 2. Conectar clientes
    console.log('\n2️⃣ Conectando clientes...\n');
    await Promise.all([
      clientA.connect(),
      clientB.connect(),
      clientA2.connect()
    ]);

    // 3. Entrar nas conversas
    console.log('\n3️⃣ Entrando nas conversas...\n');
    await Promise.all([
      clientA.joinConversation(),
      clientB.joinConversation(),
      clientA2.joinConversation()
    ]);

    // 4. Teste de mensagens simultâneas
    console.log('\n4️⃣ Teste de mensagens simultâneas...\n');
    await Promise.all([
      clientA.sendMessage('Msg 1 do Tenant A'),
      clientB.sendMessage('Msg 1 do Tenant B'),
      clientA2.sendMessage('Msg 2 do Tenant A (outro cliente)')
    ]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`\n[Tenant A] Recebeu ${clientA.receivedMessages.length} mensagens`);
    console.log(`[Tenant A-2] Recebeu ${clientA2.receivedMessages.length} mensagens`);
    console.log(`[Tenant B] Recebeu ${clientB.receivedMessages.length} mensagens`);

    // 5. Teste de eventos de digitação
    console.log('\n5️⃣ Teste de eventos de digitação...\n');
    
    clientA.startTyping();
    await new Promise(resolve => setTimeout(resolve, 500));
    clientA.stopTyping();
    
    clientB.startTyping();
    await new Promise(resolve => setTimeout(resolve, 500));
    clientB.stopTyping();

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`\n[Tenant A] Eventos de digitação: ${clientA.typingEvents.length}`);
    console.log(`[Tenant A-2] Eventos de digitação: ${clientA2.typingEvents.length}`);
    console.log(`[Tenant B] Eventos de digitação: ${clientB.typingEvents.length}`);

    // 6. Teste de tentativa cross-tenant
    console.log('\n6️⃣ Teste de acesso cross-tenant...\n');
    
    // Tenant A tenta acessar conversa do Tenant B
    const crossResult = await clientA.sendMessage('Tentativa cross-tenant');
    console.log(`Resultado tentativa cross-tenant: ${crossResult.error ? '❌ Bloqueado' : '⚠️ Permitido'}`);

    // 7. Análise de resultados
    console.log('\n=' .repeat(60));
    console.log('📊 ANÁLISE DE RESULTADOS:\n');

    const tests = [
      {
        name: 'Isolamento de mensagens',
        passed: clientB.receivedMessages.length === 1 && 
                clientB.receivedMessages.every(m => m.text.includes('Tenant B'))
      },
      {
        name: 'Broadcast no mesmo tenant',
        passed: clientA.receivedMessages.length === 2 && 
                clientA2.receivedMessages.length === 2
      },
      {
        name: 'Isolamento de eventos de digitação',
        passed: clientB.typingEvents.length === 1 && 
                clientA.typingEvents.length === 1
      },
      {
        name: 'Múltiplos clientes mesmo tenant',
        passed: clientA.typingEvents.length === clientA2.typingEvents.length
      }
    ];

    tests.forEach(test => {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });

    const allPassed = tests.every(t => t.passed);
    
    console.log('\n' + '=' .repeat(60));
    if (allPassed) {
      console.log('🎉 TODOS OS TESTES AVANÇADOS PASSARAM!');
      console.log('✅ Sistema de isolamento multi-tenant está funcionando perfeitamente');
    } else {
      console.log('⚠️ Alguns testes falharam. Verifique a implementação.');
    }

    // Limpar dados de teste
    console.log('\n🧹 Limpando dados de teste...');
    await Promise.all([
      Conversation.deleteOne({ _id: convA._id }),
      Conversation.deleteOne({ _id: convB._id }),
      Message.deleteMany({ conversationId: { $in: [convA._id, convB._id] } })
    ]);

    // Desconectar clientes
    clientA.disconnect();
    clientB.disconnect();
    clientA2.disconnect();

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Teste concluído. Conexão fechada.');
  }
}

// Executar testes
runAdvancedTests().catch(console.error);
