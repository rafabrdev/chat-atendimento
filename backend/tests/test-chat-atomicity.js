/**
 * Teste de Atomicidade do Accept de Chats
 * 
 * Este teste valida que apenas 1 agente pode aceitar cada chat,
 * mesmo com múltiplas tentativas concorrentes.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const chatService = require('../services/chatService');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    log('✅ MongoDB conectado', 'green');
  } catch (error) {
    log(`❌ Erro ao conectar MongoDB: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function setupTestData() {
  log('\n📝 Configurando dados de teste...', 'cyan');
  
  // Buscar ou criar tenant de teste
  const Tenant = require('../models/Tenant');
  let testTenant = await Tenant.findOne({ slug: 'test-atomicity' });
  
  if (!testTenant) {
    testTenant = await Tenant.create({
      name: 'Test Atomicity Company',
      companyName: 'Test Atomicity Company',
      slug: 'test-atomicity',
      key: `test-atomicity-${Date.now()}`,
      contactEmail: 'test@atomicity.com',
      active: true,
      plan: 'enterprise',
      settings: {
        maxAgents: 100,
        maxConversations: 1000
      }
    });
  }
  
  // Criar cliente de teste
  const testClient = await User.create({
    name: 'Test Client',
    email: `client-${Date.now()}@test.com`,
    password: 'Test123!',
    role: 'client',
    company: 'Test Company',
    department: 'general',
    tenantId: testTenant._id,
    active: true
  });
  
  // Criar múltiplos agentes de teste
  const agents = [];
  for (let i = 1; i <= 5; i++) {
    const agent = await User.create({
      name: `Agent ${i}`,
      email: `agent${i}-${Date.now()}@test.com`,
      password: 'Test123!',
      role: 'agent',
      company: 'Test Company',
      department: 'support',
      tenantId: testTenant._id,
      active: true,
      status: 'online'
    });
    agents.push(agent);
  }
  
  // Criar conversa em estado waiting
  const conversation = await Conversation.create({
    tenantId: testTenant._id,
    client: testClient._id,
    subject: 'Test Atomicity Chat',
    department: 'support',
    priority: 'high',
    status: 'waiting',
    participants: [testClient._id]
  });
  
  log(`✅ Dados criados: 1 conversa, ${agents.length} agentes`, 'green');
  
  return { conversation, agents, testTenant };
}

async function testConcurrentAccept(conversationId, agents, tenantId) {
  log('\n🚀 Iniciando teste de accept concorrente...', 'yellow');
  log(`   Conversa ID: ${conversationId}`, 'cyan');
  log(`   Número de agentes tentando aceitar: ${agents.length}`, 'cyan');
  
  const startTime = Date.now();
  
  // Criar promises para cada agente tentar aceitar simultaneamente
  const acceptPromises = agents.map((agent, index) => {
    return new Promise(async (resolve) => {
      const delay = Math.random() * 100; // Delay aleatório de 0-100ms
      
      setTimeout(async () => {
        const attemptStart = Date.now();
        
        try {
          log(`   Agent ${index + 1} tentando aceitar...`, 'blue');
          
          const result = await chatService.assignConversationToAgent(
            conversationId,
            agent._id,
            tenantId
          );
          
          const duration = Date.now() - attemptStart;
          log(`   ✅ Agent ${index + 1} CONSEGUIU aceitar! (${duration}ms)`, 'green');
          
          resolve({
            agentId: agent._id,
            agentName: agent.name,
            success: true,
            duration,
            result
          });
        } catch (error) {
          const duration = Date.now() - attemptStart;
          log(`   ❌ Agent ${index + 1} falhou: ${error.message} (${duration}ms)`, 'red');
          
          resolve({
            agentId: agent._id,
            agentName: agent.name,
            success: false,
            error: error.message,
            duration
          });
        }
      }, delay);
    });
  });
  
  // Executar todos simultaneamente
  const results = await Promise.all(acceptPromises);
  const totalDuration = Date.now() - startTime;
  
  // Analisar resultados
  const successfulAgents = results.filter(r => r.success);
  const failedAgents = results.filter(r => !r.success);
  
  log('\n📊 Resultados do teste:', 'magenta');
  log(`   Duração total: ${totalDuration}ms`, 'cyan');
  log(`   Agentes bem-sucedidos: ${successfulAgents.length}`, 'green');
  log(`   Agentes que falharam: ${failedAgents.length}`, 'yellow');
  
  // Validar atomicidade
  if (successfulAgents.length === 1) {
    log('\n✅ TESTE PASSOU! Apenas 1 agente conseguiu aceitar a conversa', 'green');
    log(`   Agente vencedor: ${successfulAgents[0].agentName}`, 'cyan');
  } else if (successfulAgents.length === 0) {
    log('\n⚠️ AVISO: Nenhum agente conseguiu aceitar', 'yellow');
  } else {
    log('\n❌ TESTE FALHOU! Múltiplos agentes aceitaram a conversa', 'red');
    successfulAgents.forEach(a => {
      log(`   - ${a.agentName}`, 'red');
    });
  }
  
  // Verificar estado final no banco
  const finalConversation = await Conversation.findById(conversationId)
    .populate('assignedAgent', 'name email');
  
  log('\n🔍 Estado final da conversa:', 'cyan');
  log(`   Status: ${finalConversation.status}`, 'blue');
  log(`   Agente atribuído: ${finalConversation.assignedAgent?.name || 'Nenhum'}`, 'blue');
  
  return {
    totalDuration,
    successCount: successfulAgents.length,
    failCount: failedAgents.length,
    passed: successfulAgents.length === 1
  };
}

async function testSequentialAttempts(conversationId, agents, tenantId) {
  log('\n🔄 Testando tentativas sequenciais após accept...', 'yellow');
  
  // Primeiro agente aceita
  const firstAgent = agents[0];
  try {
    await chatService.assignConversationToAgent(conversationId, firstAgent._id, tenantId);
    log(`   ✅ ${firstAgent.name} aceitou a conversa`, 'green');
  } catch (error) {
    log(`   ❌ Erro inesperado no primeiro accept: ${error.message}`, 'red');
    return false;
  }
  
  // Outros agentes tentam aceitar depois
  log('   Tentando com outros agentes...', 'cyan');
  
  for (let i = 1; i < Math.min(3, agents.length); i++) {
    const agent = agents[i];
    try {
      await chatService.assignConversationToAgent(conversationId, agent._id, tenantId);
      log(`   ❌ ERRO: ${agent.name} conseguiu aceitar uma conversa já aceita!`, 'red');
      return false;
    } catch (error) {
      log(`   ✅ ${agent.name} corretamente bloqueado: ${error.message}`, 'green');
    }
  }
  
  return true;
}

async function cleanup(testData) {
  log('\n🧹 Limpando dados de teste...', 'cyan');
  
  try {
    // Deletar conversa de teste
    await Conversation.deleteOne({ _id: testData.conversation._id });
    
    // Deletar usuários de teste
    const userIds = testData.agents.map(a => a._id);
    await User.deleteMany({ _id: { $in: userIds } });
    
    // Deletar cliente
    await User.deleteOne({ email: /^client-.*@test\.com$/ });
    
    log('✅ Limpeza concluída', 'green');
  } catch (error) {
    log(`⚠️ Erro na limpeza: ${error.message}`, 'yellow');
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), 'bright');
  log('   TESTE DE ATOMICIDADE - CHAT ACCEPT', 'bright');
  log('='.repeat(60), 'bright');
  
  try {
    // Conectar ao banco
    await connectDB();
    
    // Teste 1: Accept concorrente
    log('\n📌 TESTE 1: ACCEPT CONCORRENTE', 'magenta');
    const testData1 = await setupTestData();
    const test1Result = await testConcurrentAccept(
      testData1.conversation._id,
      testData1.agents,
      testData1.testTenant._id
    );
    await cleanup(testData1);
    
    // Teste 2: Tentativas sequenciais
    log('\n📌 TESTE 2: TENTATIVAS SEQUENCIAIS', 'magenta');
    const testData2 = await setupTestData();
    const test2Result = await testSequentialAttempts(
      testData2.conversation._id,
      testData2.agents,
      testData2.testTenant._id
    );
    await cleanup(testData2);
    
    // Resumo final
    log('\n' + '='.repeat(60), 'bright');
    log('   RESUMO DOS TESTES', 'bright');
    log('='.repeat(60), 'bright');
    
    const allTestsPassed = test1Result.passed && test2Result;
    
    log(`\nTeste 1 (Accept Concorrente): ${test1Result.passed ? '✅ PASSOU' : '❌ FALHOU'}`, test1Result.passed ? 'green' : 'red');
    log(`   - Duração: ${test1Result.totalDuration}ms`, 'cyan');
    log(`   - Accepts bem-sucedidos: ${test1Result.successCount}`, 'cyan');
    log(`   - Accepts bloqueados: ${test1Result.failCount}`, 'cyan');
    
    log(`\nTeste 2 (Tentativas Sequenciais): ${test2Result ? '✅ PASSOU' : '❌ FALHOU'}`, test2Result ? 'green' : 'red');
    
    if (allTestsPassed) {
      log('\n🎉 TODOS OS TESTES PASSARAM!', 'green');
      log('O sistema de accept de chats é ATÔMICO e THREAD-SAFE', 'green');
    } else {
      log('\n⚠️ ALGUNS TESTES FALHARAM', 'red');
      log('Verifique a implementação dos locks', 'red');
    }
    
    // Informações sobre o Redis
    const lockService = require('../services/lockService');
    const stats = lockService.getStats();
    log('\n📊 Estatísticas dos Locks:', 'cyan');
    log(`   Backend: ${stats.backend}`, 'blue');
    log(`   Locks adquiridos: ${stats.acquired}`, 'blue');
    log(`   Conflitos: ${stats.conflicts}`, 'blue');
    log(`   Liberados: ${stats.released}`, 'blue');
    
  } catch (error) {
    log(`\n❌ Erro fatal: ${error.message}`, 'red');
    console.error(error);
  } finally {
    // Desconectar do banco
    await mongoose.connection.close();
    log('\n👋 Teste finalizado', 'cyan');
    process.exit(0);
  }
}

// Executar testes
runTests().catch(console.error);
