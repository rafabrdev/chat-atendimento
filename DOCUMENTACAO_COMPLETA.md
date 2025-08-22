# 📚 DOCUMENTAÇÃO COMPLETA - CHAT ATENDIMENTO BR SISTEMAS
*Última atualização: 22/01/2025 15:15*

## 🎯 VISÃO GERAL DO PROJETO

Sistema completo de chat para atendimento ao cliente com múltiplos atendentes, fila de espera, dashboard administrativo e comunicação em tempo real via WebSockets.

### Status Atual do Projeto
- ✅ Código base desenvolvido
- ✅ MongoDB Atlas configurado (2 databases)
- ✅ Branches organizadas (main, develop, staging)
- ✅ Alguns secrets do GitHub configurados
- ⚠️ Secrets críticos faltando
- ⚠️ EC2 precisa de verificação de IPs
- ⚠️ Domínio Hostinger aguardando configuração
- ❌ Deploy automático não testado completamente

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. SECRETS FALTANDO NO GITHUB
Os seguintes secrets precisam ser adicionados URGENTEMENTE:

| Secret Name | Valor Sugerido | Prioridade |
|------------|----------------|------------|
| `EC2_USER` | `ec2-user` ou `ubuntu` | 🔴 CRÍTICA |
| `EC2_HOST_STAGING` | `52.90.17.204` | 🔴 CRÍTICA |
| `EC2_HOST_PROD` | `52.90.17.204` | 🔴 CRÍTICA |
| `EC2_SSH_KEY_STAGING` | (mesma de EC2_SSH_KEY) | 🔴 CRÍTICA |
| `EC2_SSH_KEY_PROD` | (mesma de EC2_SSH_KEY) | 🔴 CRÍTICA |
| `S3_BUCKET_STAGING` | `[S3_BUCKET_NAME]` | 🟡 ALTA |
| `S3_BUCKET_PROD` | `[S3_BUCKET_NAME]` | 🟡 ALTA |
| `API_URL_DEV` | `http://localhost:3001` | 🟡 ALTA |
| `API_URL_STAGING` | `http://52.90.17.204:3001` | 🟡 ALTA |
| `API_URL_PROD` | `https://suporte.brsi.net.br/api` | 🟡 ALTA |
| `PRODUCTION_DOMAIN` | `suporte.brsi.net.br` | 🟡 ALTA |
| `STAGING_EC2_HOST` | `52.90.17.204` | 🟢 MÉDIA |
| `CLOUDFRONT_DISTRIBUTION_ID` | (opcional) | 🟢 BAIXA |

### 2. CONFIGURAÇÕES CONFLITANTES

#### Problema com IPs EC2:
- **README.md** mostra: `52.90.17.204`
- **Workflows** esperam variáveis: `EC2_HOST_STAGING` e `EC2_HOST_PROD`
- **Questão**: É o mesmo servidor para staging e produção?

#### Problema com Buckets S3:
- **DEV_COMMANDS.md** mostra: `[S3_BUCKET_NAME]`
- **Workflows** esperam: `S3_BUCKET_STAGING` e `S3_BUCKET_PROD`
- **Questão**: Usar o mesmo bucket ou criar separados?

### 3. ARQUIVOS FALTANDO
- `docker-compose.production.yml` - Referenciado mas não existe
- `docker-compose.staging.yml` - Pode estar faltando

---

## 🏗️ INFRAESTRUTURA ATUAL

### MongoDB Atlas ✅
- **Cluster**: `chat-atendimento.7mtwmy0.mongodb.net`
- **Usuário**: `[MONGODB_USER]`
- **Senha**: `[MONGODB_PASSWORD]`
- **Database Dev/Staging**: `chat-atendimento-dev`
- **Database Production**: `chat-atendimento-prod`

### AWS EC2 ⚠️
- **IP Atual**: `52.90.17.204`
- **Status**: Precisa verificar se está ativo e configurado
- **Questão**: Mesmo servidor para staging e production?

### AWS S3 ⚠️
- **Bucket Existente**: `[S3_BUCKET_NAME]`
- **Região**: `us-east-1`
- **Status**: Configurado mas não integrado nos ambientes

### Domínio Hostinger ❌
- **Domínio**: `suporte.brsi.net.br`
- **Status**: Não configurado
- **Responsável**: Equipe de TI da BR Sistemas

---

## 📦 ESTRUTURA DE AMBIENTES

| Ambiente | Branch | Database | S3 Bucket | URL | Status |
|----------|--------|----------|-----------|-----|--------|
| **Development** | `develop` | `chat-atendimento-dev` | Local | http://localhost:3000 | ✅ |
| **Staging** | `staging` | `chat-atendimento-dev` | `[S3_BUCKET_NAME]` | http://52.90.17.204 | ⚠️ |
| **Production** | `main` | `chat-atendimento-prod` | `[S3_BUCKET_NAME]` | https://suporte.brsi.net.br | ❌ |

---

## 🚀 GUIA DE IMPLANTAÇÃO PASSO A PASSO

### FASE 1: CORRIGIR CONFIGURAÇÕES (FAZER AGORA!)

#### 1.1 Adicionar Secrets Faltantes no GitHub
```bash
# Vá para: https://github.com/rafabrdev/chat-atendimento/settings/secrets/actions

# Adicione OBRIGATORIAMENTE:
EC2_USER = ec2-user
EC2_HOST_STAGING = 52.90.17.204
EC2_HOST_PROD = 52.90.17.204
EC2_SSH_KEY_STAGING = (copie o valor de EC2_SSH_KEY)
EC2_SSH_KEY_PROD = (copie o valor de EC2_SSH_KEY)
S3_BUCKET_STAGING = [S3_BUCKET_NAME]
S3_BUCKET_PROD = [S3_BUCKET_NAME]
API_URL_DEV = http://localhost:3001
API_URL_STAGING = http://52.90.17.204:3001
API_URL_PROD = https://suporte.brsi.net.br/api
PRODUCTION_DOMAIN = suporte.brsi.net.br
STAGING_EC2_HOST = 52.90.17.204
```

#### 1.2 Criar Arquivos Docker Compose Faltantes

**docker-compose.staging.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=staging
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - USE_S3=true
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      - REACT_APP_API_URL=http://52.90.17.204:3001
      - REACT_APP_ENV=staging
    restart: unless-stopped
```

**docker-compose.production.yml:**
```yaml
version: '3.8'

services:
  backend:
    image: ${ECR_REGISTRY}/${ECR_REPOSITORY}:backend-${IMAGE_TAG:-latest}
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - USE_S3=true
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: ${ECR_REGISTRY}/${ECR_REPOSITORY}:frontend-${IMAGE_TAG:-latest}
    ports:
      - "80:80"
      - "443:443"
    environment:
      - REACT_APP_API_URL=https://suporte.brsi.net.br/api
      - REACT_APP_ENV=production
    restart: always
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    restart: always
    depends_on:
      - backend
      - frontend
```

### FASE 2: VERIFICAR INFRAESTRUTURA

#### 2.1 Verificar EC2
```bash
# SSH para o servidor
ssh -i sua-chave.pem ec2-user@52.90.17.204

# Verificar se Docker está instalado
docker --version
docker-compose --version

# Se não estiver, instalar:
sudo yum update -y
sudo amazon-linux-extras install docker
sudo service docker start
sudo usermod -a -G docker ec2-user
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2.2 Verificar Portas no Security Group
No AWS Console:
1. EC2 → Security Groups
2. Encontre o grupo do servidor
3. Verifique/adicione regras:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 3000 (Frontend Dev)
   - Port 3001 (Backend)

### FASE 3: TESTAR DEPLOY

#### 3.1 Testar Localmente
```bash
cd backend
npm run dev
# Verifique se conecta no MongoDB Atlas
```

#### 3.2 Deploy para Staging
```bash
git checkout staging
git merge develop
git push origin staging
# Acompanhe em: https://github.com/rafabrdev/chat-atendimento/actions
```

#### 3.3 Verificar Staging
```bash
# Testar API
curl http://52.90.17.204:3001/api/health

# Acessar frontend
# http://52.90.17.204
```

### FASE 4: CONFIGURAR DOMÍNIO (HOSTINGER)

#### Para a equipe de TI configurar:

**Configuração DNS no Hostinger:**
1. Acessar painel Hostinger
2. Gerenciar domínio `brsi.net.br`
3. Adicionar/Editar registro:
   - **Tipo**: A
   - **Nome**: suporte
   - **Valor**: 52.90.17.204
   - **TTL**: 3600

**Ou usando CNAME (se tiver um domínio AWS):**
   - **Tipo**: CNAME
   - **Nome**: suporte
   - **Valor**: ec2-52-90-17-204.compute-1.amazonaws.com
   - **TTL**: 3600

### FASE 5: DEPLOY PARA PRODUÇÃO

#### 5.1 Pré-requisitos
- [ ] Staging funcionando corretamente
- [ ] Domínio configurado e propagado
- [ ] SSL/HTTPS configurado (Let's Encrypt ou AWS Certificate Manager)
- [ ] Backup do banco realizado

#### 5.2 Deploy
```bash
git checkout main
git merge staging
git push origin main
# Acompanhe em: https://github.com/rafabrdev/chat-atendimento/actions
```

---

## 🔧 COMANDOS ÚTEIS

### Verificação de Configuração
```bash
# Verificar todas as configurações
cd backend
node scripts/verifyConfig.js

# Verificar secrets configurados (no GitHub Actions)
# Rode um workflow de teste e veja os logs
```

### Git Flow
```bash
# Desenvolvimento
git checkout develop
git pull origin develop
# ... fazer alterações ...
git add .
git commit -m "feat: descrição"
git push origin develop

# Promover para Staging
git checkout staging
git merge develop
git push origin staging

# Promover para Produção
git checkout main
git merge staging
git push origin main
```

### Docker
```bash
# Desenvolvimento local
docker-compose -f docker-compose.dev.yml up -d

# Logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild
docker-compose build --no-cache
```

### MongoDB
```bash
# Backup
mongodump --uri="mongodb+srv://[USERNAME]:[PASSWORD]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-prod"

# Restore
mongorestore --uri="mongodb+srv://[USERNAME]:[PASSWORD]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-dev" dump/
```

---

## 📊 CHECKLIST DE VALIDAÇÃO

### Desenvolvimento ✅
- [x] MongoDB Atlas conectando
- [x] Arquivos .env configurados
- [x] Aplicação rodando localmente
- [x] Branches organizadas

### Staging ⚠️
- [ ] Todos os secrets configurados
- [ ] docker-compose.staging.yml criado
- [ ] Deploy via GitHub Actions funcionando
- [ ] Aplicação acessível em http://52.90.17.204
- [ ] S3 integrado e funcionando

### Produção ❌
- [ ] docker-compose.production.yml criado
- [ ] Domínio configurado no Hostinger
- [ ] SSL/HTTPS configurado
- [ ] Deploy automático testado
- [ ] Backup automático configurado
- [ ] Monitoramento ativo

---

## 🚨 PROBLEMAS CONHECIDOS E SOLUÇÕES

### Problema 1: Workflows falhando por falta de secrets
**Solução**: Adicionar TODOS os secrets listados na seção "SECRETS FALTANDO NO GITHUB"

### Problema 2: Docker compose files não encontrados
**Solução**: Criar os arquivos docker-compose.staging.yml e docker-compose.production.yml conforme templates acima

### Problema 3: EC2 não acessível
**Soluções possíveis**:
1. Verificar se a instância está rodando no AWS Console
2. Verificar Security Groups (portas 22, 80, 443, 3001)
3. Verificar se o IP 52.90.17.204 ainda é válido
4. Verificar chave SSH está correta

### Problema 4: MongoDB não conecta
**Soluções**:
1. Verificar IP na whitelist (0.0.0.0/0 ou IP do EC2)
2. Verificar credenciais
3. Testar conexão com mongosh

### Problema 5: S3 não está salvando arquivos
**Soluções**:
1. Verificar AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY
2. Verificar se bucket existe
3. Verificar permissões IAM
4. Definir USE_S3=true nos ambientes staging/production

---

## 📞 CONTATOS E RESPONSABILIDADES

### Desenvolvimento
- **Responsável**: Rafael França (@rafabrdev)
- **Repositório**: https://github.com/rafabrdev/chat-atendimento

### Infraestrutura AWS
- **EC2**: Verificar status e configuração
- **S3**: Bucket `[S3_BUCKET_NAME]`
- **Região**: us-east-1

### Domínio (Hostinger)
- **Responsável**: Equipe de TI BR Sistemas
- **Domínio**: suporte.brsi.net.br
- **Ação necessária**: Configurar DNS para apontar para 52.90.17.204

### MongoDB Atlas
- **Status**: ✅ Configurado e funcionando
- **Cluster**: chat-atendimento.7mtwmy0.mongodb.net

---

## 🎯 PRÓXIMAS AÇÕES IMEDIATAS

1. **URGENTE**: Adicionar secrets faltantes no GitHub
2. **URGENTE**: Criar arquivos docker-compose faltantes
3. **IMPORTANTE**: Verificar se EC2 está acessível e configurado
4. **IMPORTANTE**: Pedir para TI configurar domínio no Hostinger
5. **TESTE**: Fazer deploy para staging e validar
6. **FINAL**: Deploy para produção após testes

---

## 📝 NOTAS IMPORTANTES

1. **Segurança**: As senhas expostas nos arquivos devem ser alteradas em produção
2. **Backup**: Sempre fazer backup antes de deploys em produção
3. **Monitoramento**: Configurar alertas para produção
4. **SSL**: Essencial para produção (Let's Encrypt ou ACM)
5. **Domínio**: Coordenar com TI para configuração DNS

---

*Este documento consolida todas as informações dos arquivos README.md, PROJECT_COMPLETE_STATUS.md, SETUP_GUIDE.md, DEPLOYMENT.md, DEV_COMMANDS.md e análise dos workflows do GitHub Actions.*
