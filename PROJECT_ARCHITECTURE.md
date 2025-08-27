# 🏗️ Arquitetura Completa do Projeto Chat Atendimento

## 📊 Visão Geral do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
├───────────────┬────────────────┬────────────────────────┤
│ Master Panel  │  Admin Panel   │    Client Chat         │
│   (Master)    │    (Admin)      │    (Cliente)           │
└───────┬───────┴────────┬───────┴────────┬───────────────┘
        │                │                 │
        ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                     │
├───────────────────────────────────────────────────────────┤
│  Authentication │ Multi-tenant │ Stripe │ AWS Services  │
│      (JWT)      │  Isolation   │  API   │  (S3, SES)    │
└────────────────┬──────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                  DATABASE (MongoDB)                      │
├───────────────────────────────────────────────────────────┤
│  Tenants │ Users │ Conversations │ Messages │ Files     │
└───────────────────────────────────────────────────────────┘
```

## 🔑 Hierarquia de Usuários

### 1. **MASTER** (Você - Dono do Sistema)
- **Acesso**: `/master`
- **Permissões**: Total
- **Funções**:
  - Criar/editar/deletar empresas (tenants)
  - Criar/editar/deletar admins de empresas
  - Ver dashboard global com métricas
  - Gerenciar planos e billing
  - Impersonar qualquer usuário
  - Configurar sistema

### 2. **ADMIN** (Dono da Empresa Cliente)
- **Acesso**: `/empresa/{slug-da-empresa}/admin`
- **Permissões**: Total dentro da empresa
- **Funções**:
  - Criar/editar/deletar agentes
  - Enviar convites para clientes
  - Ver dashboard da empresa
  - Configurar chat widget
  - Gerenciar departamentos
  - Acessar portal de billing (Stripe)

### 3. **AGENT** (Atendente da Empresa)
- **Acesso**: `/empresa/{slug-da-empresa}/agent`
- **Permissões**: Limitadas ao atendimento
- **Funções**:
  - Atender chats
  - Ver fila de atendimento
  - Transferir conversas
  - Ver histórico de clientes atribuídos
  - Usar respostas prontas

### 4. **CLIENT** (Cliente Final)
- **Acesso**: `/empresa/{slug-da-empresa}/chat`
- **Permissões**: Mínimas
- **Funções**:
  - Iniciar chat
  - Enviar mensagens
  - Enviar arquivos
  - Ver histórico próprio
  - Avaliar atendimento

## 🗂️ Estrutura de Pastas

```
chat-atendimento/
├── backend/
│   ├── config/
│   │   ├── database.js        # Conexão MongoDB
│   │   ├── permissions.js     # Sistema de permissões
│   │   ├── swagger.js         # Documentação API
│   │   └── upload.js          # Configuração uploads
│   │
│   ├── controllers/
│   │   ├── authController.js      # Autenticação
│   │   ├── masterController.js    # Painel Master
│   │   ├── agentController.js     # Gestão de agentes
│   │   └── invitationController.js # Sistema de convites
│   │
│   ├── middleware/
│   │   ├── auth.js              # Autenticação JWT
│   │   ├── roleAuth.js         # Autorização por roles
│   │   ├── tenantMiddleware.js  # Isolamento multi-tenant
│   │   └── errorHandler.js      # Tratamento de erros
│   │
│   ├── models/
│   │   ├── Tenant.js           # Empresas/Clientes
│   │   ├── User.js             # Usuários (todos os tipos)
│   │   ├── Agent.js            # Dados específicos de agentes
│   │   ├── Invitation.js       # Convites por email
│   │   ├── Conversation.js     # Conversas de chat
│   │   └── Message.js          # Mensagens
│   │
│   ├── routes/
│   │   ├── master.js           # Rotas do Master
│   │   ├── auth.js             # Rotas de autenticação
│   │   ├── stripe.js           # Rotas do Stripe
│   │   ├── agents.js           # Rotas de agentes
│   │   └── invitations.js      # Rotas de convites
│   │
│   ├── services/
│   │   ├── stripeService.js    # Integração Stripe
│   │   ├── emailService.js     # AWS SES
│   │   └── chatService.js      # Lógica de chat
│   │
│   ├── scripts/
│   │   ├── stripeSetup.js      # Setup do Stripe
│   │   └── setupMaster.js      # Criar usuário master
│   │
│   ├── templates/
│   │   └── emails/             # Templates de email
│   │       ├── admin-welcome.hbs
│   │       ├── client-invitation.hbs
│   │       └── payment-failed.hbs
│   │
│   ├── .env                    # Variáveis de ambiente
│   └── server.js              # Servidor Express
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── master/        # Componentes do Master
│   │   │   ├── admin/         # Componentes do Admin
│   │   │   ├── agent/         # Componentes do Agent
│   │   │   └── chat/          # Componentes do Chat
│   │   │
│   │   ├── pages/
│   │   │   ├── MasterDashboard.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AgentPanel.jsx
│   │   │   ├── ClientChat.jsx
│   │   │   ├── Pricing.jsx
│   │   │   └── CheckoutSuccess.jsx
│   │   │
│   │   ├── services/
│   │   │   ├── api.js         # Chamadas API
│   │   │   ├── auth.js        # Autenticação
│   │   │   └── stripe.js      # Stripe frontend
│   │   │
│   │   └── App.jsx            # Roteamento principal
│   │
│   └── package.json
│
├── STRIPE_SETUP.md            # Instruções Stripe
├── PROJECT_ARCHITECTURE.md    # Este arquivo
└── README.md                  # Documentação principal
```

## 🔐 Fluxos de Autenticação

### Fluxo 1: Compra via Stripe (Cliente Novo)
```
1. Cliente acessa página de preços
2. Escolhe plano e vai para Stripe Checkout
3. Preenche dados e paga
4. Webhook cria Tenant + Admin automaticamente
5. Email enviado com credenciais temporárias
6. Cliente acessa link e define senha definitiva
7. Redireciona para dashboard admin
```

### Fluxo 2: Criação pelo Master
```
1. Master acessa /master
2. Cria nova empresa manualmente
3. Define admin da empresa
4. Sistema envia email ao admin
5. Admin acessa e configura empresa
```

### Fluxo 3: Convite de Cliente
```
1. Admin/Agent envia convite por email
2. Cliente recebe link único
3. Acessa link e cria conta
4. Automaticamente vinculado à empresa correta
5. Pode iniciar chat
```

## 🌐 URLs e Rotas

### Desenvolvimento (localhost)
```
# Backend API
http://localhost:5000/api/

# Frontend
http://localhost:5173/

# Master Panel
http://localhost:5173/master

# Empresa específica
http://localhost:5173/empresa/nome-da-empresa

# Admin Dashboard
http://localhost:5173/empresa/nome-da-empresa/admin

# Agent Panel
http://localhost:5173/empresa/nome-da-empresa/agent

# Client Chat
http://localhost:5173/empresa/nome-da-empresa/chat
```

### Produção (exemplo)
```
# Backend API
https://api.seuapp.com.br/

# Frontend
https://seuapp.com.br/

# Master Panel
https://seuapp.com.br/master

# Com subdomínio (se USE_SUBDOMAIN=true)
https://nome-da-empresa.seuapp.com.br/
```

## 💾 Modelos de Dados

### Tenant (Empresa)
```javascript
{
  _id: ObjectId,
  companyName: String,
  slug: String (único),
  owner: ObjectId (User admin),
  subscription: {
    plan: 'starter|professional|enterprise',
    status: 'active|suspended|cancelled',
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  limits: {
    users: Number,
    agents: Number,
    storage: Number (GB),
    monthlyMessages: Number
  },
  modules: {
    chat: { enabled: Boolean },
    crm: { enabled: Boolean },
    hrm: { enabled: Boolean }
  }
}
```

### User (Todos os tipos)
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId (exceto master),
  email: String (único),
  password: String (hash),
  name: String,
  role: 'master|admin|agent|client',
  company: String,
  createdBy: ObjectId,
  invitedBy: ObjectId,
  customPermissions: Map
}
```

## 🔄 Integrações

### Stripe
- **Checkout**: Criação de assinatura
- **Webhooks**: Eventos de pagamento
- **Portal**: Gestão de billing
- **Produtos**: 3 planos configurados

### AWS S3
- **Upload de arquivos**: Imagens e documentos
- **Bucket**: chat-atendimento-staging
- **Região**: us-east-1

### AWS SES
- **Envio de emails**: Transacionais
- **Templates**: Handlebars
- **Região**: us-east-1

### MongoDB Atlas
- **Database**: chat-atendimento-dev
- **Cluster**: Atlas compartilhado
- **Backup**: Automático diário

## 🚀 Comandos Importantes

### Backend
```bash
cd backend

# Instalar dependências
npm install

# Iniciar servidor desenvolvimento
npm run dev

# Criar usuário master
node scripts/setupMaster.js

# Configurar Stripe
node scripts/stripeSetup.js

# Testar webhook Stripe
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

### Frontend
```bash
cd frontend

# Instalar dependências
npm install

# Iniciar desenvolvimento
npm run dev

# Build produção
npm run build
```

## 📈 Planos e Preços

### Starter - R$ 49/mês
- 10 usuários
- 3 agentes
- 5 GB armazenamento
- 10.000 mensagens/mês
- Módulo: Chat

### Professional - R$ 99/mês
- 50 usuários
- 10 agentes
- 20 GB armazenamento
- 50.000 mensagens/mês
- Módulos: Chat + CRM

### Enterprise - R$ 299/mês
- Ilimitado
- 100 GB armazenamento
- Todos os módulos
- Suporte prioritário

## 🔒 Segurança

- **JWT**: Tokens com expiração
- **Bcrypt**: Hash de senhas
- **Multi-tenant**: Isolamento lógico completo
- **Rate Limiting**: Proteção contra spam
- **Helmet**: Headers de segurança
- **CORS**: Configurado para domínios específicos
- **Stripe Webhook**: Verificação de assinatura

## 📝 Checklist de Configuração

- [x] MongoDB Atlas configurado
- [x] AWS S3 configurado
- [x] AWS SES configurado (precisa verificar domínio)
- [x] Stripe keys configuradas
- [ ] Stripe webhook secret (executar `stripe listen`)
- [ ] Criar produtos no Stripe (executar setup)
- [ ] Criar usuário master
- [ ] Configurar domínio em produção
- [ ] SSL/HTTPS em produção
- [ ] Backup automatizado

## 🆘 Suporte e Manutenção

### Logs
- Backend: Console e arquivo
- Stripe: `stripe logs tail`
- MongoDB: Atlas interface

### Monitoramento
- Uptime: Configurar monitor
- Erros: Sentry (opcional)
- Performance: New Relic (opcional)

### Backup
- MongoDB: Atlas automático
- S3: Versionamento habilitado
- Código: Git/GitHub

---

**Última atualização**: 25/08/2025
**Versão**: 1.0.0
**Status**: Development
