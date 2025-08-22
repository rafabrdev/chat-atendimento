# 🧪 PROCEDIMENTO DE TESTE DO WORKFLOW COMPLETO
*Dev → Staging → Production*

## 📋 PRÉ-REQUISITOS

### Antes de começar, verifique:
- [ ] Todos os secrets do GitHub configurados
- [ ] Arquivos docker-compose criados
- [ ] MongoDB Atlas funcionando
- [ ] EC2 acessível via SSH
- [ ] Branches git criadas (develop, staging, main)

### Execute o script de verificação:
```bash
cd backend
node scripts/checkProjectStatus.js
```

---

## 🔄 FLUXO DE TESTE COMPLETO

### FASE 1: DESENVOLVIMENTO LOCAL

#### 1.1 Preparar Ambiente
```bash
# Clonar repositório (se necessário)
git clone https://github.com/rafabrdev/chat-atendimento.git
cd chat-atendimento

# Checkout para develop
git checkout develop
git pull origin develop
```

#### 1.2 Testar Localmente
```bash
# Backend
cd backend
npm install
npm run dev

# Em outro terminal - Frontend
cd frontend
npm install
npm run dev
```

#### 1.3 Verificações Locais
- [ ] Backend rodando em http://localhost:3001
- [ ] Frontend rodando em http://localhost:3000
- [ ] MongoDB conectando corretamente
- [ ] Login funcionando
- [ ] Chat funcionando

#### 1.4 Fazer uma Alteração de Teste
```bash
# Criar arquivo de teste
echo "# Teste de Deploy - $(date)" > TEST_DEPLOY.md
git add TEST_DEPLOY.md
git commit -m "test: verificando pipeline de deploy"
git push origin develop
```

---

### FASE 2: DEPLOY PARA STAGING

#### 2.1 Promover para Staging
```bash
# Mudar para staging
git checkout staging
git pull origin staging

# Merge de develop
git merge develop
git push origin staging
```

#### 2.2 Acompanhar Deploy
1. Acesse: https://github.com/rafabrdev/chat-atendimento/actions
2. Procure por "Deploy Staging"
3. Clique no workflow em execução
4. Acompanhe os logs em tempo real

#### 2.3 Verificar Pontos de Falha Comuns

**Se falhar em "Configure AWS credentials":**
- Verificar secrets AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY

**Se falhar em "Deploy to EC2":**
- Verificar EC2_SSH_KEY_STAGING
- Verificar EC2_HOST_STAGING
- Verificar EC2_USER

**Se falhar em "Health Check":**
- SSH no servidor e verificar logs
- Verificar se portas estão abertas

#### 2.4 Testar Staging
```bash
# Testar API
curl http://52.90.17.204:3001/api/health

# Resposta esperada:
# {"status":"ok","timestamp":"...","environment":"staging"}

# Testar Frontend
# Navegador: http://52.90.17.204
```

#### 2.5 Checklist de Validação Staging
- [ ] API respondendo em /api/health
- [ ] Frontend carregando
- [ ] Login funcionando
- [ ] Chat conectando via WebSocket
- [ ] MongoDB conectado (verificar logs)
- [ ] Arquivo TEST_DEPLOY.md presente

---

### FASE 3: DEPLOY PARA PRODUÇÃO

#### 3.1 Pré-Deploy Produção
```bash
# Criar backup do banco (IMPORTANTE!)
mongodump --uri="mongodb+srv://[USERNAME]:[PASSWORD]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-prod" --out=backup-$(date +%Y%m%d)
```

#### 3.2 Promover para Produção
```bash
# Mudar para main
git checkout main
git pull origin main

# Merge de staging
git merge staging
git push origin main
```

#### 3.3 Acompanhar Deploy Produção
1. GitHub Actions: "Deploy Production"
2. Verificar criação de backup automático
3. Verificar push para ECR (se configurado)
4. Verificar health checks

#### 3.4 Testar Produção
```bash
# Se domínio configurado
curl https://suporte.brsi.net.br/api/health

# Se não, usar IP
curl http://52.90.17.204:3001/api/health
```

#### 3.5 Checklist de Validação Produção
- [ ] Backup criado antes do deploy
- [ ] API respondendo
- [ ] Frontend em produção
- [ ] SSL funcionando (se configurado)
- [ ] Sem erros nos logs
- [ ] Performance adequada

---

## 🔍 COMANDOS DE VERIFICAÇÃO

### Verificar Status dos Containers (no servidor)
```bash
# SSH para o servidor
ssh -i sua-chave.pem ec2-user@52.90.17.204

# Verificar containers
docker ps -a

# Ver logs do backend
docker logs chat-backend-prod --tail 100 -f

# Ver logs do frontend
docker logs chat-frontend-prod --tail 100 -f
```

### Verificar Conectividade MongoDB
```bash
# No servidor
docker exec -it chat-backend-prod sh
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected!'))
  .catch(err => console.error('Error:', err));
"
```

### Verificar S3 (se configurado)
```bash
# Listar arquivos no bucket
aws s3 ls s3://[S3_BUCKET_NAME]/
```

---

## 🚨 TROUBLESHOOTING

### Problema 1: Deploy falha no GitHub Actions
```bash
# Verificar secrets
# No workflow, adicione temporariamente:
- name: Debug Secrets
  run: |
    echo "EC2_HOST exists: ${{ secrets.EC2_HOST_STAGING != '' }}"
    echo "SSH_KEY exists: ${{ secrets.EC2_SSH_KEY_STAGING != '' }}"
```

### Problema 2: Container não inicia
```bash
# No servidor
docker-compose -f docker-compose.staging.yml logs
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d
```

### Problema 3: MongoDB não conecta
```bash
# Verificar whitelist IP
# MongoDB Atlas → Network Access → Add IP Address
# Adicionar: 52.90.17.204
```

### Problema 4: Frontend não carrega
```bash
# Verificar build args
docker inspect chat-frontend-prod | grep -A 5 "Env"

# Reconstruir se necessário
docker-compose -f docker-compose.production.yml build --no-cache frontend
docker-compose -f docker-compose.production.yml up -d frontend
```

---

## 📊 MÉTRICAS DE SUCESSO

### Tempo Esperado por Fase:
- **Development**: 5-10 minutos
- **Staging Deploy**: 3-5 minutos
- **Production Deploy**: 5-8 minutos

### Indicadores de Sucesso:
- ✅ Todos os workflows verdes no GitHub Actions
- ✅ Zero erros nos logs
- ✅ Health checks passando
- ✅ Tempo de resposta < 200ms
- ✅ WebSocket conectando sem falhas

---

## 🔄 ROLLBACK DE EMERGÊNCIA

### Se algo der errado em Produção:
```bash
# 1. SSH no servidor
ssh -i sua-chave.pem ec2-user@52.90.17.204

# 2. Parar containers atuais
cd ~/chat-atendimento
docker-compose -f docker-compose.production.yml down

# 3. Restaurar backup
cd ~
mv chat-atendimento chat-atendimento-failed
mv chat-atendimento-backup-[TIMESTAMP] chat-atendimento

# 4. Reiniciar com versão anterior
cd chat-atendimento
docker-compose -f docker-compose.production.yml up -d

# 5. Verificar
docker ps
curl http://localhost:3001/api/health
```

---

## 📝 REGISTRO DE TESTES

### Template de Registro:
```markdown
## Teste realizado em: [DATA]
**Executor**: [Nome]
**Branch testada**: [develop/staging/main]
**Commit**: [hash]

### Resultados:
- [ ] Development: OK/FALHA
- [ ] Staging: OK/FALHA  
- [ ] Production: OK/FALHA

### Problemas encontrados:
1. [Descrição do problema]
   - Solução: [Como foi resolvido]

### Tempo total: [XX minutos]
```

---

## ✅ CHECKLIST FINAL

Antes de considerar o workflow testado e aprovado:

- [ ] Deploy automático funcionando em todas as branches
- [ ] Rollback testado e funcionando
- [ ] Documentação atualizada
- [ ] Secrets todos configurados
- [ ] Monitoramento configurado
- [ ] Backup automático funcionando
- [ ] SSL/HTTPS configurado (produção)
- [ ] Domínio funcionando
- [ ] Performance adequada
- [ ] Logs centralizados

---

*Documento criado em: 22/01/2025*
*Use este procedimento para validar todo o pipeline de deploy*
