# 🚀 GUIA DE CONFIGURAÇÃO COMPLETO - CHAT ATENDIMENTO

## ✅ STATUS DAS ETAPAS

- [x] Branches organizadas (develop, staging, main)
- [ ] MongoDB Atlas configurado
- [ ] Secrets do GitHub configurados
- [ ] Primeiro deploy para staging
- [ ] Primeiro deploy para produção

---

## 📋 ETAPA 1: MONGODB ATLAS (Manual no Browser)

### 1.1 Acessar MongoDB Atlas
1. Acesse: https://cloud.mongodb.com
2. Faça login com sua conta

### 1.2 Configurar Databases
No seu cluster atual:

1. **Renomear database atual para produção:**
   - Clique em "Browse Collections"
   - Se tiver um database `chat-atendimento`, renomeie para `chat-atendimento-prod`
   - Ou crie um novo: `chat-atendimento-prod`

2. **Criar database para desenvolvimento:**
   - Clique em "Create Database"
   - Nome: `chat-atendimento-dev`
   - Collection inicial: `_init` (será deletada depois)

### 1.3 Verificar/Criar Usuário
1. Vá em "Database Access" no menu lateral
2. Se não tiver usuário, clique "Add New Database User"
3. Anote:
   - Username: `seu_usuario`
   - Password: `sua_senha`

### 1.4 Obter Connection String
1. Vá em "Database" → "Connect" → "Connect your application"
2. Copie a string de conexão (será algo como):
   ```
   mongodb+srv://[USERNAME]:[PASSWORD]@cluster0.xxxxx.mongodb.net/
   ```

### 1.5 Configurar Network Access
1. Vá em "Network Access"
2. Adicione IP: `0.0.0.0/0` (permite acesso de qualquer lugar)
   - Ou adicione IPs específicos dos servidores AWS

---

## 📋 ETAPA 2: EXECUTAR SCRIPT DE CONFIGURAÇÃO

Após configurar o MongoDB Atlas, execute no terminal:

```bash
cd backend
node scripts/setupMongoDB.js
```

### Informações que o script pedirá:
1. **MongoDB Atlas Username**: (do passo 1.3)
2. **MongoDB Atlas Password**: (do passo 1.3)
3. **MongoDB Cluster**: Ex: `cluster0.xxxxx` (da connection string)
4. **AWS S3**: Responda 'n' por enquanto (configuraremos depois)
5. **JWT Secret**: Pressione Enter (gera automaticamente)
6. **CORS Origins**: 
   - Development: `http://localhost:3000`
   - Staging: Deixe vazio por enquanto
   - Production: Deixe vazio por enquanto

---

## 📋 ETAPA 3: CONFIGURAR SECRETS NO GITHUB

### 3.1 Acessar Settings do Repositório
1. Vá em: https://github.com/rafabrdev/chat-atendimento
2. Settings → Secrets and variables → Actions
3. Clique em "New repository secret"

### 3.2 Secrets Necessários (Adicione um por um):

#### MongoDB (OBRIGATÓRIOS):
```
MONGODB_URI_DEV
Valor: mongodb+srv://[USERNAME]:[PASSWORD]@cluster.mongodb.net/chat-atendimento-dev?retryWrites=true&w=majority

MONGODB_URI_STAGING  
Valor: mongodb+srv://[USERNAME]:[PASSWORD]@cluster.mongodb.net/chat-atendimento-dev?retryWrites=true&w=majority

MONGODB_URI_PROD
Valor: mongodb+srv://[USERNAME]:[PASSWORD]@cluster.mongodb.net/chat-atendimento-prod?retryWrites=true&w=majority
```

#### JWT (OBRIGATÓRIO):
```
JWT_SECRET
Valor: (copie do arquivo .env.development gerado)
```

#### URLs da API:
```
API_URL_DEV
Valor: http://localhost:3001

API_URL_STAGING
Valor: http://staging.seudominio.com (ou IP do EC2)

API_URL_PROD
Valor: https://api.seudominio.com (ou IP do EC2)
```

#### AWS (OPCIONAL - Adicione quando tiver):
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET_STAGING
S3_BUCKET_PROD
```

#### EC2 (OPCIONAL - Adicione quando tiver):
```
EC2_HOST_STAGING
EC2_HOST_PROD
EC2_USER
EC2_SSH_KEY_STAGING
EC2_SSH_KEY_PROD
PRODUCTION_DOMAIN
```

---

## 📋 ETAPA 4: TESTAR CONFIGURAÇÃO LOCAL

### 4.1 Verificar Configuração
```bash
cd backend
node scripts/verifyConfig.js
```

### 4.2 Iniciar Desenvolvimento Local
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

---

## 📋 ETAPA 5: PRIMEIRO COMMIT E TESTE

### 5.1 Commit das Configurações
```bash
git add .
git commit -m "feat: complete environment setup with MongoDB Atlas"
git push origin develop
```

### 5.2 Verificar GitHub Actions
1. Vá em: https://github.com/rafabrdev/chat-atendimento/actions
2. Verifique se o workflow "Deploy Development" executou
3. Deve mostrar sucesso (mesmo sem fazer deploy real)

---

## 📋 ETAPA 6: PROMOVER PARA STAGING (Teste)

### 6.1 Promover Código
```bash
# No PowerShell, use:
cd ..
bash scripts/git-flow.sh promote-staging

# Ou manualmente:
git checkout staging
git merge develop
git push origin staging
```

### 6.2 Verificar GitHub Actions
- O workflow "Deploy Staging" será executado
- Como não temos EC2 configurado ainda, falhará no deploy mas é normal

---

## 📋 ETAPA 7: CONFIGURAÇÃO AWS (Quando tiver)

### 7.1 Criar Conta AWS
1. Acesse: https://aws.amazon.com
2. Crie conta (precisa cartão de crédito)

### 7.2 Criar Usuário IAM
1. IAM → Users → Create User
2. Attach policies:
   - AmazonS3FullAccess
   - AmazonEC2FullAccess
   - AmazonECRFullAccess (para Docker)

### 7.3 Criar Instâncias EC2
1. EC2 → Launch Instance
2. Escolha Ubuntu Server 22.04
3. t2.micro (free tier)
4. Crie 2 instâncias: staging e production

### 7.4 Configurar S3 Buckets
1. S3 → Create Bucket
2. Nomes:
   - chat-atendimento-staging
   - chat-atendimento-prod

---

## 📋 PRÓXIMOS PASSOS

1. ✅ Configure MongoDB Atlas (Manual)
2. ✅ Execute `node scripts/setupMongoDB.js`
3. ✅ Configure Secrets no GitHub
4. ✅ Teste localmente
5. ⏳ Configure AWS (quando tiver conta)
6. ⏳ Deploy para staging
7. ⏳ Deploy para produção

---

## 🆘 COMANDOS ÚTEIS

```bash
# Verificar configuração
node scripts/verifyConfig.js

# Mudar entre ambientes
npm run dev         # Development
npm run staging     # Staging
npm run prod        # Production

# Git Flow
bash scripts/git-flow.sh status            # Ver status
bash scripts/git-flow.sh promote-staging   # develop → staging
bash scripts/git-flow.sh promote-production # staging → main
```

---

## ⚠️ IMPORTANTE

- **MongoDB Atlas Free Tier**: 512MB storage, 1 cluster gratuito
- **AWS Free Tier**: 12 meses com limites (EC2 t2.micro, S3 5GB)
- **Sempre teste em staging antes de produção!**

---

## 📞 SUPORTE

Se tiver dúvidas em qualquer etapa, os scripts têm mensagens de ajuda:
- `node scripts/setupMongoDB.js` - Configura tudo interativamente
- `node scripts/verifyConfig.js` - Mostra o que está configurado
- `bash scripts/git-flow.sh help` - Mostra comandos disponíveis
