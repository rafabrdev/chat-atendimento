/**
 * Script principal para executar todos os seeds e migrações em ordem
 * Execute este script para configurar o ambiente multi-tenant
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const seedDefaultTenant = require('./001-tenant-default');
const migrateExistingData = require('./002-migrate-existing-data');

async function runAllSeeds() {
  console.log('🚀 INICIANDO CONFIGURAÇÃO MULTI-TENANT');
  console.log('='.repeat(60));
  console.log('Este script irá:');
  console.log('1. Criar ou atualizar o tenant "default"');
  console.log('2. Migrar todos os dados existentes para o tenant default');
  console.log('3. Criar índices otimizados para multi-tenancy');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Etapa 1: Criar/Atualizar tenant default
    console.log('\n📝 ETAPA 1: Configurando Tenant Default');
    console.log('-'.repeat(40));
    await seedDefaultTenant();
    
    // Aguardar um momento para garantir que o banco processou
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Etapa 2: Migrar dados existentes
    console.log('\n📝 ETAPA 2: Migrando Dados Existentes');
    console.log('-'.repeat(40));
    await migrateExistingData();
    
    console.log('\n');
    console.log('='.repeat(60));
    console.log('🎉 CONFIGURAÇÃO MULTI-TENANT CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\nPróximos passos:');
    console.log('1. Reinicie o servidor para aplicar as mudanças');
    console.log('2. Teste o acesso com o tenant default');
    console.log('3. Configure os middlewares de tenant (Item 2 do guia)');
    console.log('4. Aplique o plugin Mongoose para escopo de tenant (Item 3 do guia)');
    
  } catch (error) {
    console.error('\n❌ ERRO DURANTE A CONFIGURAÇÃO:', error);
    console.error('\nPor favor, verifique:');
    console.error('1. Se o MongoDB está rodando');
    console.error('2. Se as variáveis de ambiente estão configuradas');
    console.error('3. Se você tem permissões adequadas no banco');
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  runAllSeeds();
}

module.exports = runAllSeeds;
