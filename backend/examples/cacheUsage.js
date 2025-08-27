/**
 * Exemplos de uso do Cache Service
 * 
 * Este arquivo demonstra como usar o cache em diferentes cenários
 */

const cache = require('../services/cacheService');

/**
 * Exemplo 1: Cache simples
 */
async function exemploSimples() {
  console.log('\n--- Exemplo 1: Cache Simples ---');
  
  // Armazenar um valor
  await cache.set('usuario:123', {
    id: 123,
    nome: 'João Silva',
    email: 'joao@example.com'
  }, 60); // TTL de 60 segundos
  
  // Recuperar o valor
  const usuario = await cache.get('usuario:123');
  console.log('Usuário do cache:', usuario);
  
  // Deletar o valor
  await cache.delete('usuario:123');
  console.log('Usuário removido do cache');
}

/**
 * Exemplo 2: Cache com factory (getOrSet)
 */
async function exemploGetOrSet() {
  console.log('\n--- Exemplo 2: GetOrSet ---');
  
  // Simula uma operação cara (busca no banco, API externa, etc)
  async function buscarDadosCaros() {
    console.log('  📊 Executando operação cara...');
    // Simula delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      dados: 'Dados obtidos do banco de dados',
      timestamp: new Date().toISOString()
    };
  }
  
  // Primeira chamada: vai executar a factory
  console.log('Primeira chamada:');
  const resultado1 = await cache.getOrSet(
    'dados-caros',
    buscarDadosCaros,
    30 // TTL de 30 segundos
  );
  console.log('  Resultado:', resultado1);
  
  // Segunda chamada: pega do cache
  console.log('\nSegunda chamada (do cache):');
  const resultado2 = await cache.getOrSet(
    'dados-caros',
    buscarDadosCaros,
    30
  );
  console.log('  Resultado:', resultado2);
  console.log('  ✅ Note que a operação cara não foi executada novamente!');
}

/**
 * Exemplo 3: Cache específico por tenant
 */
async function exemploTenantCache() {
  console.log('\n--- Exemplo 3: Cache por Tenant ---');
  
  const tenantId = 'empresa-abc';
  
  // Armazenar configurações do tenant
  await cache.tenantCache(tenantId, 'config', {
    tema: 'azul',
    idioma: 'pt-BR',
    limiteUsuarios: 100
  });
  
  // Armazenar lista de usuários online
  await cache.tenantCache(tenantId, 'usuarios-online', [
    'user1', 'user2', 'user3'
  ], 10); // TTL curto de 10 segundos
  
  // Recuperar dados
  const config = await cache.tenantCache(tenantId, 'config');
  const usuariosOnline = await cache.tenantCache(tenantId, 'usuarios-online');
  
  console.log('Configurações do tenant:', config);
  console.log('Usuários online:', usuariosOnline);
  
  // Limpar todo o cache do tenant
  await cache.clearTenantCache(tenantId);
  console.log('Cache do tenant limpo');
}

/**
 * Exemplo 4: Padrões de cache para diferentes casos de uso
 */
async function exemplosPadroesCache() {
  console.log('\n--- Exemplo 4: Padrões de Cache ---');
  
  // 1. Cache de sessão
  await cache.set('session:abc123', {
    userId: 123,
    permissions: ['read', 'write'],
    lastAccess: Date.now()
  }, 3600); // 1 hora
  
  // 2. Cache de contagem/métricas
  const viewKey = 'page-views:homepage';
  const currentViews = await cache.get(viewKey) || 0;
  await cache.set(viewKey, currentViews + 1, 60);
  
  // 3. Cache de rate limiting
  const ipKey = `rate-limit:192.168.1.1`;
  const requests = await cache.get(ipKey) || 0;
  if (requests < 100) {
    await cache.set(ipKey, requests + 1, 60); // Reset a cada minuto
    console.log(`  IP permitido (${requests + 1}/100 requests)`);
  } else {
    console.log('  ⚠️ Rate limit excedido!');
  }
  
  // 4. Cache de resultado de query
  await cache.set('query:produtos:categoria:eletronicos', [
    { id: 1, nome: 'Notebook', preco: 2500 },
    { id: 2, nome: 'Mouse', preco: 50 }
  ], 300); // 5 minutos
  
  console.log('Diferentes padrões de cache aplicados');
}

/**
 * Exemplo 5: Monitoramento e estatísticas
 */
async function exemploEstatisticas() {
  console.log('\n--- Exemplo 5: Estatísticas ---');
  
  // Fazer algumas operações para gerar estatísticas
  await cache.set('teste1', 'valor1');
  await cache.get('teste1'); // Hit
  await cache.get('teste2'); // Miss
  await cache.get('teste1'); // Hit
  await cache.delete('teste1');
  
  // Obter estatísticas
  const stats = cache.getStats();
  console.log('Estatísticas do cache:');
  console.log('  Backend:', stats.backend);
  console.log('  Hits:', stats.hits);
  console.log('  Misses:', stats.misses);
  console.log('  Hit Rate:', stats.hitRate);
  console.log('  Sets:', stats.sets);
  console.log('  Deletes:', stats.deletes);
  console.log('  Tamanho (memória):', stats.memoryCacheSize);
  
  // Resetar estatísticas
  cache.resetStats();
  console.log('\nEstatísticas resetadas');
}

/**
 * Exemplo 6: Uso com Express middleware
 */
function cacheMiddleware(keyGenerator, ttl = 300) {
  return async (req, res, next) => {
    // Gerar chave baseada na requisição
    const key = typeof keyGenerator === 'function' 
      ? keyGenerator(req) 
      : `${req.method}:${req.originalUrl}`;
    
    // Tentar obter do cache
    const cached = await cache.get(key);
    if (cached) {
      console.log(`  ✅ Cache hit para ${key}`);
      return res.json(cached);
    }
    
    // Interceptar o response para cachear
    const originalJson = res.json;
    res.json = function(data) {
      // Cachear a resposta
      cache.set(key, data, ttl).catch(err => {
        console.error('Erro ao cachear resposta:', err);
      });
      
      // Enviar resposta normalmente
      originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Executar todos os exemplos
 */
async function executarExemplos() {
  console.log('🚀 Iniciando exemplos do Cache Service\n');
  
  // Aguardar inicialização do Redis se configurado
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await exemploSimples();
  await exemploGetOrSet();
  await exemploTenantCache();
  await exemplosPadroesCache();
  await exemploEstatisticas();
  
  console.log('\n✅ Exemplos concluídos!');
  console.log('\n--- Como usar o middleware no Express ---');
  console.log(`
// No seu arquivo de rotas:
const { cacheMiddleware } = require('./examples/cacheUsage');

// Cache automático para uma rota
router.get('/api/produtos', 
  cacheMiddleware(req => \`produtos:\${req.query.categoria || 'todos'}\`, 300),
  async (req, res) => {
    // Sua lógica aqui
    const produtos = await Produto.find({ categoria: req.query.categoria });
    res.json(produtos);
  }
);
  `);
  
  process.exit(0);
}

// Executar se chamado diretamente
if (require.main === module) {
  executarExemplos().catch(console.error);
}

// Exportar para uso em outros módulos
module.exports = {
  cacheMiddleware
};
