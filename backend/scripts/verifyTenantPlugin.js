const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../models');
const models = [
  'Agent.js',
  'Contact.js', 
  'Conversation.js',
  'File.js',
  'Invitation.js',
  'Message.js',
  'QueueEntry.js',
  'User.js'
];

console.log('🔍 Verificando aplicação do tenantScopePlugin nos modelos\n');
console.log('=' .repeat(60));

let allGood = true;

models.forEach(modelFile => {
  const filePath = path.join(modelsDir, modelFile);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const modelName = modelFile.replace('.js', '');
  
  // Verificar se importa o plugin
  const hasImport = content.includes('tenantScopePlugin') || content.includes('tenantScope');
  
  // Verificar se aplica o plugin
  const hasPluginApplication = content.includes('.plugin(tenantScopePlugin') || 
                               content.includes('.plugin(tenantScope');
  
  // Verificar se tem campo tenantId definido manualmente
  const hasTenantIdField = content.includes('tenantId:') || content.includes('tenantId :');
  
  if (hasImport && hasPluginApplication) {
    console.log(`✅ ${modelName}: Plugin aplicado corretamente`);
  } else if (!hasImport) {
    console.log(`❌ ${modelName}: Falta importar o plugin`);
    allGood = false;
  } else if (!hasPluginApplication) {
    console.log(`⚠️  ${modelName}: Plugin importado mas não aplicado ao schema`);
    allGood = false;
  }
  
  if (hasTenantIdField && hasPluginApplication) {
    console.log(`   ⚠️  Atenção: Define tenantId manualmente E usa plugin (possível duplicação)`);
  }
});

console.log('\n' + '=' .repeat(60));

if (allGood) {
  console.log('✅ Todos os modelos estão com o plugin aplicado corretamente!');
} else {
  console.log('❌ Alguns modelos precisam de ajustes no plugin');
  console.log('\n📝 Para aplicar o plugin em um modelo:');
  console.log('1. Importar: const { tenantScopePlugin } = require("../plugins/tenantScopePlugin");');
  console.log('2. Aplicar: schema.plugin(tenantScopePlugin);');
}

// Verificar também se o middleware está sendo usado
console.log('\n🔍 Verificando uso do middleware mongooseTenantMiddleware...');

const serverPath = path.join(__dirname, '../server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

if (serverContent.includes('mongooseTenantMiddleware')) {
  console.log('✅ Middleware mongooseTenantMiddleware está configurado no server.js');
} else {
  console.log('⚠️  Middleware mongooseTenantMiddleware não está configurado no server.js');
  console.log('   Adicione após o middleware de tenant:');
  console.log('   const { mongooseTenantMiddleware } = require("./plugins/tenantScopePlugin");');
  console.log('   app.use(mongooseTenantMiddleware);');
}
