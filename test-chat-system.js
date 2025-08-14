// Script de teste para validar o sistema de chat
// Execute com: node test-chat-system.js

const axios = require('axios');
const io = require('socket.io-client');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5000';

class ChatSystemTester {
  constructor() {
    this.tokens = {};
    this.sockets = {};
  }

  // Teste 1: Autenticação e Roles
  async testAuthentication() {
    console.log('\n🔐 Testando Autenticação e Roles...');
    
    try {
      // Testar login como cliente
      const clientLogin = await axios.post(`${API_URL}/auth/login`, {
        email: 'cliente@test.com',
        password: 'test123'
      });
      this.tokens.client = clientLogin.data.token;
      console.log('✅ Cliente autenticado');

      // Testar login como agente
      const agentLogin = await axios.post(`${API_URL}/auth/login`, {
        email: 'agent@test.com',
        password: 'test123'
      });
      this.tokens.agent = agentLogin.data.token;
      console.log('✅ Agente autenticado');

      // Testar login como admin
      const adminLogin = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@test.com',
        password: 'test123'
      });
      this.tokens.admin = adminLogin.data.token;
      console.log('✅ Admin autenticado');

      return true;
    } catch (error) {
      console.error('❌ Erro na autenticação:', error.response?.data || error.message);
      return false;
    }
  }

  // Teste 2: Verificar permissões RBAC
  async testRBAC() {
    console.log('\n🔒 Testando Permissões RBAC...');
    
    // Cliente tentando fechar conversa (deve falhar)
    try {
      await axios.patch(`${API_URL}/chat/conversations/test-id/close`, {}, {
        headers: { Authorization: `Bearer ${this.tokens.client}` }
      });
      console.error('❌ FALHA: Cliente conseguiu fechar conversa');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Cliente bloqueado de fechar conversa');
      }
    }

    // Agente tentando processar fila (deve falhar)
    try {
      await axios.post(`${API_URL}/chat/queue/process`, {}, {
        headers: { Authorization: `Bearer ${this.tokens.agent}` }
      });
      console.error('❌ FALHA: Agente conseguiu processar fila');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Agente bloqueado de processar fila manualmente');
      }
    }

    // Admin acessando rota de admin (deve funcionar)
    try {
      await axios.post(`${API_URL}/chat/queue/process`, {}, {
        headers: { Authorization: `Bearer ${this.tokens.admin}` }
      });
      console.log('✅ Admin pode processar fila');
    } catch (error) {
      console.error('❌ Admin não conseguiu processar fila:', error.response?.data);
    }
  }

  // Teste 3: Conexão Socket e Tempo Real
  async testSocketConnection() {
    console.log('\n🔌 Testando Conexões Socket.IO...');
    
    return new Promise((resolve) => {
      // Conectar cliente
      this.sockets.client = io(SOCKET_URL, {
        auth: { token: this.tokens.client }
      });

      this.sockets.client.on('connect', () => {
        console.log('✅ Cliente conectado via Socket');
      });

      // Conectar agente
      this.sockets.agent = io(SOCKET_URL, {
        auth: { token: this.tokens.agent }
      });

      this.sockets.agent.on('connect', () => {
        console.log('✅ Agente conectado via Socket');
      });

      // Aguardar conexões
      setTimeout(() => {
        resolve(true);
      }, 2000);
    });
  }

  // Teste 4: Latência de Mensagens
  async testMessageLatency() {
    console.log('\n⏱️ Testando Latência de Mensagens...');
    
    return new Promise((resolve) => {
      const testMessage = {
        conversationId: 'test-conv-' + Date.now(),
        content: 'Teste de latência: ' + Date.now(),
        type: 'text'
      };

      const startTime = Date.now();
      
      // Agente escuta por mensagens
      this.sockets.agent.on('new-message', (message) => {
        const latency = Date.now() - startTime;
        
        if (latency < 1000) {
          console.log(`✅ Mensagem recebida em ${latency}ms (< 1 segundo)`);
        } else {
          console.error(`❌ Latência alta: ${latency}ms`);
        }
        
        resolve(latency);
      });

      // Cliente envia mensagem
      this.sockets.client.emit('send-message', testMessage);
    });
  }

  // Teste 5: Ping/Pong para verificar conexão
  async testPingPong() {
    console.log('\n🏓 Testando Ping/Pong...');
    
    return new Promise((resolve) => {
      const pingTime = Date.now();
      
      this.sockets.client.on('pong', (data) => {
        const latency = data.latency || (Date.now() - pingTime);
        console.log(`✅ Pong recebido - Latência: ${latency}ms`);
        resolve(latency);
      });

      this.sockets.client.emit('ping', { timestamp: pingTime });
    });
  }

  // Teste 6: Criação de Conversa pelo Cliente
  async testClientConversationCreation() {
    console.log('\n💬 Testando Criação de Conversa pelo Cliente...');
    
    try {
      // Cliente cria conversa com mensagem inicial
      const response = await axios.post(`${API_URL}/chat/conversations`, 
        {
          initialMessage: 'Olá, preciso de ajuda!',
          priority: 'normal',
          tags: ['teste']
        },
        {
          headers: { Authorization: `Bearer ${this.tokens.client}` }
        }
      );

      if (response.data._id && response.data.status === 'waiting') {
        console.log('✅ Conversa criada com mensagem inicial');
        return response.data._id;
      }
    } catch (error) {
      console.error('❌ Erro ao criar conversa:', error.response?.data);
      return null;
    }
  }

  // Teste 7: Agente Aceita Conversa
  async testAgentAcceptConversation(conversationId) {
    console.log('\n👨‍💼 Testando Aceitação de Conversa pelo Agente...');
    
    if (!conversationId) {
      console.log('⚠️ Pulando teste - sem ID de conversa');
      return;
    }

    try {
      const response = await axios.patch(
        `${API_URL}/chat/conversations/${conversationId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${this.tokens.agent}` }
        }
      );

      if (response.data.status === 'active') {
        console.log('✅ Conversa aceita pelo agente');
      }
    } catch (error) {
      console.error('❌ Erro ao aceitar conversa:', error.response?.data);
    }
  }

  // Limpar recursos
  cleanup() {
    console.log('\n🧹 Limpando recursos...');
    
    if (this.sockets.client) this.sockets.client.disconnect();
    if (this.sockets.agent) this.sockets.agent.disconnect();
    
    console.log('✅ Recursos limpos');
  }

  // Executar todos os testes
  async runAllTests() {
    console.log('🚀 Iniciando Testes do Sistema de Chat');
    console.log('=====================================');
    
    // Executar testes em sequência
    const authSuccess = await this.testAuthentication();
    
    if (!authSuccess) {
      console.error('\n❌ Falha na autenticação. Abortando testes.');
      return;
    }

    await this.testRBAC();
    await this.testSocketConnection();
    
    const latency = await this.testMessageLatency();
    const pingLatency = await this.testPingPong();
    
    const conversationId = await this.testClientConversationCreation();
    await this.testAgentAcceptConversation(conversationId);
    
    // Relatório final
    console.log('\n📊 RELATÓRIO FINAL');
    console.log('==================');
    console.log(`Latência de mensagem: ${latency}ms`);
    console.log(`Latência de ping: ${pingLatency}ms`);
    console.log(`Status: ${latency < 1000 ? '✅ PASSOU' : '❌ FALHOU'}`);
    
    this.cleanup();
  }
}

// Executar testes
const tester = new ChatSystemTester();
tester.runAllTests().catch(console.error);
