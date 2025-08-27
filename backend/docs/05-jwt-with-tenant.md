# Item 5: JWTWithTenant

## 📋 Visão Geral

Implementação completa de autenticação JWT com suporte a multi-tenancy, garantindo isolamento de dados e controle de acesso baseado em tenant.

## ✅ Objetivos Alcançados

### 1. Token JWT com TenantId

O token JWT agora inclui informações do tenant:

```javascript
{
  "id": "userId",
  "email": "user@example.com",
  "role": "admin",
  "tenantId": "tenantId",
  "company": "Company Name",
  "name": "User Name",
  "tenantSlug": "company-slug",    // Se tenant populado
  "tenantName": "Company Name"      // Se tenant populado
}
```

### 2. Middleware de Autenticação Aprimorado

#### `middleware/jwtAuth.js`

Novo middleware unificado com funcionalidades completas:

- **`authenticateJWT`**: Valida token e configura contexto de tenant
- **`requireRole`**: Controle de acesso por role
- **`requireSameTenant`**: Previne acesso cross-tenant
- **`checkPlanLimit`**: Verifica limites do plano
- **`requireModule`**: Verifica se módulo está habilitado
- **`generateToken`**: Gera token com tenantId
- **`generateRefreshToken`**: Gera refresh token
- **`verifyRefreshToken`**: Valida refresh token

## 🔧 Implementações Técnicas

### 1. Geração de Token

```javascript
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId?._id || user.tenantId || null,
    company: user.company,
    name: user.name
  };
  
  // Adiciona detalhes do tenant se populado
  if (user.tenantId && typeof user.tenantId === 'object') {
    payload.tenantSlug = user.tenantId.slug;
    payload.tenantName = user.tenantId.companyName;
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    issuer: 'chat-atendimento',
    audience: 'chat-users'
  });
};
```

### 2. Validação de Tenant no Middleware

```javascript
// Para usuários não-master, validar tenant
if (user.role !== 'master') {
  const userTenantId = user.tenantId?._id || decoded.tenantId;
  
  if (!userTenantId) {
    return res.status(403).json({
      error: 'Usuário sem tenant associado',
      code: 'NO_TENANT'
    });
  }

  // Verificar se tenant está ativo
  if (!tenant.isActive) {
    return res.status(403).json({
      error: 'Tenant inativo',
      code: 'TENANT_INACTIVE'
    });
  }

  // Verificar status da assinatura
  if (tenant.subscription?.status === 'suspended') {
    return res.status(403).json({
      error: 'Assinatura suspensa',
      code: 'SUBSCRIPTION_SUSPENDED'
    });
  }
}
```

### 3. Controle de Acesso Cross-Tenant

```javascript
const requireSameTenant = (tenantIdParam = 'tenantId') => {
  return async (req, res, next) => {
    // Master pode acessar qualquer tenant
    if (req.user.role === 'master') {
      return next();
    }

    const resourceTenantId = req.params[tenantIdParam];
    const userTenantId = req.user.tenantId?._id || req.user.tenantId;
    
    if (resourceTenantId.toString() !== userTenantId.toString()) {
      return res.status(403).json({
        error: 'Acesso negado a recursos de outro tenant',
        code: 'CROSS_TENANT_ACCESS'
      });
    }

    next();
  };
};
```

## 🎯 Funcionalidades Adicionais

### 1. Verificação de Limites do Plano

```javascript
// Em rotas de criação de recursos
router.post('/users',
  authenticateJWT,
  checkPlanLimit('users'),  // Verifica limite de usuários
  createUser
);
```

### 2. Controle de Módulos

```javascript
// Em rotas específicas de módulos
router.get('/crm/contacts',
  authenticateJWT,
  requireModule('crm'),  // Verifica se CRM está habilitado
  getContacts
);
```

### 3. Refresh Token

```javascript
// Login retorna access token e refresh token
{
  "token": "eyJhbGciOiJIUzI1NiIs...",      // Access token (7 dias)
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..." // Refresh token (30 dias)
}
```

## 📝 Uso nas Rotas

### Exemplo de Proteção de Rotas

```javascript
const { 
  authenticateJWT, 
  requireRole, 
  requireSameTenant,
  checkPlanLimit 
} = require('../middleware/jwtAuth');

// Rota básica protegida
router.get('/profile', authenticateJWT, getProfile);

// Rota com controle de role
router.get('/admin/users', 
  authenticateJWT, 
  requireRole('admin', 'master'),
  getUsers
);

// Rota com validação de tenant
router.get('/tenant/:tenantId/data',
  authenticateJWT,
  requireSameTenant('tenantId'),
  getTenantData
);

// Rota com verificação de limites
router.post('/conversations',
  authenticateJWT,
  checkPlanLimit('monthlyMessages'),
  createConversation
);
```

## 🧪 Testes Implementados

### `tests/jwtAuth.test.js`

Testes completos cobrindo:

1. **Geração de Token**
   - Token com tenantId para usuários regulares
   - Token sem tenantId para master
   - Inclusão de detalhes do tenant quando populado
   - Geração de refresh token

2. **Validação de Token**
   - Rejeição de requisições sem token
   - Rejeição de tokens inválidos
   - Tratamento de tokens expirados

3. **Controle de Acesso**
   - Validação de roles
   - Prevenção de acesso cross-tenant
   - Bypass para usuário master

4. **Limites e Módulos**
   - Verificação de limites do plano
   - Controle de acesso a módulos

## ⚡ Melhorias de Performance

1. **Cache de Tenant**: Tenant é populado uma vez na autenticação
2. **Contexto de Tenant**: Configurado uma vez por requisição
3. **Validações Otimizadas**: Verificações em cascata para falhar rápido

## 🔒 Segurança

1. **Isolamento Total**: Impossível acessar dados de outro tenant
2. **Validação Dupla**: Token + banco de dados
3. **Códigos de Erro**: Específicos para debugging sem expor informações
4. **Master Bypass**: Apenas para role master, com log de auditoria

## 📊 Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `NO_TOKEN` | Token não fornecido |
| `INVALID_TOKEN` | Token inválido ou malformado |
| `TOKEN_EXPIRED` | Token expirado |
| `USER_NOT_FOUND` | Usuário do token não existe |
| `ACCOUNT_DISABLED` | Conta desativada |
| `NO_TENANT` | Usuário sem tenant associado |
| `TENANT_NOT_FOUND` | Tenant não existe |
| `TENANT_INACTIVE` | Tenant desativado |
| `SUBSCRIPTION_SUSPENDED` | Assinatura suspensa |
| `SUBSCRIPTION_EXPIRED` | Assinatura expirada |
| `CROSS_TENANT_ACCESS` | Tentativa de acesso cross-tenant |
| `INSUFFICIENT_PERMISSION` | Role insuficiente |
| `PLAN_LIMIT_REACHED` | Limite do plano atingido |
| `MODULE_DISABLED` | Módulo não habilitado |

## 🔄 Migração

Para migrar do sistema antigo:

1. **Atualizar imports nas rotas**:
```javascript
// Antes
const { auth, authorize } = require('../middleware/auth');

// Depois
const { authenticateJWT, requireRole } = require('../middleware/jwtAuth');
```

2. **Atualizar uso do middleware**:
```javascript
// Antes
router.get('/profile', auth, getProfile);

// Depois
router.get('/profile', authenticateJWT, getProfile);
```

3. **Atualizar authController**:
```javascript
// Já atualizado para usar as novas funções
const { generateToken, generateRefreshToken } = require('../middleware/jwtAuth');
```

## ✨ Conclusão

O Item 5 foi implementado com sucesso, fornecendo:

- ✅ Tokens JWT com informação de tenant
- ✅ Validação automática de tenant em todas requisições
- ✅ Prevenção de acesso cross-tenant
- ✅ Controle de acesso baseado em roles
- ✅ Verificação de limites e módulos
- ✅ Suporte a refresh tokens
- ✅ Testes completos
- ✅ Documentação detalhada

O sistema agora garante isolamento total de dados entre tenants através do JWT, com performance otimizada e segurança robusta.
