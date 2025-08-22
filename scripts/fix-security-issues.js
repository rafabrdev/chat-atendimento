#!/usr/bin/env node

/**
 * Script para corrigir problemas de segurança
 * Remove credenciais expostas e cria arquivos .example
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Iniciando correção de segurança...\n');

// Lista de arquivos com credenciais expostas
const filesWithSecrets = [
  'backend/scripts/README.md',
  'config/environments.js',
  'DEV_COMMANDS.md',
  'backend/.env.production',
  'backend/.env.staging',
  'backend/.env.development',
  'AWS_SETUP_STEP_BY_STEP.md',
  'DOCUMENTACAO_COMPLETA.md',
  'PROJECT_COMPLETE_STATUS.md',
  'SETUP_GUIDE.md',
  'DEPLOYMENT.md',
  'PROCEDIMENTO_TESTE_WORKFLOW.md'
];

// Padrões para substituir
const secretPatterns = [
  {
    pattern: /mongodb\+srv:\/\/chatadmin:pMwrRrCbus50k7DR@/gi,
    replacement: 'mongodb+srv://[USERNAME]:[PASSWORD]@'
  },
  {
    pattern: /mongodb\+srv:\/\/[^:]+:[^@]+@/gi,
    replacement: 'mongodb+srv://[USERNAME]:[PASSWORD]@'
  },
  {
    pattern: /pMwrRrCbus50k7DR/g,
    replacement: '[MONGODB_PASSWORD]'
  },
  {
    pattern: /chatadmin/g,
    replacement: '[MONGODB_USER]'
  },
  {
    pattern: /xK9@mP2\$vN7#qR4&wY6\*bT8!sF3\^jL5/g,
    replacement: '[JWT_SECRET_HASH]'
  },
  {
    pattern: /chat-atendimento-uploads-726/g,
    replacement: '[S3_BUCKET_NAME]'
  }
];

// Processar cada arquivo
filesWithSecrets.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (fs.existsSync(filePath)) {
    console.log(`📝 Processando: ${file}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Aplicar substituições
    secretPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });
    
    if (modified) {
      // Salvar arquivo corrigido
      fs.writeFileSync(filePath, content);
      console.log(`  ✅ Credenciais removidas de ${file}`);
      
      // Criar arquivo .example se for .env
      if (file.includes('.env')) {
        const examplePath = filePath.replace('.env', '.env.example');
        fs.writeFileSync(examplePath, content);
        console.log(`  ✅ Criado ${path.basename(examplePath)}`);
      }
    } else {
      console.log(`  ℹ️ Nenhuma credencial encontrada em ${file}`);
    }
  } else {
    console.log(`  ⚠️ Arquivo não encontrado: ${file}`);
  }
});

console.log('\n✨ Correção de segurança concluída!');
console.log('\n📋 Próximos passos:');
console.log('1. Revise as mudanças com: git diff');
console.log('2. Commit as correções: git add . && git commit -m "fix: remove exposed credentials"');
console.log('3. Push para o repositório: git push origin develop');
