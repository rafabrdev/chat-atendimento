/**
 * Script de Verificação de Integridade do TenantId
 * 
 * Este script verifica se todos os documentos nas coleções têm um tenantId válido
 * e reporta quaisquer inconsistências encontradas.
 * 
 * Uso: node scripts/verifyTenantIntegrity.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Importar modelos
const User = require('../models/User');
const Agent = require('../models/Agent');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const File = require('../models/File');
const QueueEntry = require('../models/QueueEntry');
const Invitation = require('../models/Invitation');
const Tenant = require('../models/Tenant');

// Função auxiliar para formatar números
const formatNumber = (num) => {
  return new Intl.NumberFormat('pt-BR').format(num);
};

// Função para verificar uma coleção
async function verifyCollection(Model, modelName) {
  console.log(`\n📊 Verificando ${modelName}...`);
  
  try {
    // Contagem total de documentos
    const totalCount = await Model.countDocuments();
    console.log(`   Total de documentos: ${formatNumber(totalCount)}`);
    
    if (totalCount === 0) {
      console.log(`   ✅ Coleção vazia`);
      return {
        model: modelName,
        total: 0,
        withTenant: 0,
        withoutTenant: 0,
        invalidTenant: 0,
        isValid: true,  // Coleção vazia é válida
        errors: []
      };
    }
    
    // Documentos com tenantId
    const withTenantCount = await Model.countDocuments({ 
      tenantId: { $exists: true, $ne: null } 
    });
    
    // Documentos sem tenantId
    const withoutTenantCount = await Model.countDocuments({ 
      $or: [
        { tenantId: { $exists: false } },
        { tenantId: null }
      ]
    });
    
    console.log(`   Com tenantId: ${formatNumber(withTenantCount)}`);
    console.log(`   Sem tenantId: ${formatNumber(withoutTenantCount)}`);
    
    // Verificar validade dos tenantIds
    let invalidTenantCount = 0;
    const invalidTenantDocs = [];
    
    if (withTenantCount > 0) {
      // Obter todos os tenantIds válidos
      const validTenants = await Tenant.find({}, '_id');
      const validTenantIds = validTenants.map(t => t._id.toString());
      
      // Buscar documentos com tenantId
      const docsWithTenant = await Model.find(
        { tenantId: { $exists: true, $ne: null } },
        'tenantId'
      ).limit(10000); // Limitar para não sobrecarregar a memória
      
      for (const doc of docsWithTenant) {
        if (!validTenantIds.includes(doc.tenantId.toString())) {
          invalidTenantCount++;
          if (invalidTenantDocs.length < 5) { // Mostrar apenas os primeiros 5
            invalidTenantDocs.push({
              _id: doc._id,
              tenantId: doc.tenantId
            });
          }
        }
      }
      
      if (invalidTenantCount > 0) {
        console.log(`   ⚠️  Com tenantId inválido: ${formatNumber(invalidTenantCount)}`);
        console.log(`   Exemplos de documentos com tenantId inválido:`);
        invalidTenantDocs.forEach(doc => {
          console.log(`     - ID: ${doc._id}, TenantId: ${doc.tenantId}`);
        });
      }
    }
    
    // Casos especiais
    if (modelName === 'User') {
      const masterCount = await Model.countDocuments({ role: 'master' });
      console.log(`   Usuários master (não precisam de tenant): ${formatNumber(masterCount)}`);
      
      // Ajustar contagem de "sem tenant" removendo masters
      const nonMasterWithoutTenant = await Model.countDocuments({
        role: { $ne: 'master' },
        $or: [
          { tenantId: { $exists: false } },
          { tenantId: null }
        ]
      });
      
      if (nonMasterWithoutTenant > 0) {
        console.log(`   ❌ Usuários não-master sem tenant: ${formatNumber(nonMasterWithoutTenant)}`);
        
        // Mostrar exemplos
        const examples = await Model.find({
          role: { $ne: 'master' },
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null }
          ]
        }, 'email role').limit(5);
        
        if (examples.length > 0) {
          console.log(`   Exemplos de usuários sem tenant:`);
          examples.forEach(user => {
            console.log(`     - Email: ${user.email}, Role: ${user.role}`);
          });
        }
      }
    }
    
    // Status da verificação
    const isValid = (withoutTenantCount === 0 || 
                    (modelName === 'User' && withoutTenantCount <= await Model.countDocuments({ role: 'master' }))) 
                    && invalidTenantCount === 0;
    
    if (isValid) {
      console.log(`   ✅ Todos os documentos têm tenantId válido`);
    } else {
      console.log(`   ❌ Problemas encontrados`);
    }
    
    return {
      model: modelName,
      total: totalCount,
      withTenant: withTenantCount,
      withoutTenant: withoutTenantCount,
      invalidTenant: invalidTenantCount,
      isValid
    };
    
  } catch (error) {
    console.error(`   ❌ Erro ao verificar ${modelName}:`, error.message);
    return {
      model: modelName,
      error: error.message
    };
  }
}

// Função principal
async function main() {
  console.log('🔍 Iniciando verificação de integridade do Multi-Tenant');
  console.log('=========================================================\n');
  
  try {
    // Conectar ao MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot';
    console.log(`📡 Conectando ao MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`✅ Conectado ao MongoDB\n`);
    
    // Verificar total de tenants
    const tenantCount = await Tenant.countDocuments();
    console.log(`🏢 Total de Tenants cadastrados: ${formatNumber(tenantCount)}`);
    
    if (tenantCount === 0) {
      console.log('⚠️  Nenhum tenant encontrado. É necessário criar pelo menos um tenant.');
    } else {
      const tenants = await Tenant.find({}, 'companyName slug').limit(5);
      console.log('   Primeiros tenants:');
      tenants.forEach(t => {
        console.log(`     - ${t.companyName} (${t.slug})`);
      });
    }
    
    // Lista de modelos para verificar
    const models = [
      { Model: User, name: 'User' },
      { Model: Agent, name: 'Agent' },
      { Model: Contact, name: 'Contact' },
      { Model: Conversation, name: 'Conversation' },
      { Model: Message, name: 'Message' },
      { Model: File, name: 'File' },
      { Model: QueueEntry, name: 'QueueEntry' },
      { Model: Invitation, name: 'Invitation' }
    ];
    
    // Verificar cada modelo
    const results = [];
    for (const { Model, name } of models) {
      const result = await verifyCollection(Model, name);
      results.push(result);
    }
    
    // Resumo final
    console.log('\n=========================================================');
    console.log('📈 RESUMO DA VERIFICAÇÃO');
    console.log('=========================================================\n');
    
    const validModels = results.filter(r => r.isValid);
    const invalidModels = results.filter(r => !r.isValid && !r.error);
    const errorModels = results.filter(r => r.error);
    
    console.log(`✅ Modelos válidos: ${validModels.length}/${models.length}`);
    if (validModels.length > 0) {
      validModels.forEach(m => console.log(`   - ${m.model}`));
    }
    
    if (invalidModels.length > 0) {
      console.log(`\n❌ Modelos com problemas: ${invalidModels.length}`);
      invalidModels.forEach(m => {
        console.log(`   - ${m.model}:`);
        if (m.withoutTenant > 0) {
          console.log(`     • ${formatNumber(m.withoutTenant)} documentos sem tenantId`);
        }
        if (m.invalidTenant > 0) {
          console.log(`     • ${formatNumber(m.invalidTenant)} documentos com tenantId inválido`);
        }
      });
    }
    
    if (errorModels.length > 0) {
      console.log(`\n⚠️  Modelos com erro: ${errorModels.length}`);
      errorModels.forEach(m => {
        console.log(`   - ${m.model}: ${m.error}`);
      });
    }
    
    // Salvar relatório em arquivo
    const reportPath = path.join(__dirname, `tenant-integrity-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Relatório salvo em: ${reportPath}`);
    
    // Recomendações
    if (invalidModels.length > 0 || errorModels.length > 0) {
      console.log('\n📝 RECOMENDAÇÕES:');
      console.log('   1. Execute o script de migração para adicionar tenantId aos documentos existentes');
      console.log('   2. Verifique se o plugin tenantScopePlugin está aplicado em todos os modelos');
      console.log('   3. Certifique-se de que o middleware mongooseTenantMiddleware está ativo');
      console.log('   4. Para documentos com tenantId inválido, verifique se o tenant foi deletado');
    } else {
      console.log('\n🎉 Parabéns! Todos os modelos estão com integridade de tenant válida!');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a verificação:', error);
    process.exit(1);
  } finally {
    // Desconectar do MongoDB
    await mongoose.disconnect();
    console.log('\n👋 Desconectado do MongoDB');
  }
}

// Executar script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { verifyCollection, main };
