# 🛠️ Comandos de Desenvolvimento - Chat Atendimento

## 🚀 Quick Start

### Desenvolvimento Local com Docker
```bash
# Iniciar ambiente de desenvolvimento completo
docker-compose -f docker-compose.dev.yml up -d

# Ver logs
docker-compose -f docker-compose.dev.yml logs -f

# Parar ambiente
docker-compose -f docker-compose.dev.yml down
```

### URLs de Desenvolvimento
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Swagger Docs**: http://localhost:5000/api-docs
- **MongoDB Express**: http://localhost:8081 (admin/admin123)
- **MailHog**: http://localhost:8025
- **LocalStack S3**: http://localhost:4566

---

## 👤 Criar Primeiro Admin

### Opção 1: Script Node.js (Recomendado)
```bash
cd backend
node scripts/createAdmin.js
```

### Opção 2: Via API REST
```bash
# Criar admin via curl
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin BR",
    "email": "admin@brsi.net.br",
    "password": "senha123456",
    "role": "admin"
  }'
```

### Opção 3: MongoDB Express
1. Acesse http://localhost:8081
2. Login: admin/admin123
3. Navegue para database `chat-atendimento-dev`
4. Collection `users`
5. Adicione um documento com role: "admin"

---

## 🔍 Verificar Persistência no MongoDB

### Via Script
```bash
# Verificar usuários salvos
cd backend
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('./models/User');
  const users = await User.find({});
  console.table(users.map(u => ({
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.isActive
  })));
  process.exit(0);
});
"
```

### Via MongoDB Express
- Acesse: http://localhost:8081
- Visualize collections e documentos
- Execute queries personalizadas

### Via Docker
```bash
# Conectar ao MongoDB via shell
docker exec -it chat-mongodb-dev mongosh

# Comandos MongoDB
use chat-atendimento-dev
db.users.find().pretty()
db.chats.find().pretty()
db.messages.find().pretty()
```

---

## 📁 Verificar Uploads no S3

### Script de Verificação
```bash
cd backend
node scripts/checkS3.js
```

### LocalStack (Desenvolvimento)
```bash
# Listar buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# Listar arquivos no bucket
aws --endpoint-url=http://localhost:4566 s3 ls s3://chat-uploads-dev/

# Fazer upload de teste
echo "teste" > test.txt
aws --endpoint-url=http://localhost:4566 s3 cp test.txt s3://chat-uploads-dev/
```

### S3 Produção
```bash
# Configurar AWS CLI
aws configure
# Use as credenciais do CREDENTIALS_PRIVATE.md

# Listar arquivos
aws s3 ls s3://chat-atendimento-uploads-726/

# Estatísticas do bucket
aws s3 ls s3://chat-atendimento-uploads-726/ --recursive --summarize
```

---

## 📚 Documentação da API (Swagger)

### Desenvolvimento
1. Inicie o backend: `docker-compose -f docker-compose.dev.yml up backend-dev`
2. Acesse: http://localhost:5000/api-docs
3. Teste endpoints diretamente no Swagger UI

### Produção (se habilitado)
```bash
# Habilitar Swagger em produção (não recomendado)
ENABLE_SWAGGER=true
```

---

## 🧪 Testes de Integração

### Testar Chat Completo
```bash
# 1. Criar cliente
curl -X POST http://localhost:5000/api/chat/start \
  -H "Content-Type: application/json" \
  -d '{"name": "João Silva", "email": "joao@example.com"}'

# 2. Listar fila (como atendente)
curl http://localhost:5000/api/chat/queue \
  -H "Authorization: Bearer SEU_TOKEN"

# 3. Aceitar chat
curl -X POST http://localhost:5000/api/chat/CHAT_ID/accept \
  -H "Authorization: Bearer SEU_TOKEN"

# 4. Enviar mensagem
curl -X POST http://localhost:5000/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"chatId": "CHAT_ID", "content": "Olá, como posso ajudar?"}'
```

### Testar Upload
```bash
# Upload de arquivo
curl -X POST http://localhost:5000/api/files/upload \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "file=@/path/to/file.jpg" \
  -F "chatId=CHAT_ID"
```

---

## 🐛 Debug

### Logs do Docker
```bash
# Todos os containers
docker-compose -f docker-compose.dev.yml logs -f

# Container específico
docker-compose -f docker-compose.dev.yml logs -f backend-dev
```

### Debug Node.js
```bash
# Porta de debug: 9229
# Configure seu IDE para conectar em localhost:9229

# VS Code: Adicione ao launch.json
{
  "type": "node",
  "request": "attach",
  "name": "Docker: Attach to Node",
  "port": 9229,
  "address": "localhost",
  "localRoot": "${workspaceFolder}/backend",
  "remoteRoot": "/app"
}
```

### MongoDB Queries
```javascript
// Verificar índices
db.users.getIndexes()

// Verificar performance
db.chats.explain("executionStats").find({status: "waiting"})

// Limpar dados de teste
db.messages.deleteMany({chat: ObjectId("...")})
```

---

## 🔄 Sincronização com Produção

### Backup do MongoDB Atlas
```bash
# Fazer backup
mongodump --uri="mongodb+srv://chatadmin:pMwrRrCbus50k7DR@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento"

# Restaurar localmente
mongorestore --uri="mongodb://admin:dev123456@localhost:27017/chat-atendimento-dev?authSource=admin" dump/
```

### Sincronizar S3
```bash
# Download de produção
aws s3 sync s3://chat-atendimento-uploads-726/ ./backup-s3/

# Upload para desenvolvimento
aws --endpoint-url=http://localhost:4566 s3 sync ./backup-s3/ s3://chat-uploads-dev/
```

---

## 📝 Comandos Úteis

### Limpar ambiente
```bash
# Remover todos os containers e volumes
docker-compose -f docker-compose.dev.yml down -v

# Limpar cache do Docker
docker system prune -af
```

### Rebuild
```bash
# Rebuild específico
docker-compose -f docker-compose.dev.yml build backend-dev

# Rebuild completo
docker-compose -f docker-compose.dev.yml build --no-cache
```

### Executar comandos no container
```bash
# Shell no backend
docker exec -it chat-backend-dev sh

# Instalar pacote
docker exec -it chat-backend-dev npm install axios

# Executar script
docker exec -it chat-backend-dev node scripts/createAdmin.js
```

---

## 🚨 Troubleshooting

### Problema: Porta já em uso
```bash
# Verificar processos nas portas
netstat -ano | findstr :5000
netstat -ano | findstr :3000

# Matar processo (Windows)
taskkill /PID <PID> /F
```

### Problema: Permissão negada (uploads)
```bash
# Dar permissão na pasta
docker exec -it chat-backend-dev chmod -R 777 uploads
```

### Problema: MongoDB não conecta
```bash
# Verificar se está rodando
docker ps | grep mongodb

# Ver logs
docker logs chat-mongodb-dev

# Testar conexão
docker exec -it chat-mongodb-dev mongosh -u admin -p dev123456
```

---

## 📊 Monitoramento

### Status dos containers
```bash
docker stats
```

### Tamanho dos volumes
```bash
docker system df -v
```

### Logs em tempo real
```bash
# Backend
docker logs -f chat-backend-dev --tail 100

# MongoDB
docker logs -f chat-mongodb-dev --tail 50
```

---

*Última atualização: 22/01/2025*
