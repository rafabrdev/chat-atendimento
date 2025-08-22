# 🚨 AÇÕES IMEDIATAS PARA RESOLVER PROBLEMAS

## 1️⃣ RESOLVER ALERTAS DE SEGURANÇA (FAÇA AGORA!)

### Passo 1: Remover credenciais dos arquivos
```bash
# Execute o script de correção
node scripts/fix-security-issues.js

# Verifique as mudanças
git diff

# Commit as correções
git add .
git commit -m "fix: remove exposed credentials from files"
git push origin develop
```

### Passo 2: Atualizar MongoDB Atlas
1. Acesse MongoDB Atlas: https://cloud.mongodb.com
2. Vá em Database Access
3. Edite o usuário `chatadmin`
4. **MUDE A SENHA** (a atual está exposta)
5. Anote a nova senha em local seguro

### Passo 3: Atualizar Secrets no GitHub
Com a nova senha do MongoDB, atualize:
```
MONGODB_URI_DEV = mongodb+srv://chatadmin:[NOVA_SENHA]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-dev
MONGODB_URI_STAGING = mongodb+srv://chatadmin:[NOVA_SENHA]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-dev
MONGODB_URI_PROD = mongodb+srv://chatadmin:[NOVA_SENHA]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-prod
```

---

## 2️⃣ ADICIONAR SECRETS FALTANTES

### No GitHub (https://github.com/rafabrdev/chat-atendimento/settings/secrets/actions):

| Secret | Valor |
|--------|-------|
| **EC2_USER** | `ec2-user` |
| **EC2_SSH_KEY_STAGING** | (copie de EC2_SSH_KEY) |
| **EC2_SSH_KEY_PROD** | (copie de EC2_SSH_KEY) |
| **PRODUCTION_DOMAIN** | `suporte.brsi.net.br` |

---

## 3️⃣ CORRIGIR WORKFLOW DO GITHUB ACTIONS

### Arquivo: `.github/workflows/deploy-develop.yml`

Adicione no início do job `build`:
```yaml
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Check Required Secrets
      run: |
        if [ -z "${{ secrets.MONGODB_URI_DEV }}" ]; then
          echo "ERROR: MONGODB_URI_DEV secret is not set"
          exit 1
        fi
```

### Teste o Workflow
```bash
# Faça um pequeno commit de teste
echo "test: $(date)" > test.txt
git add test.txt
git commit -m "test: verify workflow"
git push origin develop
```

---

## 4️⃣ SEPARAR AMBIENTES AWS

### Opção A: Usar Portas Diferentes (Rápido)
No mesmo servidor EC2 (52.90.17.204):
- **Staging**: Portas 3000 (frontend) e 3001 (backend)
- **Production**: Portas 80/443 (frontend) e 3002 (backend)

Atualize `docker-compose.staging.yml`:
```yaml
services:
  backend:
    ports:
      - "3001:3001"
  frontend:
    ports:
      - "3000:80"
```

Atualize `docker-compose.production.yml`:
```yaml
services:
  backend:
    ports:
      - "3002:3001"
  frontend:
    ports:
      - "80:80"
      - "443:443"
```

### Opção B: Criar Nova Instância EC2 (Recomendado)
1. Crie nova instância EC2 para produção
2. Atualize `EC2_HOST_PROD` com o novo IP
3. Configure Security Groups identicos

---

## 5️⃣ SEPARAR BUCKETS S3

### Criar novos buckets:
```bash
# AWS CLI
aws s3 mb s3://chat-atendimento-staging
aws s3 mb s3://chat-atendimento-production

# Configurar CORS
aws s3api put-cors-configuration --bucket chat-atendimento-staging --cors-configuration file://cors.json
aws s3api put-cors-configuration --bucket chat-atendimento-production --cors-configuration file://cors.json
```

### Atualizar Secrets:
```
S3_BUCKET_STAGING = chat-atendimento-staging
S3_BUCKET_PROD = chat-atendimento-production
```

---

## 6️⃣ VERIFICAR CONFIGURAÇÃO

### Execute o script de verificação:
```bash
cd backend
node scripts/checkProjectStatus.js
```

### Teste conexão MongoDB com nova senha:
```bash
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://chatadmin:[NOVA_SENHA]@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-dev')
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => console.error('❌ Error:', err.message));
"
```

---

## 📋 CHECKLIST FINAL

- [ ] Script de segurança executado
- [ ] Senha MongoDB alterada
- [ ] Secrets do GitHub atualizadas com nova senha
- [ ] EC2_USER adicionado
- [ ] EC2_SSH_KEY_STAGING adicionado
- [ ] EC2_SSH_KEY_PROD adicionado
- [ ] PRODUCTION_DOMAIN adicionado
- [ ] Workflow testado e funcionando
- [ ] Ambientes separados (portas ou servidores)
- [ ] Buckets S3 separados

---

## 🔄 ORDEM DE EXECUÇÃO

1. **PRIMEIRO**: Mude a senha do MongoDB Atlas
2. **SEGUNDO**: Execute o script de segurança
3. **TERCEIRO**: Atualize todos os secrets no GitHub
4. **QUARTO**: Adicione secrets faltantes
5. **QUINTO**: Teste o workflow
6. **SEXTO**: Configure separação de ambientes

---

## ⚠️ IMPORTANTE

**NÃO FAÇA DEPLOY** até completar todos os passos acima!

Após completar tudo:
1. Teste localmente
2. Deploy para staging
3. Validar staging
4. Deploy para produção

---

*Documento criado: 22/01/2025 17:15*
*Prioridade: CRÍTICA - Resolver imediatamente*
