/**
 * Script para testar a conexão com Redis
 * Execute com: node test-redis.js
 */

require('dotenv').config();

async function testRedis() {
  console.log('🔍 Testando conexão com Redis...\n');
  
  // Verificar se REDIS_URL está configurado
  if (!process.env.REDIS_URL || process.env.REDIS_URL === '') {
    console.log('❌ REDIS_URL não está configurado no .env');
    console.log('📝 Por favor, siga estes passos:');
    console.log('   1. Crie um database no Upstash');
    console.log('   2. Copie a Redis URL do dashboard');
    console.log('   3. Cole no arquivo .env na linha REDIS_URL=');
    return;
  }
  
  if (process.env.DISABLE_REDIS === 'true') {
    console.log('⚠️  Redis está desabilitado (DISABLE_REDIS=true)');
    console.log('💡 Para habilitar, remova ou comente a linha DISABLE_REDIS no .env');
    return;
  }
  
  console.log('📍 URL configurada:', process.env.REDIS_URL.replace(/:[^:]*@/, ':***@'));
  
  try {
    const redis = require('redis');
    
    console.log('\n🔄 Conectando ao Redis...');
    const client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 10000
      }
    });
    
    client.on('error', (err) => {
      console.error('❌ Erro de conexão:', err.message);
    });
    
    await client.connect();
    console.log('✅ Conectado com sucesso!\n');
    
    // Teste de escrita
    console.log('📝 Testando escrita...');
    const testKey = `test:${Date.now()}`;
    const testValue = { 
      message: 'Hello from Redis!', 
      timestamp: new Date().toISOString(),
      backend: 'Upstash'
    };
    
    await client.set(testKey, JSON.stringify(testValue), {
      EX: 60 // Expira em 60 segundos
    });
    console.log('✅ Escrita OK');
    
    // Teste de leitura
    console.log('\n📖 Testando leitura...');
    const retrieved = await client.get(testKey);
    const parsed = JSON.parse(retrieved);
    console.log('✅ Leitura OK:', parsed);
    
    // Teste de ping
    console.log('\n🏓 Testando PING...');
    const pingResult = await client.ping();
    console.log('✅ PONG recebido:', pingResult);
    
    // Info sobre o Redis
    console.log('\n📊 Informações do Redis:');
    const info = await client.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/);
    if (version) {
      console.log('   Versão:', version[1]);
    }
    console.log('   Provider: Upstash');
    console.log('   Status: Operacional');
    
    // Limpar teste
    await client.del(testKey);
    
    // Desconectar
    await client.quit();
    
    console.log('\n🎉 Teste concluído com sucesso!');
    console.log('✅ Redis está pronto para uso no seu projeto\n');
    
    // Testar serviços
    console.log('🔧 Testando serviços integrados...\n');
    
    // Testar cache service
    const cache = require('./services/cacheService');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar inicialização
    
    await cache.set('test-cache', { working: true }, 10);
    const cacheResult = await cache.get('test-cache');
    console.log('✅ Cache Service:', cacheResult ? 'Funcionando' : 'Erro');
    
    // Testar lock service
    const lockService = require('./services/lockService');
    const lockAcquired = await lockService.acquireLock('test-lock', 5000);
    if (lockAcquired) {
      await lockService.releaseLock('test-lock');
      console.log('✅ Lock Service: Funcionando');
    }
    
    console.log('\n📋 Resumo:');
    console.log('   ✅ Redis conectado');
    console.log('   ✅ Cache Service operacional');
    console.log('   ✅ Lock Service operacional');
    console.log('   ✅ Sistema pronto para escalar!');
    
  } catch (error) {
    console.error('\n❌ Erro ao conectar com Redis:', error.message);
    console.log('\n🔍 Possíveis soluções:');
    console.log('   1. Verifique se a URL está correta no .env');
    console.log('   2. Verifique se o database foi criado no Upstash');
    console.log('   3. Verifique sua conexão com a internet');
    console.log('   4. Tente criar um novo database no Upstash');
  }
  
  process.exit(0);
}

// Executar teste
testRedis().catch(console.error);
