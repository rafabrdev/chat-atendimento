const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testTenantResolution() {
  console.log('🧪 Testando Resolução de Tenant\n');
  
  const tests = [
    {
      name: 'Via header X-Tenant-Key',
      config: {
        headers: { 'X-Tenant-Key': 'default' }
      }
    },
    {
      name: 'Via query parameter',
      url: '/api/agents?tenant=default',
      config: {}
    },
    {
      name: 'Sem tenant (deve usar fallback)',
      config: {}
    }
  ];
  
  for (const test of tests) {
    console.log(`\n📍 Teste: ${test.name}`);
    console.log('================================');
    
    try {
      const url = test.url || '/api/agents';
      const response = await axios.get(`${BASE_URL}${url}`, test.config);
      
      // Verificar headers de resposta (se o servidor retornar info do tenant)
      console.log('✅ Status:', response.status);
      
      // Alguns endpoints podem retornar informação do tenant usado
      if (response.data.tenant) {
        console.log('📊 Tenant resolvido:', response.data.tenant);
      }
      
      if (response.data.resolvedBy) {
        console.log('🔍 Resolvido via:', response.data.resolvedBy);
      }
      
    } catch (error) {
      if (error.response) {
        console.log('❌ Erro:', error.response.status, '-', error.response.data.error || error.response.data.message);
        
        // Se for erro de tenant, mostrar detalhes
        if (error.response.data.help) {
          console.log('💡 Ajuda:', error.response.data.help);
        }
        
        if (error.response.data.debug) {
          console.log('🐛 Debug:', JSON.stringify(error.response.data.debug, null, 2));
        }
      } else {
        console.log('❌ Erro de conexão:', error.message);
      }
    }
  }
  
  console.log('\n\n🧪 Testando endpoint direto de tenants');
  console.log('================================');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/tenants/default`);
    console.log('✅ Tenant encontrado:');
    console.log('   - Key:', response.data.data.key);
    console.log('   - Name:', response.data.data.name);
    console.log('   - Plan:', response.data.data.plan);
    console.log('   - Status:', response.data.data.status);
  } catch (error) {
    console.log('❌ Erro ao buscar tenant:', error.response?.data || error.message);
  }
}

// Executar testes
testTenantResolution().catch(console.error);
