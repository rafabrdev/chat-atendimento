# Scripts de Configuração e Verificação

Este diretório contém scripts úteis para configurar e verificar os ambientes do projeto.

## 🔧 Scripts Disponíveis

### 1. `verifyConfig.js`
Script para verificar as configurações atuais de MongoDB Atlas e AWS S3.

**Como usar:**
```bash
cd backend
node scripts/verifyConfig.js
```

**O que ele verifica:**
- ✅ Ambiente atual (development/staging/production)
- ✅ Conexão com MongoDB Atlas
- ✅ Lista de collections e contagem de documentos
- ✅ Configuração e acesso ao bucket S3
- ✅ Lista arquivos no bucket (se houver)
- ✅ Modo de armazenamento (S3 ou Local)

### 2. `setupEnvironment.js`
Script interativo para configurar ambientes (dev, staging, prod).

**Como usar:**
```bash
cd backend
node scripts/setupEnvironment.js
```

**O que ele faz:**
- 🔹 Permite escolher o ambiente (development/staging/production)
- 🔹 Solicita credenciais do MongoDB Atlas
- 🔹 Solicita credenciais AWS S3 (para staging/production)
- 🔹 Gera JWT Secret automaticamente
- 🔹 Cria arquivo `.env` configurado
- 🔹 Testa a configuração automaticamente

## 📋 Configuração Rápida por Ambiente

### Development (Local)
```bash
# 1. Configure o ambiente
node scripts/setupEnvironment.js
# Escolha opção 1 (Development)

# 2. Verifique a configuração
node scripts/verifyConfig.js

# 3. Inicie o desenvolvimento
npm run dev
```

### Staging (AWS)
```bash
# 1. Configure o ambiente
node scripts/setupEnvironment.js
# Escolha opção 2 (Staging)

# 2. Verifique a configuração
node scripts/verifyConfig.js

# 3. Faça deploy via GitHub Actions
git push origin staging
```

### Production (AWS)
```bash
# 1. Configure o ambiente
node scripts/setupEnvironment.js
# Escolha opção 3 (Production)

# 2. Verifique a configuração
node scripts/verifyConfig.js

# 3. Faça deploy via CI/CD
git push origin main
```

## 🐳 Usando Docker com MongoDB Atlas

### Desenvolvimento com Atlas
```bash
# Certifique-se de ter o .env configurado
node scripts/setupEnvironment.js

# Use o docker-compose com Atlas
docker-compose -f docker-compose.atlas.yml up
```

### Desenvolvimento com MongoDB Local
```bash
# Use o docker-compose padrão
docker-compose up
```

## 🔐 Variáveis de Ambiente

### MongoDB Atlas
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database
```

### AWS S3 (Staging/Production)
```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1
USE_S3=true
```

### Desenvolvimento Local
```env
USE_S3=false
# Arquivos salvos em backend/uploads/
```

## 🚨 Troubleshooting

### Erro de conexão MongoDB
- Verifique se o IP está na whitelist do MongoDB Atlas
- Confirme usuário e senha
- Verifique o nome do cluster e database

### Erro de acesso S3
- Verifique as credenciais AWS
- Confirme se o bucket existe
- Verifique permissões IAM do usuário

### Script não encontra dependências
```bash
cd backend
npm install
```

## 📝 Notas Importantes

1. **Segurança**: Nunca commite arquivos `.env` com credenciais reais
2. **Backups**: Sempre faça backup antes de mudar ambientes
3. **Testes**: Sempre teste em staging antes de production
4. **Logs**: Use `verifyConfig.js` regularmente para monitorar o ambiente

## 🤝 Suporte

Em caso de dúvidas ou problemas:
1. Execute `verifyConfig.js` para diagnosticar
2. Verifique os logs do servidor
3. Confirme as variáveis de ambiente com `printenv | grep -E "MONGO|AWS|S3"`
