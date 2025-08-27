const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Conversation = require('../models/Conversation');

// Configurar JWT_SECRET para testes
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-123';
}

const SERVER_URL = process.env.SOCKET_URL || 'http://localhost:5000';

class SocketTestClient {
  constructor(token, tenantKey, name) {
    this.token = token;
    this.tenantKey = tenantKey;
    this.name = name;
    this.socket = null;
    this.receivedMessages = [];
    this.receivedEvents = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`[${this.name}] Conectando ao servidor...`);
      
      this.socket = io(SERVER_URL, {
        auth: {
          token: this.token,
          tenantKey: this.tenantKey
        },
        transports: ['websocket'],
        reconnection: false
      });

      this.socket.on('connect', () => {
        console.log(`[${this.name}] ✅ Conectado! Socket ID: ${this.socket.id}`);
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error(`[${this.name}] ❌ Erro de conexão:`, error.message);
        reject(error);
      });

      // Timeout de conexão
      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  setupEventListeners() {
    // Escutar por mensagens
    this.socket.on('new-message', (message) => {
      console.log(`[${this.name}] 📩 Nova mensagem recebida:`, message.content);
      this.receivedMessages.push(message);
    });

    // Escutar por atualizações de conversa
    this.socket.on('conversation-updated', (data) => {
      console.log(`[${this.name}] 🔄 Conversa atualizada:`, data.conversationId);
      this.receivedEvents.push({ type: 'conversation-updated', data });
    });

    // Escutar por notificações
    this.socket.on('new-message-notification', (data) => {
      console.log(`[${this.name}] 🔔 Notificação recebida:`, data.conversationId);
      this.receivedEvents.push({ type: 'new-message-notification', data });
    });

    // Escutar por status de usuário
    this.socket.on('user-status-changed', (data) => {
      console.log(`[${this.name}] 👤 Status de usuário mudou:`, data.userId, data.status);
      this.receivedEvents.push({ type: 'user-status-changed', data });
    });
  }

  joinConversation(conversationId) {
    return new Promise((resolve) => {
      console.log(`[${this.name}] Entrando na conversa: ${conversationId}`);
      
      this.socket.emit('join-conversation', { conversationId });
      
      this.socket.once('joined-conversation', (data) => {
        console.log(`[${this.name}] ✅ Entrou na sala: ${data.room}`);
        resolve(data);
      });
    });
  }

  sendMessage(conversationId, content) {
    console.log(`[${this.name}] 📤 Enviando mensagem: "${content}"`);
    
    this.socket.emit('send-message', {
      conversationId,
      content,
      type: 'text'
    });

    return new Promise((resolve) => {
      this.socket.once('message-sent', (data) => {
        console.log(`[${this.name}] ✅ Mensagem enviada com ID: ${data.messageId}`);
        resolve(data);
      });

      this.socket.once('message-error', (error) => {
        console.error(`[${this.name}] ❌ Erro ao enviar mensagem:`, error);
        resolve(null);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      console.log(`[${this.name}] Desconectando...`);
      this.socket.disconnect();
    }
  }

  clearReceivedData() {
    this.receivedMessages = [];
    this.receivedEvents = [];
  }
}

async function testSocketIsolation() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento');
    console.log('✅ Conectado ao MongoDB\n');
    console.log('🔐 Testando Isolamento de Socket.IO entre Tenants\n');
    console.log('=' .repeat(60));

    // 1. Buscar ou criar dois tenants diferentes
    console.log('\n1️⃣ Preparando tenants para teste...');
    
    let tenantA = await Tenant.findOne({ key: 'default' });
    if (!tenantA) {
      console.log('❌ Tenant default não encontrado');
      return;
    }
    
    let tenantB = await Tenant.findOne({ key: { $ne: 'default' } });
    if (!tenantB) {
      console.log('   Criando segundo tenant para teste...');
      tenantB = await Tenant.create({
        key: 'test-tenant',
        name: 'Test Tenant',
        companyName: 'Test Company',
        status: 'active',
        isActive: true
      });
    }

    console.log(`   Tenant A: ${tenantA.name} (${tenantA._id})`);
    console.log(`   Tenant B: ${tenantB.name} (${tenantB._id})`);

    // 2. Buscar usuários de cada tenant
    console.log('\n2️⃣ Buscando usuários para teste...');
    
    const userA = await User.findOne({ 
      tenantId: tenantA._id,
      role: { $in: ['admin', 'agent'] }
    });
    
    let userB = await User.findOne({ 
      tenantId: tenantB._id,
      role: { $in: ['admin', 'agent'] }
    });
    
    // Se não existir usuário no tenant B, criar um
    if (!userB) {
      console.log('   Criando usuário para Tenant B...');
      userB = await User.create({
        name: 'Test User B',
        email: `test${Date.now()}@tenantb.com`,
        password: 'Test123!',
        role: 'admin',
        company: tenantB.name,
        tenantId: tenantB._id
      });
    }

    console.log(`   User A: ${userA.email} (Tenant: ${tenantA.name})`);
    console.log(`   User B: ${userB.email} (Tenant: ${tenantB.name})`);

    // 3. Gerar tokens JWT
    console.log('\n3️⃣ Gerando tokens JWT...');
    
    const { generateToken } = require('../middleware/jwtAuth');
    
    userA.tenantId = tenantA; // Popular tenant para token
    userB.tenantId = tenantB;
    
    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);
    
    console.log('   ✅ Tokens gerados com sucesso');

    // 4. Criar conversas para teste
    console.log('\n4️⃣ Criando conversas para teste...');
    
    const conversationA = await Conversation.create({
      tenantId: tenantA._id,
      client: userA._id,
      participants: [userA._id],
      status: 'active'
    });
    
    const conversationB = await Conversation.create({
      tenantId: tenantB._id,
      client: userB._id,
      participants: [userB._id],
      status: 'active'
    });

    console.log(`   Conversa A: ${conversationA._id} (Tenant A)`);
    console.log(`   Conversa B: ${conversationB._id} (Tenant B)`);

    // 5. Conectar clientes Socket.IO
    console.log('\n5️⃣ Conectando clientes Socket.IO...\n');
    
    const clientA = new SocketTestClient(tokenA, tenantA.key, 'Client A');
    const clientB = new SocketTestClient(tokenB, tenantB.key, 'Client B');
    
    await Promise.all([
      clientA.connect(),
      clientB.connect()
    ]);

    // Aguardar um pouco para garantir que as conexões estão estáveis
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 6. Fazer ambos entrarem em suas respectivas conversas
    console.log('\n6️⃣ Entrando nas conversas...\n');
    
    await Promise.all([
      clientA.joinConversation(conversationA._id.toString()),
      clientB.joinConversation(conversationB._id.toString())
    ]);

    // 7. Cliente A envia mensagem na conversa A
    console.log('\n7️⃣ Teste de isolamento: Cliente A envia mensagem...\n');
    
    clientA.clearReceivedData();
    clientB.clearReceivedData();
    
    await clientA.sendMessage(
      conversationA._id.toString(), 
      'Mensagem do Tenant A - NÃO deve aparecer no Tenant B'
    );

    // Aguardar propagação
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 8. Verificar isolamento
    console.log('\n8️⃣ Verificando isolamento...\n');
    
    console.log(`[Client A] Mensagens recebidas: ${clientA.receivedMessages.length}`);
    console.log(`[Client B] Mensagens recebidas: ${clientB.receivedMessages.length}`);
    
    if (clientA.receivedMessages.length > 0 && clientB.receivedMessages.length === 0) {
      console.log('✅ ISOLAMENTO FUNCIONANDO! Cliente B não recebeu mensagens do Tenant A');
    } else if (clientB.receivedMessages.length > 0) {
      console.log('❌ FALHA NO ISOLAMENTO! Cliente B recebeu mensagens do Tenant A');
      console.log('   Mensagens recebidas por B:', clientB.receivedMessages);
    }

    // 9. Testar tentativa de acesso cross-tenant
    console.log('\n9️⃣ Testando tentativa de acesso cross-tenant...\n');
    
    console.log('Cliente A tentando entrar na conversa do Tenant B...');
    
    // Limpar listeners anteriores
    clientA.socket.removeAllListeners('joined-conversation');
    
    // Tentar entrar na conversa do outro tenant
    clientA.socket.emit('join-conversation', { 
      conversationId: conversationB._id.toString() 
    });
    
    // Aguardar resposta
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Cliente A tenta enviar mensagem na conversa B
    console.log('Cliente A tentando enviar mensagem na conversa do Tenant B...');
    
    clientB.clearReceivedData();
    
    await clientA.sendMessage(
      conversationB._id.toString(),
      'Tentativa de invasão cross-tenant'
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (clientB.receivedMessages.length === 0) {
      console.log('✅ SEGURANÇA OK! Tentativa de acesso cross-tenant bloqueada');
    } else {
      console.log('❌ FALHA DE SEGURANÇA! Mensagem cross-tenant foi recebida');
    }

    // 10. Verificar eventos globais do tenant
    console.log('\n🔟 Verificando eventos globais do tenant...\n');
    
    const eventsA = clientA.receivedEvents.filter(e => e.type === 'conversation-updated');
    const eventsB = clientB.receivedEvents.filter(e => e.type === 'conversation-updated');
    
    console.log(`[Client A] Eventos de atualização: ${eventsA.length}`);
    console.log(`[Client B] Eventos de atualização: ${eventsB.length}`);
    
    // Verificar se eventos têm tenantId correto
    const crossTenantEvents = eventsA.filter(e => 
      e.data.tenantId && e.data.tenantId !== tenantA._id.toString()
    );
    
    if (crossTenantEvents.length === 0) {
      console.log('✅ Eventos respeitam fronteiras de tenant');
    } else {
      console.log('❌ Eventos cross-tenant detectados:', crossTenantEvents);
    }

    // Resumo
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESUMO DOS TESTES:\n');
    
    const allTestsPassed = 
      clientA.receivedMessages.length > 0 && 
      clientB.receivedMessages.length === 0 &&
      crossTenantEvents.length === 0;
    
    if (allTestsPassed) {
      console.log('✅ TODOS OS TESTES PASSARAM!');
      console.log('✅ Isolamento entre tenants está funcionando corretamente');
      console.log('✅ Mensagens e eventos respeitam fronteiras de tenant');
      console.log('✅ Tentativas de acesso cross-tenant são bloqueadas');
    } else {
      console.log('❌ ALGUNS TESTES FALHARAM');
      console.log('⚠️  Revisar implementação de isolamento');
    }

    // Limpar
    console.log('\n🧹 Limpando dados de teste...');
    
    clientA.disconnect();
    clientB.disconnect();
    
    await Conversation.deleteOne({ _id: conversationA._id });
    await Conversation.deleteOne({ _id: conversationB._id });
    
    if (userB.email.startsWith('test')) {
      await User.deleteOne({ _id: userB._id });
    }
    
    if (tenantB.key === 'test-tenant') {
      await Tenant.deleteOne({ _id: tenantB._id });
    }
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Teste concluído. Conexão fechada.');
    process.exit(0);
  }
}

// Executar testes
console.log('⚠️  Certifique-se que o servidor está rodando na porta 5000');
console.log('⏳ Iniciando testes em 3 segundos...\n');

setTimeout(() => {
  testSocketIsolation();
}, 3000);
