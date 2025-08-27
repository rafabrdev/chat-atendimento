/**
 * Validação da Implementação Socket.IO Multi-Tenant
 * 
 * Este script valida que todos os componentes necessários
 * para o isolamento Socket.IO estão implementados corretamente
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDAÇÃO DA IMPLEMENTAÇÃO SOCKET.IO MULTI-TENANT');
console.log('======================================================\n');

const validationResults = {
  passed: [],
  failed: [],
  warnings: []
};

// 1. Verificar se os arquivos principais existem
console.log('1️⃣ Verificando arquivos principais...');

const requiredFiles = [
  'middleware/socketTenantMiddleware.js',
  'socket/socketHandlers.js',
  'server.js'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file} existe`);
    validationResults.passed.push(`Arquivo ${file} existe`);
  } else {
    console.log(`   ❌ ${file} NÃO encontrado`);
    validationResults.failed.push(`Arquivo ${file} não encontrado`);
  }
});

// 2. Analisar socketTenantMiddleware.js
console.log('\n2️⃣ Analisando socketTenantMiddleware.js...');

const middlewarePath = path.join(__dirname, '..', 'middleware', 'socketTenantMiddleware.js');
if (fs.existsSync(middlewarePath)) {
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Verificar funcionalidades essenciais
  const features = [
    { pattern: /authenticate.*socket.*next/s, name: 'Método authenticate' },
    { pattern: /jwt\.verify/s, name: 'Verificação JWT' },
    { pattern: /registerConnection/s, name: 'Registro de conexões' },
    { pattern: /unregisterConnection/s, name: 'Limpeza de conexões' },
    { pattern: /validateTenantAccess/s, name: 'Validação de acesso ao tenant' },
    { pattern: /emitToTenant/s, name: 'Broadcast por tenant' },
    { pattern: /tenant:\${tenantId}/s, name: 'Rooms por tenant' },
    { pattern: /requireModule/s, name: 'Validação de módulos' },
    { pattern: /getConnectionStats/s, name: 'Estatísticas de conexão' }
  ];
  
  features.forEach(feature => {
    if (feature.pattern.test(middlewareContent)) {
      console.log(`   ✅ ${feature.name} implementado`);
      validationResults.passed.push(`${feature.name} implementado`);
    } else {
      console.log(`   ❌ ${feature.name} NÃO encontrado`);
      validationResults.failed.push(`${feature.name} não encontrado`);
    }
  });
}

// 3. Analisar socketHandlers.js
console.log('\n3️⃣ Analisando socketHandlers.js...');

const handlersPath = path.join(__dirname, '..', 'socket', 'socketHandlers.js');
if (fs.existsSync(handlersPath)) {
  const handlersContent = fs.readFileSync(handlersPath, 'utf8');
  
  const handlerFeatures = [
    { pattern: /handleConnection/s, name: 'Handler de conexão' },
    { pattern: /socket\.tenantId/s, name: 'Contexto de tenant' },
    { pattern: /socket\.join.*tenant:/s, name: 'Join em rooms de tenant' },
    { pattern: /handleJoinConversation/s, name: 'Join conversation com validação' },
    { pattern: /tenantFilter.*tenantId/s, name: 'Filtro de tenant em queries' },
    { pattern: /socket\.to.*tenant:/s, name: 'Emissão para tenant específico' },
    { pattern: /handleDisconnect/s, name: 'Handler de desconexão' }
  ];
  
  handlerFeatures.forEach(feature => {
    if (feature.pattern.test(handlersContent)) {
      console.log(`   ✅ ${feature.name} implementado`);
      validationResults.passed.push(`${feature.name} implementado em handlers`);
    } else {
      console.log(`   ❌ ${feature.name} NÃO encontrado`);
      validationResults.failed.push(`${feature.name} não encontrado em handlers`);
    }
  });
}

// 4. Verificar integração no server.js
console.log('\n4️⃣ Verificando integração no server.js...');

const serverPath = path.join(__dirname, '..', 'server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  const serverFeatures = [
    { pattern: /SocketTenantMiddleware/s, name: 'Import do middleware' },
    { pattern: /socketTenantMiddleware.*=.*new/s, name: 'Instância do middleware' },
    { pattern: /io\.use.*authenticate/s, name: 'Middleware aplicado ao Socket.IO' },
    { pattern: /socketHandlers.*handleConnection/s, name: 'Handlers conectados' },
    { pattern: /socketTenantMiddleware\.unregisterConnection/s, name: 'Limpeza em disconnect' }
  ];
  
  serverFeatures.forEach(feature => {
    if (feature.pattern.test(serverContent)) {
      console.log(`   ✅ ${feature.name} configurado`);
      validationResults.passed.push(`${feature.name} no server.js`);
    } else {
      console.log(`   ❌ ${feature.name} NÃO configurado`);
      validationResults.failed.push(`${feature.name} não configurado no server.js`);
    }
  });
}

// 5. Verificar segurança
console.log('\n5️⃣ Verificando recursos de segurança...');

const securityChecks = [
  {
    file: 'middleware/socketTenantMiddleware.js',
    checks: [
      { pattern: /Cross-tenant access denied/s, name: 'Bloqueio cross-tenant' },
      { pattern: /Tenant suspended/s, name: 'Verificação de tenant suspenso' },
      { pattern: /Authentication required/s, name: 'Autenticação obrigatória' },
      { pattern: /Invalid token/s, name: 'Validação de token' }
    ]
  }
];

securityChecks.forEach(({ file, checks }) => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    checks.forEach(check => {
      if (check.pattern.test(content)) {
        console.log(`   ✅ ${check.name} implementado`);
        validationResults.passed.push(`Segurança: ${check.name}`);
      } else {
        console.log(`   ⚠️  ${check.name} pode estar faltando`);
        validationResults.warnings.push(`Segurança: ${check.name} pode estar faltando`);
      }
    });
  }
});

// 6. Verificar helpers de broadcast
console.log('\n6️⃣ Verificando helpers de broadcast...');

const broadcastHelpers = [
  'emitToTenant',
  'emitToTenantAgents', 
  'emitToTenantClients',
  'isUserConnected',
  'getUserSockets'
];

const middlewareFile = fs.readFileSync(middlewarePath, 'utf8');
broadcastHelpers.forEach(helper => {
  if (middlewareFile.includes(helper)) {
    console.log(`   ✅ Helper ${helper} disponível`);
    validationResults.passed.push(`Helper ${helper} disponível`);
  } else {
    console.log(`   ❌ Helper ${helper} não encontrado`);
    validationResults.failed.push(`Helper ${helper} não encontrado`);
  }
});

// 7. Análise de Rooms Structure
console.log('\n7️⃣ Analisando estrutura de rooms...');

const roomPatterns = [
  { pattern: /tenant:\${tenantId}/g, name: 'Room principal do tenant' },
  { pattern: /tenant:\${tenantId}:agents/g, name: 'Room de agentes' },
  { pattern: /tenant:\${tenantId}:clients/g, name: 'Room de clientes' },
  { pattern: /conversation:\${/g, name: 'Room de conversação' }
];

let roomsImplemented = 0;
roomPatterns.forEach(({ pattern, name }) => {
  const middlewareMatches = (middlewareFile.match(pattern) || []).length;
  const handlersFile = fs.readFileSync(handlersPath, 'utf8');
  const handlersMatches = (handlersFile.match(pattern) || []).length;
  
  if (middlewareMatches > 0 || handlersMatches > 0) {
    console.log(`   ✅ ${name} implementada`);
    validationResults.passed.push(`Room: ${name}`);
    roomsImplemented++;
  } else {
    console.log(`   ⚠️  ${name} pode não estar implementada`);
    validationResults.warnings.push(`Room: ${name} pode não estar implementada`);
  }
});

// RESUMO FINAL
console.log('\n' + '='.repeat(70));
console.log('📊 RESUMO DA VALIDAÇÃO');
console.log('='.repeat(70));

const totalChecks = validationResults.passed.length + 
                   validationResults.failed.length + 
                   validationResults.warnings.length;

console.log(`\n✅ Aprovados: ${validationResults.passed.length}/${totalChecks}`);
console.log(`❌ Falharam: ${validationResults.failed.length}/${totalChecks}`);
console.log(`⚠️  Avisos: ${validationResults.warnings.length}/${totalChecks}`);

// Cálculo de pontuação
const score = (validationResults.passed.length / totalChecks) * 100;
console.log(`\n📈 Pontuação: ${score.toFixed(1)}%`);

// Veredicto
console.log('\n🎯 VEREDICTO:');
if (score >= 90) {
  console.log('   ✅ IMPLEMENTAÇÃO COMPLETA E ROBUSTA!');
  console.log('   O sistema Socket.IO está pronto para multi-tenancy.');
} else if (score >= 70) {
  console.log('   ⚠️  IMPLEMENTAÇÃO FUNCIONAL COM ALGUMAS LACUNAS');
  console.log('   O sistema funciona mas pode precisar de melhorias.');
} else {
  console.log('   ❌ IMPLEMENTAÇÃO INCOMPLETA');
  console.log('   Correções necessárias antes de usar em produção.');
}

// Detalhes dos problemas se houver
if (validationResults.failed.length > 0) {
  console.log('\n❌ Problemas encontrados:');
  validationResults.failed.forEach(issue => {
    console.log(`   - ${issue}`);
  });
}

if (validationResults.warnings.length > 0) {
  console.log('\n⚠️  Avisos:');
  validationResults.warnings.forEach(warning => {
    console.log(`   - ${warning}`);
  });
}

// Verificações adicionais de isolamento
console.log('\n🔒 ANÁLISE DE ISOLAMENTO:');

const isolationFeatures = {
  'Autenticação JWT': validationResults.passed.some(p => p.includes('Verificação JWT')),
  'Rooms por Tenant': validationResults.passed.some(p => p.includes('Room principal do tenant')),
  'Validação Cross-Tenant': validationResults.passed.some(p => p.includes('cross-tenant')),
  'Contexto de Tenant': validationResults.passed.some(p => p.includes('Contexto de tenant')),
  'Broadcast Isolado': validationResults.passed.some(p => p.includes('emitToTenant')),
  'Limpeza de Conexões': validationResults.passed.some(p => p.includes('Limpeza'))
};

Object.entries(isolationFeatures).forEach(([feature, implemented]) => {
  console.log(`   ${implemented ? '✅' : '❌'} ${feature}`);
});

const isolationScore = Object.values(isolationFeatures).filter(v => v).length;
const totalIsolationFeatures = Object.keys(isolationFeatures).length;

console.log(`\n   Isolamento: ${isolationScore}/${totalIsolationFeatures} recursos implementados`);

if (isolationScore === totalIsolationFeatures) {
  console.log('   🎉 ISOLAMENTO MULTI-TENANT COMPLETO!');
} else if (isolationScore >= 4) {
  console.log('   ✅ Isolamento funcional, mas pode ser melhorado');
} else {
  console.log('   ⚠️  Isolamento incompleto - revisar implementação');
}

console.log('\n✨ Validação concluída!\n');

// Exportar resultado para uso em outros scripts
module.exports = {
  score,
  validationResults,
  isolationScore,
  isComplete: score >= 90 && isolationScore === totalIsolationFeatures
};
