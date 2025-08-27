# Visão rápida do que existe

* **Stack**: Node 20+/Express, Mongo/Mongoose, Socket.IO, JWT, S3, Docker; Front em React 18 + Vite, Zustand e React Query. ([GitHub][1])
* **Estrutura prevista** no backend: `config/`, `controllers/`, `middlewares/`, `models/`, `routes/`, `services/`, `sockets/`, `server.js`. ([GitHub][1])
* **Endpoints** principais: auth, chat, messages; **Eventos** Socket.IO (`join-chat`, `send-message`, `typing`, etc.). ([GitHub][1])
* **Variáveis de ambiente** (JWT, Mongo, URLs, S3). ([GitHub][1])
* **Deploy** com Docker Compose (um conjunto único de serviços por enquanto). ([GitHub][1])

> Observação: páginas de arquivos individuais do GitHub não renderizaram o conteúdo no navegador do web.run (limitação da própria página), então as recomendações abaixo partem do que o próprio repositório declara no README e do padrão comum desse tipo de stack. Onde eu cito linhas, é do README. ([GitHub][1])

---

# Onde multi-tenant costuma “vazar” (riscos concretos aqui)

## 1) Escopo de **tenant** inexistente/implícito

**Sintoma provável**: endpoints como `/api/chat/queue`, `/api/chat/:id/accept`, `/api/messages` e `/api/auth/*` funcionarem sem um `tenantId` validado e propagado — risco de mistura de dados entre clientes. ([GitHub][1])

**Ação**

* Definir **fonte única da verdade** do tenant: subdomínio (`acme.suaapp.com`), header (`X-Tenant-ID`), path (`/t/:tenantId/...`) ou combinação. Recomendo **subdomínio + fallback header** para integrações.
* Criar **middleware global de resolução de tenant** que:

  1. resolve pelo host/header;
  2. valida em uma coleção `tenants`;
  3. injeta `req.tenantId` e `req.tenant` (objeto com configs).
* **Bloquear requisição** sem tenant válido (4xx) — isso evita endpoints “soltos”.

## 2) Modelos **Mongoose** sem `tenantId` e índices

**Sintoma provável**: esquemas como `User`, `Chat`, `Message`, `Attachment`, `Setting` sem campo `tenantId` e **índices compostos** (p. ex. `unique: true` apenas em `email`, ao invés de `unique` em `{ tenantId, email }`).
**Ação**

* Adicionar `tenantId: ObjectId` (ou string) **obrigatório** em **todas** as entidades de domínio.
* Indexes críticos:

  * `Chat`: `{ tenantId:1, status:1, createdAt:-1 }` (fila/relatórios).
  * `Message`: `{ tenantId:1, chatId:1, createdAt:1 }`.
  * `User`: `unique` em `{ tenantId:1, email:1 }`.
  * `Attachment`: `{ tenantId:1, chatId:1, createdAt:1 }`.
  * `Settings/Branding`: `unique` em `{ tenantId:1, key:1 }`.
* Criar um **plugin Mongoose “tenantScope”** que injete `tenantId` automaticamente em `find/findOne/update/aggregate` (fail-safe para evitar queries sem tenant).

## 3) **JWT** sem `tenantId` e perfis

**Sintoma provável**: token com apenas `sub`/`role`.
**Ação**

* Incluir `tenantId`, `roles` e `scopes` no JWT.
* Separar **“tenant-admin”** de **“super-admin”** (global).
* Middleware de autorização deve checar **tenant do token = tenant da requisição** (host/header/path).

## 4) **Socket.IO** sem isolamento por tenant

**Sintoma provável**: usar um namespace/sala global por chat (`room = chatId`) sem prefixar o tenant → um chat `123` do tenant A pode colidir com `123` do tenant B. Os eventos listados no README (`join-chat`, `send-message`, `typing`) reforçam o risco se não houver namespacing. ([GitHub][1])
**Ação**

* Namespaces por tenant: `io.of(`/t/\${tenantId}`)` **ou** rooms sempre prefixados: `room = tenantId:chatId`.
* Validar o JWT **na conexão** e **em cada evento** (defesa em profundidade).
* Em escala horizontal, usar **adapter Redis** e incluir `tenantId` nos canais de pub/sub.
* Rate-limit por **conexão** e por **tenant** (protege de abuso).

## 5) **S3** sem segregação e política

**Sintoma provável**: enviar para um bucket único com chaves simples (`uploads/<nome>`).
**Ação**

* Prefixar por tenant: `s3://bucket/{tenantId}/...`.
* Assinar **URLs pré-assinadas** com validade curta e content-type whitelist; gravar metadados com `tenantId`.
* (Opcional) buckets por tenant em clientes grandes → isolamento e políticas IAM por bucket.

## 6) **CORS/CLIENT\_URL** estático

O README mostra `CLIENT_URL` único (`http://localhost:5173`). Em multi-tenant por subdomínio, isso vira **lista dinâmica de origens**. ([GitHub][1])
**Ação**

* Implementar **CORS dinâmico**: checar o `Origin` contra `tenants.allowedOrigins`.
* Enviar `Access-Control-Allow-Credentials` se houver cookies (ou manter só Bearer).

## 7) **Fila/aceitação de chat** sem transação/idempotência

Endpoints como `/api/chat/:id/accept` podem sofrer **double-accept** sob concorrência (dois atendentes clicando juntos). ([GitHub][1])
**Ação**

* Operação atômica: `findOneAndUpdate` com filtro `{ _id, tenantId, status: 'pending' }` → `status: 'active', agentId`.
* Habilitar **transações** (replica set) para fluxos que tocam múltiplas coleções (chat + log + métricas).

## 8) **Relatórios e dashboard** misturando dados

O README fala em dashboard e métricas. Sem `tenantId` disciplinado, gráficos somam tudo. ([GitHub][1])
**Ação**

* Em **todas** as agregações, primeiro estágio: `{ $match: { tenantId } }`.
* Query keys no front (React Query) devem incluir **tenant** para não “reaproveitar” cache de outro cliente.

## 9) **Config/branding** duplicados no front

Temas/cores/logos podem ter sido hardcoded por ambiente.
**Ação**

* Centralizar **Settings/Branding** por tenant no backend (DB) e servir via `/api/tenants/:id/settings`.
* No front, um **TenantProvider** pega o subdomínio, busca settings e injeta tema (Tailwind tokens/vars).

## 10) **Segurança**

* **Rate limiting** por IP **e por tenant**.
* **Helmet**, **size limits** (`json`, `multipart`) e **validação** rígida (Joi/Zod) em todas as entradas.
* **Sanitize** de HTML se mensagens suportarem rich text.
* **Auditoria**: salvar `who/when/what` com `tenantId` (auditar atendente/cliente).
* **Logs estruturados** sempre com `tenantId` e `requestId`.
* Rotação de **secrets** (idealmente JWKS ou versionamento de chaves) e segregação de variáveis por ambiente.

## 11) **Docker/infra**

O Compose atual indica uma topologia “monolítica” de dev. Em produção multi-tenant:

* Um **único backend** servindo todos os tenants (isolamento lógico) funciona, mas **adicione**: Redis (cache/fila/adapter Socket.IO), Mongo réplica, Nginx/Traefik p/ subdomínios, storage S3.
* Se algum cliente exigir **isolar recursos**, você consegue **subir outra stack** apontando para **outro banco/bucket** (multi-instance).

---

# Checklist prático (ordem sugerida)

1. **Tabela `tenants`** (ou coleção)

   * Campos: `key` (subdomínio), `name`, `allowedOrigins[]`, `plan/limits`, `branding`, `webhooks`, `status`.
   * Seeds para `dev`.

2. **Middleware de tenant** (HTTP + WebSocket)

   * Resolve por host/header/path → carrega `tenant` → injeta em `req/ctx`.
   * 4xx se ausente/ inválido.

3. **Plugin Mongoose `tenantScope`**

   * Adiciona `{ tenantId }` ao `where` por padrão; bloqueia `.find()` sem tenant explícito (modo estrito).
   * Garante `tenantId` no `doc` em `create`.

4. **Refatorar modelos**

   * Adicionar `tenantId` + **índices compostos** e `unique` por tenant.
   * Repassar migrations (script que cria índices e preenche `tenantId` para dados existentes).

5. **Autenticação/Autorização**

   * JWT inclui `tenantId` e `roles`.
   * Guardas comparam o `tenant` do token com o da request.
   * Perfis: `agent`, `tenant-admin`, `super-admin`.

6. **Socket.IO**

   * Namespace `/t/:tenantId` **ou** rooms `tenant:${tenantId}:chat:${chatId}`.
   * Validação de token no `connection` e por evento.
   * Adapter Redis para escala.

7. **S3**

   * Prefixo `{tenantId}/...`.
   * Presigned URLs com TTL curto e verificação de content-type.

8. **CORS dinâmico**

   * Checar `Origin` em `tenant.allowedOrigins`.
   * Suporte a múltiplos subdomínios.

9. **Concorrência na fila**

   * Aceitação de chat atômica (filtro por `status` + `tenantId`).
   * (Se possível) transações para etapas múltiplas.

10. **Observabilidade**

* Logger estruturado com `tenantId` e `requestId`.
* Métricas por tenant (contagem de chats, TMA, SLA).

11. **Front-end**

* `TenantProvider` resolve tenant (subdomínio) → busca `settings`.
* Query keys do React Query incluem `tenantId`.
* Socket usa namespace/URL com tenant.
* Tema/branding vindos do backend (nada hardcoded por cliente).

12. **Testes de regressão multi-tenant**

* Teste que **rejeita** requests sem tenant.
* Teste que **não encontra** dados de outro tenant.
* Teste de **double-accept** na fila.
* Testes de índices únicos por tenant.

---

# Pontos possivelmente **duplicados** hoje (onde costuma acumular retrabalho)

* **Validações** repetidas em controllers → subir para **schemas (Joi/Zod)** + middlewares.
* **Regras de escopo** (`tenantId`) repetidas em todas as queries → mover para **plugin/serviço**.
* **Upload S3** espalhado (controller x service) → **service único** que já calcula o prefixo do tenant.
* **Eventos Socket**: handlers duplicando verificação de permissões → **guard**/helper central.
* **Config/Tema**: condicionais no front por cliente → **settings** centralizados no backend.

---

# Pequenos trechos (esqueleto) para acelerar

**1) Express – resolver tenant (host → subdomínio):**

```js
// middleware/tenant.js
export function resolveTenant(req, res, next) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const sub = host.split('.')[0];
  const headerTenant = req.headers['x-tenant-id'];
  const key = headerTenant || sub;
  if (!key) return res.status(400).json({ error: 'Tenant ausente' });

  // Buscar na coleção tenants (cachear em memória/Redis)
  req.tenant = { id: /* _id */, key /* ...configs */ };
  req.tenantId = req.tenant.id;
  return next();
}
```

**2) Mongoose – plugin de escopo:**

```js
function tenantScope(schema) {
  schema.add({ tenantId: { type: String, index: true, required: true } });

  // Default filter
  const apply = (next) => {
    const t = this.getOptions()?.tenantId || this?.options?.tenantId;
    if (!t) return next(new Error('Missing tenantId in query options'));
    this.where({ tenantId: t });
    next();
  };
  schema.pre('find', apply);
  schema.pre('findOne', apply);
  schema.pre('countDocuments', apply);
  schema.pre('aggregate', function(next) {
    const t = this.options?.tenantId;
    if (!t) return next(new Error('Missing tenantId in aggregate options'));
    this.pipeline().unshift({ $match: { tenantId: t } });
    next();
  });
}
```

> Uso: `Model.find(criteria, null, { tenantId })`

**3) Socket.IO – room com prefixo de tenant:**

```js
io.on('connection', (socket) => {
  const { token, tenantId } = socket.handshake.auth || {};
  // validar token (tenant do token == tenantId)
  socket.join(`tenant:${tenantId}:agent:${userId}`); // se for atendente
  // quando entrar num chat:
  socket.join(`tenant:${tenantId}:chat:${chatId}`);
});
```

---

# Plano de migração seguro (se já há dados)

1. Criar coleção `tenants` e registrar pelo menos 1 tenant “default” (para dados existentes).
2. Adicionar `tenantId` a **todas** as coleções (migration/backfill) → setar para “default”.
3. Criar índices compostos (únicos por tenant).
4. Liberar o middleware de tenant (modo **compat**: aceitar fallback “default” se não vier host/header).
5. Adaptar front para enviar/derivar tenant.
6. Forçar modo estrito (quebrar requisições sem tenant) **depois** que o front estiver pronto.
7. Habilitar logs/alertas por tenant e validar dashboards.

---

# O que vale medir (para saber se deu certo)

* % de consultas **sem** `tenantId` (alvo: 0% em produção).
* Latência média de `accept chat` e **% de colisões evitadas**.
* Erros de permissão (token-tenant mismatch).
* Tráfego e custo S3 por tenant.
* SLA de entrega de mensagem por Socket (P95/P99) por tenant.

---
