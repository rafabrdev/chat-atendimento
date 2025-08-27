require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { generateToken } = require('../middleware/jwtAuth');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
  result: (msg) => console.log(`${colors.magenta}📊 ${msg}${colors.reset}`)
};

// Configuração da API
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function setupTestData() {
  log.info('Configurando dados de teste...\n');
  
  // 1. Criar ou buscar tenant de teste
  let tenant = await Tenant.findOne({ key: 'test-atomic' });
  if (!tenant) {
    tenant = await Tenant.create({
      key: 'test-atomic',
      name: 'Test Atomic Tenant',
      companyName: 'Atomic Test Company',
      slug: 'test-atomic-slug',
      contactEmail: 'admin@test-atomic.com',
      plan: 'starter',
      subscription: { 
        plan: 'starter',
        status: 'active'
      },
      isActive: true
    });
    log.success('Tenant de teste criado');
  } else {
    log.info('Usando tenant existente');
  }
  
  // 2. Criar cliente
  let client = await User.findOne({ email: 'client@test-atomic.com' });
  if (!client) {
    client = await User.create({
      tenantId: tenant._id,
      email: 'client@test-atomic.com',
      password: 'Test123456',
      name: 'Test Client',
      company: 'Atomic Test Company',
      role: 'client',
      active: true
    });
    log.success('Cliente criado');
  } else {
    log.info('Usando cliente existente');
  }
  
  // 3. Criar dois agentes
  let agent1 = await User.findOne({ email: 'agent1@test-atomic.com' });
  if (!agent1) {
    agent1 = await User.create({
      tenantId: tenant._id,
      email: 'agent1@test-atomic.com',
      password: 'Test123456',
      name: 'Test Agent 1',
      company: 'Atomic Test Company',
      role: 'agent',
      department: 'support',
      active: true,
      status: 'online'
    });
    log.success('Agente 1 criado');
  } else {
    // Garantir que está online
    agent1.status = 'online';
    await agent1.save();
    log.info('Usando agente 1 existente');
  }
  
  let agent2 = await User.findOne({ email: 'agent2@test-atomic.com' });
  if (!agent2) {
    agent2 = await User.create({
      tenantId: tenant._id,
      email: 'agent2@test-atomic.com',
      password: 'Test123456',
      name: 'Test Agent 2',
      company: 'Atomic Test Company',
      role: 'agent',
      department: 'support',
      active: true,
      status: 'online'
    });
    log.success('Agente 2 criado');
  } else {
    // Garantir que está online
    agent2.status = 'online';
    await agent2.save();
    log.info('Usando agente 2 existente');
  }
  
  // 4. Criar conversa em status 'waiting'
  const conversation = await Conversation.create({
    tenantId: tenant._id,
    client: client._id,
    status: 'waiting',
    priority: 'normal',
    participants: [client._id],
    subject: 'Test Atomic Accept',
    department: 'general'
  });
  log.success(`Conversa criada: ${conversation._id}`);
  
  // 5. Gerar tokens JWT para os agentes
  // Preparar objetos de usuário com tenantId para gerar token
  agent1.tenantId = tenant;
  agent2.tenantId = tenant;
  
  const token1 = generateToken(agent1);
  const token2 = generateToken(agent2);
  
  return {
    tenant,
    client,
    agent1,
    agent2,
    conversation,
    token1,
    token2
  };
}

async function testConcurrentAccept(conversationId, token1, token2) {
  log.test('\n🏁 Iniciando teste de aceitação concorrente...\n');
  
  const endpoint = `${API_URL}/chat/conversations/${conversationId}/accept`;
  
  // Configurar headers com os tokens
  const config1 = {
    headers: { 'Authorization': `Bearer ${token1}` },
    validateStatus: () => true // Aceitar qualquer status
  };
  
  const config2 = {
    headers: { 'Authorization': `Bearer ${token2}` },
    validateStatus: () => true // Aceitar qualquer status
  };
  
  // Fazer duas requisições simultâneas
  log.info('Enviando 2 requisições simultâneas para aceitar a mesma conversa...');
  
  const [response1, response2] = await Promise.all([
    axios.patch(endpoint, {}, config1),
    axios.patch(endpoint, {}, config2)
  ]);
  
  // Analisar resultados
  log.result('\nResultados das requisições:\n');
  
  log.info(`Agente 1 - Status: ${response1.status}`);
  if (response1.status === 200) {
    log.success('Agente 1 conseguiu aceitar a conversa');
  } else if (response1.status === 409) {
    log.warning(`Agente 1 recebeu 409: ${response1.data.error}`);
  } else {
    log.error(`Agente 1 recebeu status inesperado: ${response1.status}`);
  }
  
  log.info(`Agente 2 - Status: ${response2.status}`);
  if (response2.status === 200) {
    log.success('Agente 2 conseguiu aceitar a conversa');
  } else if (response2.status === 409) {
    log.warning(`Agente 2 recebeu 409: ${response2.data.error}`);
  } else {
    log.error(`Agente 2 recebeu status inesperado: ${response2.status}`);
  }
  
  // Verificar que apenas um conseguiu (200) e o outro recebeu 409
  const successCount = [response1.status, response2.status].filter(s => s === 200).length;
  const conflictCount = [response1.status, response2.status].filter(s => s === 409).length;
  
  log.result('\n📈 Análise de atomicidade:\n');
  
  if (successCount === 1 && conflictCount === 1) {
    log.success('✨ ATOMICIDADE GARANTIDA! Apenas 1 agente conseguiu aceitar');
  } else if (successCount === 2) {
    log.error('⚠️  PROBLEMA DE CONCORRÊNCIA! Ambos agentes aceitaram');
  } else if (successCount === 0) {
    log.error('⚠️  PROBLEMA! Nenhum agente conseguiu aceitar');
  } else {
    log.warning(`Resultado inesperado: ${successCount} sucessos, ${conflictCount} conflitos`);
  }
  
  return { response1, response2 };
}

async function verifyDatabaseState(conversationId) {
  log.test('\n🔍 Verificando estado do banco de dados...\n');
  
  const conversation = await Conversation.findById(conversationId)
    .populate('assignedAgent', 'name email');
  
  if (!conversation) {
    log.error('Conversa não encontrada no banco!');
    return;
  }
  
  log.info(`Status da conversa: ${conversation.status}`);
  log.info(`Agente atribuído: ${conversation.assignedAgent ? conversation.assignedAgent.name : 'Nenhum'}`);
  
  if (conversation.status === 'active' && conversation.assignedAgent) {
    log.success('✅ Estado consistente: conversa ativa com agente atribuído');
  } else if (conversation.status === 'waiting') {
    log.warning('⚠️  Conversa ainda está em espera');
  } else {
    log.warning('⚠️  Estado inconsistente detectado');
  }
  
  return conversation;
}

async function testMultipleAttempts(conversationId, token1) {
  log.test('\n🔄 Testando tentativas múltiplas do mesmo agente...\n');
  
  const endpoint = `${API_URL}/chat/conversations/${conversationId}/accept`;
  const config = {
    headers: { 'Authorization': `Bearer ${token1}` },
    validateStatus: () => true
  };
  
  // Primeira tentativa
  log.info('Primeira tentativa...');
  const response1 = await axios.patch(endpoint, {}, config);
  log.info(`Resposta 1: Status ${response1.status}`);
  
  // Segunda tentativa (deve falhar com 409)
  log.info('Segunda tentativa (idempotência)...');
  const response2 = await axios.patch(endpoint, {}, config);
  log.info(`Resposta 2: Status ${response2.status}`);
  
  if (response2.status === 409 || response2.status === 400) {
    log.success('✅ Endpoint é idempotente - segunda tentativa foi rejeitada');
  } else if (response2.status === 200) {
    log.error('⚠️  Problema de idempotência - mesma conversa aceita duas vezes');
  }
  
  return { response1, response2 };
}

async function cleanup(testData) {
  log.info('\n🧹 Limpando dados de teste...');
  
  // Remover conversa de teste
  await Conversation.deleteOne({ _id: testData.conversation._id });
  
  // Resetar status dos agentes
  await User.updateMany(
    { _id: { $in: [testData.agent1._id, testData.agent2._id] } },
    { status: 'online' }
  );
  
  log.success('Dados de teste limpos');
}

async function runTests() {
  log.info('🚀 Iniciando testes de atomicidade do chat accept\n');
  
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    log.success('Conectado ao MongoDB\n');
    
    // Configurar dados de teste
    const testData = await setupTestData();
    
    // Teste 1: Aceitação concorrente
    await testConcurrentAccept(
      testData.conversation._id,
      testData.token1,
      testData.token2
    );
    
    // Verificar estado do banco
    const finalConversation = await verifyDatabaseState(testData.conversation._id);
    
    // Teste 2: Tentativas múltiplas (se a primeira conversa foi aceita)
    if (finalConversation && finalConversation.status === 'active') {
      // Criar nova conversa para teste de idempotência
      const newConversation = await Conversation.create({
        tenantId: testData.tenant._id,
        client: testData.client._id,
        status: 'waiting',
        priority: 'normal',
        participants: [testData.client._id],
        subject: 'Test Idempotency',
        department: 'general'
      });
      
      await testMultipleAttempts(newConversation._id, testData.token1);
      
      // Limpar conversa adicional
      await Conversation.deleteOne({ _id: newConversation._id });
    }
    
    // Limpar dados de teste
    await cleanup(testData);
    
    // Resumo final
    console.log('\n' + '='.repeat(60));
    log.success('TESTES COMPLETOS!');
    console.log('='.repeat(60));
    
  } catch (error) {
    log.error(`Erro durante os testes: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log.info('\nConexão fechada');
  }
}

// Executar testes
runTests().catch(console.error);
