# Migração do Sistema de Tenants

## Data: 27/08/2025

## Resumo
Este documento descreve a migração do sistema de tenants para resolver conflitos e consolidar a lógica em um único ponto de controle.

## Problemas Identificados

1. **Conflito de Ordem dos Providers**
   - O `TenantProvider` estava envolvendo o `AuthProvider`, mas dependia dele
   - Isso causava erros de contexto indefinido ao acessar `useAuth` dentro do `TenantProvider`

2. **Bloqueio de Login**
   - O `TenantProvider` mostrava tela de carregamento mesmo em rotas públicas
   - Impedia que usuários fizessem login quando o tenant não podia ser resolvido

3. **Falta do campo _id na API**
   - A rota `/api/tenants/resolve` não retornava o campo `_id` do tenant
   - O frontend esperava esse campo para funcionar corretamente

4. **Token enviado em rotas públicas**
   - O axios enviava token de autenticação mesmo para rotas públicas
   - Isso poderia causar erros 401 desnecessários

## Soluções Implementadas

### 1. Correção da Ordem dos Providers
**Arquivo:** `frontend/src/App.jsx`

**Antes:**
```jsx
<AuthProvider>
  <TenantProvider>
    <Router>
```

**Depois:**
```jsx
<Router>
  <AuthProvider>
    <TenantProvider>
```

### 2. TenantProvider Tolerante a Erros
**Arquivo:** `frontend/src/providers/TenantProvider.jsx`

- Adicionado tratamento de erro no `loadTenant()` inicial
- Verificação de rotas públicas para não bloquear login
- Loading state condicional baseado em `isAuthenticated` e tipo de rota

```javascript
const isPublicRoute = typeof window !== 'undefined' && (
  window.location.pathname === '/login' || 
  window.location.pathname === '/register' || 
  window.location.pathname === '/pricing' ||
  window.location.pathname.startsWith('/checkout')
);

if (loading && !tenant && !isPublicRoute && isAuthenticated) {
  // Mostrar loading apenas em rotas privadas autenticadas
}
```

### 3. Adição do _id na Resposta da API
**Arquivo:** `backend/routes/tenants.js`

Adicionado o campo `_id` na resposta da rota `/tenants/resolve`:

```javascript
res.json({
  success: true,
  resolveMethod,
  data: {
    _id: tenant._id, // Novo campo
    key: tenant.key,
    name: tenant.name,
    // ... outros campos
  }
});
```

### 4. Criação de Instância Pública do Axios
**Arquivo:** `frontend/src/config/api.js`

Criada instância `publicApi` sem interceptors de autenticação:

```javascript
export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

**Arquivo:** `frontend/src/services/tenantService.js`

Atualizado para usar `publicApi` em rotas públicas:

```javascript
import api, { publicApi } from '../config/api';

// Em resolveTenant()
const response = await publicApi.get('/tenants/resolve', {
  params: { key }
});
```

## Componentes Analisados

### Componentes que usam tenantService diretamente:
1. **TenantProvider** - OK, é o componente principal
2. **TenantSettings** - Precisa migração futura para usar `useTenant()`

### Componentes que usam corretamente o contexto:
- FeatureGate
- TenantProviderTest
- Todos os dashboards via `useTenant()`

## Status da Migração

✅ **Concluído:**
- Correção da ordem dos providers
- TenantProvider tolerante a erros
- API retornando _id corretamente
- Instância pública do axios configurada
- Build passando sem erros

⏳ **Pendente:**
- Migrar TenantSettings para usar `useTenant()`
- Implementar carregamento lazy após login
- Criar testes automatizados

## Fluxo de Carregamento Atual

1. **Página Pública (Login/Register):**
   - TenantProvider tenta carregar tenant por subdomínio
   - Se falhar, continua sem bloquear
   - Usuário pode fazer login normalmente

2. **Após Login:**
   - TenantProvider recarrega com informações do usuário autenticado
   - Tenant completo é carregado com permissões
   - Branding e features são aplicados

3. **Páginas Privadas:**
   - TenantProvider mostra loading apenas se autenticado
   - Em caso de erro crítico, oferece opção de recarregar
   - Feature gates funcionam baseados no tenant carregado

## Próximos Passos

1. **Migração do TenantSettings**
   - Remover chamadas diretas ao tenantService
   - Usar hook `useTenant()` para acessar e atualizar dados

2. **Otimização do Carregamento**
   - Implementar cache local do tenant
   - Adicionar retry com backoff exponencial
   - Carregar tenant completo apenas quando necessário

3. **Testes**
   - Criar testes unitários para TenantProvider
   - Testar fluxo completo de login com diferentes cenários
   - Validar feature gates em diferentes planos

## Comandos Úteis

```bash
# Testar resolução de tenant
curl -X GET "http://localhost:5000/api/tenants/resolve?key=default"

# Build do frontend
cd frontend && npm run build

# Executar aplicação
cd backend && npm run dev
cd frontend && npm run dev
```
