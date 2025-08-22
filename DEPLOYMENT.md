# 🚀 Guia de Deploy e Fluxo de Desenvolvimento

## 📋 Visão Geral

Este projeto utiliza um fluxo Git Flow adaptado com 3 branches principais e deploy automático via GitHub Actions.

### 🌿 Branches Principais

| Branch | Ambiente | Database MongoDB | Bucket S3 | Deploy |
|--------|----------|------------------|-----------|--------|
| **develop** | Development | chat-atendimento-dev | Local | Manual (local) |
| **staging** | Staging | chat-atendimento-dev | chat-atendimento-staging | Automático (AWS EC2) |
| **main** | Production | chat-atendimento-prod | chat-atendimento-prod | Automático (AWS EC2) |

### 🔄 Fluxo de Desenvolvimento

```
feature/* → develop → staging → main
             ↓         ↓         ↓
           Local     Teste    Produção
```

## 🛠️ Configuração Inicial

### 1. Configurar MongoDB Atlas e Ambientes

Execute o script de configuração:

```bash
cd backend
node scripts/setupMongoDB.js
```

Este script irá:
- ✅ Configurar 2 databases no MongoDB Atlas (dev/staging compartilhado + produção)
- ✅ Criar arquivos `.env.development`, `.env.staging`, `.env.production`
- ✅ Configurar AWS S3 para cada ambiente
- ✅ Testar conexões

### 2. Criar Branches no Git

```bash
# Criar branch develop
git checkout -b develop
git push -u origin develop

# Criar branch staging
git checkout -b staging
git push -u origin staging

# Main já deve existir
```

### 3. Configurar Secrets no GitHub

Acesse: **Settings → Secrets and variables → Actions**

#### Secrets Necessários:

**MongoDB:**
- `MONGODB_URI_DEV`: URI do MongoDB Atlas para dev/staging
- `MONGODB_URI_STAGING`: URI do MongoDB Atlas para staging (mesmo que DEV)
- `MONGODB_URI_PROD`: URI do MongoDB Atlas para produção

**AWS:**
- `AWS_ACCESS_KEY_ID`: Access Key da AWS
- `AWS_SECRET_ACCESS_KEY`: Secret Key da AWS
- `S3_BUCKET_STAGING`: Nome do bucket S3 para staging
- `S3_BUCKET_PROD`: Nome do bucket S3 para produção

**EC2:**
- `EC2_HOST_STAGING`: IP ou domínio do servidor staging
- `EC2_HOST_PROD`: IP ou domínio do servidor produção
- `EC2_USER`: Usuário SSH (geralmente `ubuntu` ou `ec2-user`)
- `EC2_SSH_KEY_STAGING`: Chave SSH privada para staging
- `EC2_SSH_KEY_PROD`: Chave SSH privada para produção

**Aplicação:**
- `JWT_SECRET`: Secret para JWT
- `API_URL_DEV`: URL da API development (http://localhost:3001)
- `API_URL_STAGING`: URL da API staging
- `API_URL_PROD`: URL da API produção
- `PRODUCTION_DOMAIN`: Domínio de produção

**Opcional (CloudFront):**
- `CLOUDFRONT_DISTRIBUTION_ID`: ID da distribuição CloudFront

## 💻 Desenvolvimento Local

### Iniciar Ambiente Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm start
```

### Usar Docker com MongoDB Atlas

```bash
docker-compose -f docker-compose.atlas.yml up
```

## 🌟 Fluxo de Trabalho

### 1. Desenvolver Nova Feature

```bash
# Criar nova feature
./scripts/git-flow.sh new-feature

# Desenvolver...
git add .
git commit -m "feat: nova funcionalidade"

# Finalizar feature
./scripts/git-flow.sh finish-feature
```

### 2. Promover para Staging

```bash
# Promover develop → staging
./scripts/git-flow.sh promote-staging
```

✅ GitHub Actions fará deploy automático para staging

### 3. Promover para Produção

```bash
# Após testar em staging
./scripts/git-flow.sh promote-production
```

✅ GitHub Actions fará deploy automático para produção

### 4. Hotfix de Emergência

```bash
# Criar hotfix
./scripts/git-flow.sh hotfix

# Corrigir bug...
git add .
git commit -m "fix: correção crítica"

# Aplicar hotfix
./scripts/git-flow.sh finish-hotfix
```

## 📦 Deploy Automático

### GitHub Actions Workflows

| Workflow | Trigger | Ação |
|----------|---------|------|
| `deploy-develop.yml` | Push para `develop` | Testes e build |
| `deploy-staging.yml` | Push para `staging` | Deploy para EC2 staging |
| `deploy-production.yml` | Push para `main` | Deploy para EC2 produção com rollback |

### Processo de Deploy

1. **Develop** (Local):
   - Executa testes
   - Build do projeto
   - Não faz deploy (desenvolvimento local)

2. **Staging** (AWS EC2):
   - Executa testes
   - Build do projeto
   - Deploy via SSH para EC2
   - Cria bucket S3 se necessário
   - Health check

3. **Production** (AWS EC2):
   - Executa testes
   - Build otimizado
   - Push para ECR (Docker Registry)
   - Deploy com zero-downtime
   - Backup automático
   - Rollback em caso de falha
   - Cria release no GitHub

## 🔍 Verificação e Monitoramento

### Verificar Configuração Atual

```bash
cd backend
node scripts/verifyConfig.js
```

### Verificar Status das Branches

```bash
./scripts/git-flow.sh status
```

### Logs dos Deploys

- GitHub Actions: **Actions** tab no repositório
- EC2 Staging: SSH para servidor e `docker logs`
- EC2 Production: CloudWatch Logs (se configurado)

## 🚨 Troubleshooting

### Problema: Deploy falhou no GitHub Actions

**Solução:**
1. Verificar logs no GitHub Actions
2. Confirmar secrets estão configurados
3. Testar conexão SSH manualmente

### Problema: MongoDB não conecta

**Solução:**
1. Verificar IP na whitelist do MongoDB Atlas
2. Confirmar credenciais no `.env`
3. Executar `node scripts/verifyConfig.js`

### Problema: S3 não está salvando arquivos

**Solução:**
1. Verificar permissões IAM do usuário AWS
2. Confirmar bucket existe e está acessível
3. Verificar variável `USE_S3` no ambiente

### Rollback Manual (Produção)

```bash
# SSH para servidor
ssh user@production-server

# Listar backups
ls -la ~/chat-atendimento-backup-*

# Restaurar backup
cd ~
rm -rf chat-atendimento
mv chat-atendimento-backup-20240101-120000 chat-atendimento
cd chat-atendimento
docker-compose -f docker-compose.production.yml up -d
```

## 📊 Estrutura de Ambientes

```
┌─────────────────────────────────────────────────────┐
│                    PRODUCTION                        │
│  Branch: main                                        │
│  Database: chat-atendimento-prod                     │
│  S3: chat-atendimento-prod                          │
│  Deploy: Automático com rollback                     │
└─────────────────────────────────────────────────────┘
                          ↑
                    Promote após QA
                          ↑
┌─────────────────────────────────────────────────────┐
│                     STAGING                          │
│  Branch: staging                                     │
│  Database: chat-atendimento-dev (compartilhado)      │
│  S3: chat-atendimento-staging                        │
│  Deploy: Automático para teste                       │
└─────────────────────────────────────────────────────┘
                          ↑
                    Promote para teste
                          ↑
┌─────────────────────────────────────────────────────┐
│                   DEVELOPMENT                        │
│  Branch: develop                                     │
│  Database: chat-atendimento-dev                      │
│  S3: Local (pasta uploads/)                          │
│  Deploy: Manual (local)                              │
└─────────────────────────────────────────────────────┘
                          ↑
                    Merge features
                          ↑
┌─────────────────────────────────────────────────────┐
│                  FEATURE BRANCHES                    │
│  Branch: feature/*                                   │
│  Criadas a partir de develop                         │
└─────────────────────────────────────────────────────┘
```

## 🔐 Segurança

### Boas Práticas

1. **Nunca commitar `.env` files**
2. **Usar secrets do GitHub para credenciais**
3. **Habilitar 2FA no GitHub e AWS**
4. **Rotacionar chaves regularmente**
5. **Fazer backup antes de deploy em produção**
6. **Testar sempre em staging primeiro**

### Checklist Pre-Deploy Produção

- [ ] Testes passando em staging
- [ ] QA aprovado funcionalidades
- [ ] Backup do database realizado
- [ ] Horário de menor tráfego escolhido
- [ ] Equipe notificada sobre deploy
- [ ] Plano de rollback preparado

## 📝 Scripts Úteis

### Backend

```bash
npm run dev          # Development com nodemon
npm run staging      # Staging mode
npm run prod         # Production mode
npm run dev:env      # Development com .env.development
npm run staging:env  # Staging com .env.staging
npm run prod:env     # Production com .env.production
```

### Git Flow

```bash
./scripts/git-flow.sh new-feature        # Nova feature
./scripts/git-flow.sh finish-feature     # Finalizar feature
./scripts/git-flow.sh promote-staging    # develop → staging
./scripts/git-flow.sh promote-production # staging → main
./scripts/git-flow.sh hotfix            # Criar hotfix
./scripts/git-flow.sh status            # Ver status
```

### Verificação

```bash
node scripts/setupMongoDB.js    # Configurar ambientes
node scripts/verifyConfig.js    # Verificar configuração
node scripts/setupEnvironment.js # Setup interativo
```

## 🎯 Resumo do Fluxo

1. **Desenvolver** em `feature/*` branches
2. **Merge** para `develop` (local)
3. **Promover** para `staging` (teste)
4. **Validar** em staging
5. **Promover** para `main` (produção)
6. **Monitorar** deploy automático

---

💡 **Dica:** Use o script `git-flow.sh` para automatizar o fluxo e evitar erros!

📚 **Documentação adicional:** Ver `/backend/scripts/README.md` para mais detalhes sobre scripts.
