# Seeds e Migrações Multi-Tenant

## 📋 Visão Geral

Este diretório contém os scripts de seed e migração para configurar o ambiente multi-tenant do sistema de chat de atendimento.

## 🎯 Objetivo

Implementar o **Item 1** do guia de migração multi-tenant:
- Criar modelo Tenant com todos os campos necessários
- Configurar tenant "default" para dados existentes
- Migrar todos os dados legados para o tenant default
- Criar índices otimizados para queries multi-tenant

## 📁 Estrutura dos Arquivos

```
seeds/
├── 001-tenant-default.js      # Cria/atualiza o tenant default
├── 002-migrate-existing-data.js # Migra dados existentes para tenant default
├── run-all-seeds.js           # Script principal que executa tudo em ordem
└── README.md                  # Esta documentação
```

## 🚀 Como Executar

### Execução Completa (Recomendado)

```bash
cd backend
node seeds/run-all-seeds.js
```

### Execução Individual

```bash
# Apenas criar/atualizar tenant default
node seeds/001-tenant-default.js

# Apenas migrar dados existentes
node seeds/002-migrate-existing-data.js
```

## 📊 O que foi Implementado

### 1. Modelo Tenant Atualizado (`models/Tenant.js`)

Adicionados os seguintes campos ao schema existente:

- **allowedOrigins**: Array de URLs permitidas para CORS dinâmico
- **webhooks**: Configurações de webhooks para integrações
  - name: Nome do webhook
  - url: URL de destino
  - events: Eventos que disparam o webhook
  - headers: Headers customizados
  - secret: Para validação HMAC
  - isActive: Status do webhook
  - retryOnFailure: Retry automático
  - maxRetries: Número máximo de tentativas

### 2. Seed do Tenant Default

O script `001-tenant-default.js`:
- Cria um tenant com slug "default"
- Configura limites generosos (1000 usuários, 100GB storage)
- Habilita todos os módulos principais
- Define origens permitidas para desenvolvimento
- Configurações de segurança e branding padrão

### 3. Migração de Dados Existentes

O script `002-migrate-existing-data.js`:
- Adiciona `tenantId` a todos documentos existentes
- Migra as seguintes coleções:
  - Users
  - Agents
  - Contacts
  - Conversations
  - Messages
  - Files
  - QueueEntries
  - Invitations
- Cria índices compostos para otimização
- Atualiza estatísticas do tenant

## 🔧 Configurações do Tenant Default

```javascript
{
  slug: 'default',
  companyName: 'Default Organization',
  plan: 'enterprise',
  status: 'active',
  
  // Limites
  limits: {
    users: 1000,
    storage: 100, // GB
    monthlyMessages: 1000000,
    monthlyMinutes: 100000,
    apiCalls: 10000000
  },
  
  // Origens permitidas
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    '*' // Temporário durante migração
  ],
  
  // Módulos habilitados
  modules: {
    chat: { enabled: true },
    crm: { enabled: true },
    hrm: { enabled: false }
  }
}
```

## 📈 Índices Criados

Para otimizar queries multi-tenant, foram criados os seguintes índices compostos:

- **Users**: `{tenantId: 1, email: 1}`, `{tenantId: 1, createdAt: -1}`
- **Agents**: `{tenantId: 1, userId: 1}`, `{tenantId: 1, isAvailable: 1}`
- **Contacts**: `{tenantId: 1, email: 1}`, `{tenantId: 1, phone: 1}`
- **Conversations**: `{tenantId: 1, status: 1}`, `{tenantId: 1, createdAt: -1}`
- **Messages**: `{tenantId: 1, conversationId: 1}`, `{tenantId: 1, createdAt: -1}`
- **Files**: `{tenantId: 1, createdAt: -1}`
- **QueueEntries**: `{tenantId: 1, status: 1}`, `{tenantId: 1, priority: -1, createdAt: 1}`
- **Invitations**: `{tenantId: 1, email: 1}`, `{tenantId: 1, status: 1}`

## ✅ Validação

Após executar os scripts, verifique:

1. **No MongoDB:**
```javascript
// Verificar tenant criado
db.tenants.findOne({slug: 'default'})

// Verificar migração em uma coleção
db.users.find({tenantId: {$exists: true}}).count()
```

2. **Logs de Execução:**
- ✅ Tenant "default" criado/atualizado
- ✅ X documentos migrados
- ✅ Índices criados com sucesso

## ⚠️ Importante

1. **Backup**: Sempre faça backup do banco antes de executar migrações
2. **Ambiente**: Teste primeiro em ambiente de desenvolvimento
3. **Variáveis**: Certifique-se que `.env` está configurado corretamente
4. **MongoDB**: Versão 4.4+ recomendada para suporte completo a índices compostos

## 🔄 Próximos Passos

Após executar este Item 1, prossiga para:

1. **Item 2**: Implementar TenantMiddleware
2. **Item 3**: Criar MongooseTenantScopePlugin
3. **Item 4**: Refatorar modelos com tenantId obrigatório
4. **Item 5**: Adaptar JWT para incluir tenantId

## 🐛 Troubleshooting

### Erro: "Cannot connect to MongoDB"
- Verifique se MongoDB está rodando
- Confirme MONGODB_URI no arquivo .env

### Erro: "Tenant default já existe"
- Normal se executar múltiplas vezes
- O script atualiza configurações existentes

### Erro: "Index already exists"
- Normal, índices não são duplicados
- Script continua normalmente

## 📝 Notas de Implementação

- O tenant "default" é criado com plano "enterprise" e sem limites restritivos
- Todos os dados existentes são associados ao tenant default
- O campo `migratedAt` marca quando o documento foi migrado
- Índices compostos garantem performance em queries filtradas por tenant
- Webhooks permitem integração futura com sistemas externos

---

**Implementado em**: 26/08/2025
**Versão**: 1.0.0
**Status**: ✅ Completo
