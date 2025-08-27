<ProjectManifest repo="rafabrdev/chat-atendimento" branch="develop" generated="2025-08-27">

  <!-- META / ORDEM -->
  <ExecutionOrder>
    <Step>1 - Backend: Tenant infra e scoping</Step>
    <Step>2 - Backend: Auth/JWT + Socket + S3 + Atomic ops</Step>
    <Step>3 - Backend: Migrations, indices, plugin</Step>
    <Step>4 - Frontend: Centralized auth, socket singleton, tenant provider</Step>
    <Step>5 - Frontend: Queries, feature gating, uploads, UI error handling</Step>
    <Step>6 - Tests E2E / Concurrency / Observability</Step>
    <Step>7 - DevOps: Docker, SSL, Deploy scripts</Step>
    <Step>8 - LGPD: legal docs, consent, DSR endpoints, DPA</Step>
    <Step>9 - Security hardening & production checklist</Step>
  </ExecutionOrder>

  <!-- 1: TENANT INFRA (backend) -->
  <Task id="B01" name="CreateTenantsCollectionAndSeed" priority="high" status="COMPLETED">
    <FilesToCreateOrEdit>
      <File>backend/models/Tenant.js</File>
      <File>backend/scripts/seedTenants.js</File>
      <File>backend/config/tenants.json</File>
    </FilesToCreateOrEdit>
    <Objective>
      Add a canonical tenants collection storing: key, name, allowedOrigins, plan, limits, branding, webhooks, status, createdAt, updatedAt.
      Seed a tenant "default" for migration fallback.
    </Objective>
    <Steps>
      <Step>Implement Tenant mongoose model with validations and indexes (unique key).</Step>
      <Step>Create seed script that inserts 'default' tenant (use env var TENANT_DEFAULT_KEY).</Step>
      <Step>Cache tenant metadata in memory + optional Redis (configurable).</Step>
    </Steps>
    <Validation>
      <Check>Run `node backend/scripts/seedTenants.js` -> tenant exists in DB.</Check>
      <Check>GET /tenants/:key (new endpoint) returns tenant object (status 200).</Check>
    </Validation>
    <Commands>
      <Command>cd backend && node scripts/seedTenants.js</Command>
      <Command>curl http://localhost:5000/tenants/default</Command>
    </Commands>
  </Task>

  <!-- 2: TENANT RESOLUTION MIDDLEWARE -->
  <Task id="B02" name="TenantResolverMiddleware" priority="high" status="COMPLETED">
    <FilesToCreateOrEdit>
      <File>backend/middleware/tenantResolver.js</File>
      <File>backend/server.js</File>
      <File>backend/socket/index.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Resolve tenant by subdomain -> header X-Tenant-ID -> URL path fallback. Inject req.tenant and req.tenantId. Deny requests if tenant missing and strict mode enabled.
    </Objective>
    <Steps>
      <Step>Create middleware: read host, parse subdomain, fallback to X-Tenant-ID header.</Step>
      <Step>Lookup tenant in cache/db; attach req.tenant and req.tenantId.</Step>
      <Step>Apply middleware globally (app.use) before routes and on socket handshake (socket.handshake.headers or socket.handshake.auth).</Step>
      <Step>Support dev fallback for `default` tenant via env var for migration grace period.</Step>
    </Steps>
    <Validation>
      <Check>Request with Host: tenantkey.localhost returns appropriate req.tenant in logs.</Check>
      <Check>socket connection with auth.tenantId is accepted and socket.handshake.tenant is set.</Check>
    </Validation>
    <Commands>
      <Command>Run server and verify `curl -H "Host: mytenant.localhost" http://localhost:5000/health` logs tenantId</Command>
    </Commands>
  </Task>

  <!-- 3: MONGOOSE PLUGIN tenantScope -->
  <Task id="B03" name="MongooseTenantScopePlugin" priority="high" status="COMPLETED">
    <FilesToCreateOrEdit>
      <File>backend/models/plugins/tenantScope.js</File>
      <Search>backend/models/*.js</Search>
    </FilesToCreateOrEdit>
    <Objective>
      Plugin automatically enforces tenantId on schema, pre-appends tenantId match to find/findOne/update/aggregate, prevents queries without tenantId (strict mode opt-in).
    </Objective>
    <Steps>
      <Step>Implement plugin adding tenantId field and pre hooks for find/findOne/updateMany/count/aggregate.</Step>
      <Step>Apply plugin to all domain models (User, Chat, Message, Attachment, Settings).</Step>
      <Step>Provide option to disable on admin-only models like Tenants.</Step>
    </Steps>
    <Validation>
      <Check>Create sample Chat via model.create without tenantId -> plugin must throw (or auto-insert from context if mode enabled).</Check>
    </Validation>
    <Commands>
      <Command>Run Node REPL to test mongoose models with plugin</Command>
    </Commands>
  </Task>

  <!-- 4: MODELS REFATOR (tenantId + indices) -->
  <Task id="B04" name="RefactorModelsAddTenantIdAndIndices" priority="high" status="COMPLETED">
    <FilesToEdit>
      <File>backend/models/User.js</File>
      <File>backend/models/Chat.js</File>
      <File>backend/models/Message.js</File>
      <File>backend/models/Attachment.js</File>
      <File>backend/models/Setting.js</File>
    </FilesToEdit>
    <Objective>
      Add tenantId required field; add composite indexes (unique by tenant where applicable).
    </Objective>
    <Steps>
      <Step>User: add tenantId, composite unique index {tenantId, email}.</Step>
      <Step>Chat: add tenantId, index {tenantId, status, createdAt} for queue performance.</Step>
      <Step>Message: add tenantId, index {tenantId, chatId, createdAt}.</Step>
      <Step>Attachment: add tenantId; ensure metadata saved with tenantId and S3 key includes tenantId.</Step>
      <Step>Settings: composite unique {tenantId, key}.</Step>
      <Step>Create migration script to backfill tenantId='default' for existing docs and create indices.</Step>
    </Steps>
    <Validation>
      <Check>Run migration/backfill script; verify existing docs have tenantId.</Check>
      <Check>Indices created in Mongo (showIndexes).</Check>
    </Validation>
    <Commands>
      <Command>node backend/scripts/backfillTenantId.js</Command>
      <Command>mongo --eval "db.chats.getIndexes()"</Command>
    </Commands>
  </Task>

  <!-- 5: JWT & AUTH ADAPTATIONS -->
  <Task id="B05" name="JWTIncludeTenantRolesAndGuards" priority="high" status="COMPLETED">
    <FilesToCreateOrEdit>
      <File>backend/services/authService.js</File>
      <File>backend/middleware/auth.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      JWT payload must include tenantId, roles (['agent'|'tenant-admin'|'super-admin']) and scopes. Authorization middleware must validate token tenantId == req.tenantId.
    </Objective>
    <Steps>
      <Step>Modify token issuance to include tenantId and roles.</Step>
      <Step>Modify auth middleware to compare token.tenantId with resolved req.tenantId.</Step>
      <Step>Provide upgrade path: support legacy tokens until migration window closes.</Step>
    </Steps>
    <Validation>
      <Check>Login returns token containing tenantId. Connect with mismatched token and tenant -> 403.</Check>
    </Validation>
  </Task>

  <!-- 6: SOCKET.IO - TENANT NAMESPACES + REDIS ADAPTER -->
  <Task id="B06" name="SocketIOIsolationAndRedisAdapter" priority="high" status="COMPLETED">
    <FilesToEdit>
      <File>backend/socket/index.js</File>
      <File>backend/server.js</File>
      <File>docker-production.yml</File>
    </FilesToEdit>
    <Objective>
      Ensure events are scoped by tenant via namespace `/t/:tenantId` or by room prefix `tenant:{tenantId}:...`. Add Redis adapter for horizontal scaling and include tenantId in pub/sub channel routing.
    </Objective>
    <Steps>
      <Step>On connection validate JWT and tenant match; store socket.tenantId.</Step>
      <Step>Use rooms `tenant:{tenantId}:chat:{chatId}` and enforce in handlers.</Step>
      <Step>Integrate `socket.io-redis` adapter and ensure adapter channels include tenant namespace to avoid cross-tenant event mix.</Step>
    </Steps>
    <Validation>
      <Check>Connect two sockets belonging to different tenants, emit at chat room of tenant A -> only tenant A receives.</Check>
    </Validation>
  </Task>

  <!-- 7: S3 UPLOADS - TENANT PREFIX + POLICIES -->
  <Task id="B07" name="S3TenantPrefixAndPresignedURLs" priority="high" status="COMPLETED">
    <FilesToEdit>
      <File>backend/services/s3Service.js</File>
      <File>backend/controllers/attachments.js</File>
    </FilesToEdit>
    <Objective>
      All objects must be stored under `{tenantId}/{year}/{month}/{uuid}_{filename}`. Presigned URL generation must validate tenant and content-type allowed.
    </Objective>
    <Steps>
      <Step>Modify upload paths to include tenantId.</Step>
      <Step>Save S3 key and tenantId in Attachment model.</Step>
      <Step>Implement server-side validation of content-type and file size limits based on tenant plan.</Step>
    </Steps>
    <Validation>
      <Check>Upload returns key containing tenantId. S3 shows folder per tenant.</Check>
    </Validation>
  </Task>

  <!-- 8: ATOMIC CHAT ACCEPTANCE (BACKEND) -->
  <Task id="B08" name="AtomicChatAcceptEndpoint" priority="high" status="COMPLETED">
    <FilesToEdit>
      <File>backend/controllers/chatController.js</File>
      <File>backend/routes/chat.js</File>
    </FilesToEdit>
    <Objective>
      Ensure `PATCH /api/chat/:id/accept` uses `findOneAndUpdate` with filter { _id, tenantId, status: 'pending' } -> set status:'active', agentId. Return 200 or 409.
    </Objective>
    <Steps>
      <Step>Refactor accept logic to be atomic and idempotent.</Step>
      <Step>Emit socket event to room `tenant:{tenantId}:chat:{chatId}` only after successful update.</Step>
    </Steps>
    <Validation>
      <Check>Two simultaneous accept requests -> one 200, other 409. Database state consistent.</Check>
    </Validation>
  </Task>

  <!-- 9: BACKEND - CORS DYNAMIC PER TENANT -->
  <Task id="B09" name="DynamicCORSPerTenant" priority="medium" status="COMPLETED">
    <FilesToEdit>
      <File>backend/config/cors.js</File>
      <File>backend/middleware/tenantResolver.js</File>
    </FilesToEdit>
    <Objective>
      Validate Origin against tenant.allowedOrigins; fallback to global ALLOWED_ORIGINS for admin endpoints.
    </Objective>
    <Steps>
      <Step>Implement dynamic CORS middleware that queries tenant.allowedOrigins.</Step>
      <Step>Allow localhost dev origins for develop branch.</Step>
    </Steps>
    <Validation>
      <Check>Requests from unauthorized origin receive CORS blocked response.</Check>
    </Validation>
  </Task>

  <!-- 10: BACKEND - LOGGING & OBSERVABILITY -->
  <Task id="B10" name="StructuredLoggingWithTenantAndRequestId" priority="medium" status="COMPLETED">
    <FilesToEdit>
      <File>backend/middleware/logger.js</File>
      <File>backend/config/logger.js</File>
    </FilesToEdit>
    <Objective>
      Include tenantId and requestId in all logs. Add health/check endpoints for tenant-specific metrics.
    </Objective>
    <Steps>
      <Step>Add requestId middleware and attach to req.log meta.</Step>
      <Step>Ensure logger outputs JSON with tenantId and requestId (for CloudWatch/Datadog).</Step>
    </Steps>
    <Validation>
      <Check>Logs include tenantId for sample request (curl).</Check>
    </Validation>
    <CompletionDate>2025-08-27</CompletionDate>
    <Implementation>
      <File>backend/services/loggingService.js - Winston logger com rotação diária</File>
      <File>backend/middleware/requestLogging.js - Middleware com requestId automático</File>
      <File>backend/routes/monitoringRoutes.js - Endpoints de monitoramento e métricas</File>
      <Feature>Logs estruturados JSON com tenantId e requestId</Feature>
      <Feature>Rotação diária de logs com compressão</Feature>
      <Feature>Métricas Prometheus integradas</Feature>
      <Feature>Dashboard de monitoramento em tempo real</Feature>
    </Implementation>
  </Task>

  <!-- 11: FRONTEND - CENTRALIZE API + REFRESH W/QUEUE -->
  <Task id="F01" name="FrontendApiInterceptorAndRefreshQueue" priority="high" status="COMPLETED">
    <FilesToCreateOrEdit>
      <File>frontend/src/services/api.js</File>
      <File>frontend/src/services/authService.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Single axios instance with request interceptor to attach accessToken and response interceptor to handle refresh token queue/lock. Map backend error codes to UI behaviors.
    </Objective>
    <Steps>
      <Step>Implement queue logic to prevent multiple concurrent /auth/refresh calls.</Step>
      <Step>Centralize token storage interface (authService) to read/write tokens (later swap to httpOnly cookie).</Step>
      <Step>Map TENANT_INACTIVE -> modal + logout; SUBSCRIPTION_SUSPENDED -> show upgrade CTA; PLAN_LIMIT_REACHED -> block action with toast.</Step>
    </Steps>
    <Validation>
      <Check>Simulate 10 concurrent requests with expired token -> only 1 refresh network call.</Check>
    </Validation>
    <Commands>
      <Command>cd frontend && npm run dev; use network tab to validate</Command>
    </Commands>
    <CompletionDate>2025-08-27</CompletionDate>
    <Implementation>
      <File>frontend/src/services/authService.js - Serviço de auth com refresh queue</File>
      <File>frontend/src/config/api.js - Interceptors avançados com error mapping</File>
      <File>frontend/src/context/AuthContext.jsx - Integração com authService</File>
      <File>frontend/src/components/Testing/RefreshTokenTest.jsx - Componente de teste</File>
      <Feature>Refresh token queue previne múltiplas chamadas concorrentes</Feature>
      <Feature>Auto-refresh 1 minuto antes do token expirar</Feature>
      <Feature>Mapeamento completo de códigos de erro para ações UI</Feature>
      <Feature>Request ID automático em todos os headers</Feature>
      <Feature>Teste visual com simulação de 10 requests concorrentes</Feature>
    </Implementation>
    <ErrorMapping>
      <Error code="TENANT_INACTIVE" action="Modal + Logout"/>
      <Error code="SUBSCRIPTION_SUSPENDED" action="Toast com CTA de upgrade"/>
      <Error code="PLAN_LIMIT_REACHED" action="Toast + Bloqueia ação"/>
      <Error code="MODULE_DISABLED" action="Toast informativo"/>
      <Error code="TOKEN_EXPIRED" action="Auto refresh transparente"/>
      <Error code="RATE_LIMIT_EXCEEDED" action="Toast com tempo de espera"/>
    </ErrorMapping>
  </Task>

  <!-- 12: FRONTEND - SOCKET SINGLETON & AUTH -->
  <Task id="F02" name="FrontendSocketSingleton" priority="high" status="COMPLETED">
    <FilesToCreateOrEdit>
      <File>frontend/src/services/socketService.js</File>
      <File>frontend/src/hooks/useSocketService.js</File>
      <File>frontend/src/components/Testing/SocketServiceTest.jsx</File>
    </FilesToCreateOrEdit>
    <Objective>
      Create a single socket instance factory createSocket({tenantId}) that attaches auth { token, tenantId } and reconnects after token refresh. Replace direct io() calls across the codebase.
    </Objective>
    <Steps>
      <Step>Implement createSocket / disconnectSocket and export useSocket hook.</Step>
      <Step>Search & replace any direct `io(` usage to import singleton.</Step>
      <Step>On token refresh, update socket.auth and reconnect gracefully.</Step>
    </Steps>
    <Validation>
      <Check>grep -R "io(" in frontend returns only socket.js (or ignored exceptions).</Check>
    </Validation>
    <CompletionDate>2025-08-27</CompletionDate>
    <Implementation>
      <File>frontend/src/services/socketService.js - Singleton Socket.IO com autenticação completa</File>
      <File>frontend/src/hooks/useSocketService.js - Hook React para integração</File>
      <File>frontend/src/components/Testing/SocketServiceTest.jsx - Suite de testes visuais</File>
      <Feature>Singleton pattern para instância global do Socket.IO</Feature>
      <Feature>Integração completa com AuthService para refresh token</Feature>
      <Feature>Reconexão automática após refresh do token</Feature>
      <Feature>Tenant-aware: todos eventos incluem tenantId no metadata</Feature>
      <Feature>Rooms/namespaces isolados por tenant</Feature>
      <Feature>Fila de eventos durante desconexão</Feature>
      <Feature>Heartbeat e auto-sync com retry exponencial</Feature>
      <Feature>Debug mode com logs detalhados em desenvolvimento</Feature>
    </Implementation>
    <TestCoverage>
      <Test>Conexão/desconexão/reconexão</Test>
      <Test>Emit de eventos com queue</Test>
      <Test>Join/leave rooms tenant-aware</Test>
      <Test>Reconexão após token refresh</Test>
      <Test>Fila de eventos processada após reconexão</Test>
      <Test>Isolamento entre tenants</Test>
    </TestCoverage>
  </Task>

  <!-- 13: FRONTEND - TenantProvider, Branding & FeatureGate -->
  <Task id="F03" name="TenantProviderBrandingFeatureGate" priority="high" status="COMPLETED">
    <FilesToCreateOrEdit>
      <File>frontend/src/providers/TenantProvider.jsx</File>
      <File>frontend/src/components/FeatureGate.jsx</File>
      <File>frontend/src/main.jsx</File>
    </FilesToCreateOrEdit>
    <Objective>
      Resolve tenant by subdomain using `GET /tenants/resolve?key=...`, load branding, allowedModules, plan info. Provide FeatureGate to hide/disable modules not in plan.
    </Objective>
    <Steps>
      <Step>Create TenantProvider to fetch tenant and set CSS variables for branding.</Step>
      <Step>Create FeatureGate component reading tenant.allowedModules or plan limits.</Step>
      <Step>Wrap app root with TenantProvider and ensure hooks use it for tenantId injection.</Step>
    </Steps>
    <Validation>
      <Check>Header shows tenant.name and plan; toggling allowedModules hides UI modules.</Check>
    </Validation>
    <CompletionDate>2025-08-27</CompletionDate>
    <Implementation>
      <File>frontend/src/providers/TenantProvider.jsx - Provider com contexto global de tenant</File>
      <File>frontend/src/components/FeatureGate.jsx - Componente para controle de features</File>
      <File>frontend/src/components/Testing/TenantProviderTest.jsx - Componente de teste</File>
      <Feature>Resolução de tenant por subdomínio ou query param</Feature>
      <Feature>Aplicação automática de branding (cores e fontes)</Feature>
      <Feature>FeatureGate com controle por plano e status</Feature>
      <Feature>Componentes auxiliares: FeatureButton, FeatureBadge, PlanLimit</Feature>
      <Feature>TenantStatusGate para controle por status do tenant</Feature>
      <Feature>Tolerância a erros em rotas públicas</Feature>
    </Implementation>
  </Task>

  <!-- 14: FRONTEND - React Query Keys & Cache Isolation -->
  <Task id="F04" name="ReactQueryTenantKeyIntegration" priority="high">
    <FilesToSearch>
      <Search>frontend/src/**</Search>
    </FilesToSearch>
    <Objective>
      Ensure each useQuery / mutation includes tenantId in the key to prevent cross-tenant cache reuse.
    </Objective>
    <Steps>
      <Step>Scan codebase for useQuery( and update keys to include tenant.id (['resource', tenantId]).</Step>
      <Step>Refactor common query wrappers to inject tenantId automatically.</Step>
    </Steps>
    <Validation>
      <Check>Simulate login as tenant A then tenant B; verify no cached chats/messages from tenant A appear in tenant B.</Check>
    </Validation>
  </Task>

  <!-- 15: FRONTEND - UploadService (S3) -->
  <Task id="F05" name="FrontendUploadServicePrefixTenant" priority="medium">
    <FilesToCreateOrEdit>
      <File>frontend/src/services/uploadService.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Centralize upload logic and ensure client requests presigned URLs for keys with tenantId prefix. Validate file type and size before request.
    </Objective>
    <Steps>
      <Step>Create service that requests presigned URL providing filename, contentType; server returns URL and key with tenantId prefix.</Step>
      <Step>Replace direct upload calls across frontend components to use this service.</Step>
    </Steps>
    <Validation>
      <Check>Uploaded S3 key contains tenantId and content-type validated.</Check>
    </Validation>
  </Task>

  <!-- 16: FRONTEND - Global Error Handler & Codes -->
  <Task id="F06" name="FrontendGlobalErrorHandling" priority="medium">
    <FilesToCreateOrEdit>
      <File>frontend/src/components/ErrorBoundary.jsx</File>
      <File>frontend/src/services/api.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Centralize mapping of backend error codes to UI actions. Provide ErrorBoundary for React runtime errors.
    </Objective>
    <Steps>
      <Step>Map TENANT_INACTIVE -> show modal, call logout. SUBSCRIPTION_SUSPENDED -> show plan upgrade CTA. PLAN_LIMIT_REACHED -> show toast + block action.</Step>
      <Step>Ensure Socket errors like 'tenant suspended' are shown centrally and socket disconnected.</Step>
    </Steps>
    <Validation>
      <Check>Simulated responses produce expected UI flows.</Check>
    </Validation>
  </Task>

  <!-- 17: FRONTEND - Accept Chat UI Concurrency -->
  <Task id="F07" name="AcceptChatUIAtomicHandling" priority="medium">
    <FilesToEdit>
      <File>frontend/src/pages/chat/ChatList.jsx</File>
      <File>frontend/src/pages/chat/ChatRoom.jsx</File>
    </FilesToEdit>
    <Objective>
      Accept chat waits for server response and handles 200/409 and updates UI via socket events only after server confirmation.
    </Objective>
    <Steps>
      <Step>Change accept button to await `PATCH /api/chat/:id/accept` and disable button while pending.</Step>
      <Step>On 409 show 'already accepted' modal and refresh list.</Step>
    </Steps>
    <Validation>
      <Check>Simultaneous accepts -> one success, one conflict message.</Check>
    </Validation>
  </Task>

  <!-- 18: TESTS - Unit / Integration / E2E -->
  <Task id="T01" name="AddTestsForMultiTenantFlows" priority="high">
    <FilesToCreateOrEdit>
      <File>backend/tests/chat.accept.test.js</File>
      <File>frontend/cypress/integration/multi_tenant_spec.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Create tests that validate tenant scoping, socket isolation, atomic chat acceptance, and token refresh queue behaviour.
    </Objective>
    <Steps>
      <Step>Backend: jest/integration test simulating two agents accept same chat.</Step>
      <Step>Frontend: Cypress E2E test simulating two browser sessions for different tenants and verifying isolation.</Step>
    </Steps>
    <Validation>
      <Check>CI job runs tests on PR and passes.</Check>
    </Validation>
    <Commands>
      <Command>npm run test (backend)</Command>
      <Command>npx cypress open (frontend)</Command>
    </Commands>
  </Task>

  <!-- 19: DEVOPS - Docker, SSL, Traefik/Nginx, Env -->
  <Task id="D01" name="ProvisionSSLAndUpdateDeployScripts" priority="high">
    <FilesToEdit>
      <File>docker-production.yml</File>
      <File>deploy-production.ps1</File>
      <File>README.md</File>
    </FilesToEdit>
    <Objective>
      Automate SSL issuance (Let's Encrypt via Traefik or Certbot), ensure docker stacks expose appropriate ports and environment variables for tenants (e.g., wildcard subdomains).
    </Objective>
    <Steps>
      <Step>Choose reverse-proxy (Traefik recommended) config with ACME for wildcard support.</Step>
      <Step>Update deploy scripts to include obtaining certs + reload proxy.</Step>
      <Step>Update README deploy steps and healthchecks.</Step>
    </Steps>
    <Validation>
      <Check>After deploy, https://suporte.brsi.net.br loads with valid cert (test with sslscan or openssl s_client).</Check>
    </Validation>
  </Task>

  <!-- 20: LGPD - PRIVACY, CONSENT, DSR -->
  <Task id="L01" name="PrivacyPolicyAndTerms" priority="high">
    <FilesToCreateOrEdit>
      <File>docs/PRIVACY_POLICY.md</File>
      <File>docs/TERMS_OF_SERVICE.md</File>
      <File>frontend/src/pages/Privacy.jsx</File>
    </FilesToCreateOrEdit>
    <Objective>
      Produce legal texts (Privacy Policy, Terms) covering data controllers, purposes, legal bases, rights, retention, transfers, DPO contact, subprocessors. Version files and expose via /privacy and footer link.
    </Objective>
    <Steps>
      <Step>Draft Privacy Policy with LGPD specific sections: basis legal, rights, judicial/admin contact, DPO.</Step>
      <Step>Expose GET /privacy endpoint returning latest version and store version history in DB.</Step>
    </Steps>
    <Validation>
      <Check>Policy accessible and version present in DB.</Check>
    </Validation>
  </Task>

  <Task id="L02" name="ConsentBannerAndConsentDB" priority="high">
    <FilesToCreateOrEdit>
      <File>frontend/src/components/CookieConsent.jsx</File>
      <File>backend/models/Consent.js</File>
      <File>backend/routes/consents.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Implement consent banner with granular consent (essential, analytics, marketing). Store consent records (tenantId, userId/null, purpose, grantedAt, ip, ua, version). Provide revoke endpoint.
    </Objective>
    <Steps>
      <Step>Implement CookieConsent UI with toggles and 'Save' that calls backend to persist consent.</Step>
      <Step>Backend route `POST /consents` to save and `GET /consents?userId=` to list/rescind.</Step>
    </Steps>
    <Validation>
      <Check>Consent record created in DB; analytics calls blocked unless consent true.</Check>
    </Validation>
  </Task>

  <Task id="L03" name="DataSubjectRequestEndpoints" priority="high">
    <FilesToCreateOrEdit>
      <File>backend/routes/dsr.js</File>
      <File>backend/models/DSRRequest.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Implement endpoints for subject rights: request creation, admin processing, export (portability), and deletion (soft+hard with retention exceptions). Provide webhook/email notification to tenant admins.
    </Objective>
    <Steps>
      <Step>POST /dsr/request {type: export|delete|correction, userId, details}</Step>
      <Step>Admin panel action to process and mark completed; generate export file and store audit log.</Step>
    </Steps>
    <Validation>
      <Check>Request persisted; admin can mark processed and export user data JSON.</Check>
    </Validation>
  </Task>

  <Task id="L04" name="DPAAndSubprocessorsDocs" priority="medium">
    <FilesToCreateOrEdit>
      <File>docs/DPA_TEMPLATE.md</File>
      <File>docs/SUBPROCESSORS.md</File>
    </FilesToCreateOrEdit>
    <Objective>
      Provide Data Processing Agreement template and list of subprocessors (AWS S3, MongoDB Atlas, Sendgrid/Stripe etc.) with countries and transfer notes.
    </Objective>
    <Steps>
      <Step>Draft DPA with responsibilities, security measures, deletion upon termination, subprocessors and transfer clauses.</Step>
      <Step>Expose to tenants during onboarding (link + accept checkbox).</Step>
    </Steps>
    <Validation>
      <Check>Documents present in docs/ and referenced in onboarding UI.</Check>
    </Validation>
  </Task>

  <!-- 21: LGPD TECHNICAL - LOGS, RETENTION, PSEUDONYM -->
  <Task id="L05" name="RetentionAndPseudonymization" priority="medium">
    <FilesToCreateOrEdit>
      <File>backend/services/dataRetentionService.js</File>
      <File>backend/jobs/purgeOldData.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Implement retention policies per tenant (configurable), background job for purge/anonymize, and pseudonymize analytics (hash userId).
    </Objective>
    <Steps>
      <Step>Implement job runner (cron) that enforces retention rules.</Step>
      <Step>Implement pseudonymization for analytics exports (hashed user identifiers).</Step>
    </Steps>
    <Validation>
      <Check>Purge job runs in staging and marks/anonymizes old data per tenant policy.</Check>
    </Validation>
  </Task>

  <!-- 22: SECURITY HARDENING -->
  <Task id="S01" name="SecurityHardeningProduction" priority="high">
    <FilesToCreateOrEdit>
      <File>docker-production.yml</File>
      <File>backend/config/security.js</File>
    </FilesToCreateOrEdit>
    <Objective>
      Enforce HTTPS, enable server-side S3 encryption, enable MongoDB encryption options, rotate secrets, set secure httpOnly cookie for refreshToken, apply Helmet, rate-limits and input validation (Zod/Joi).
    </Objective>
    <Steps>
      <Step>Change refreshToken storage approach to httpOnly cookie set on login endpoint; update frontend to use cookie flow for refresh.</Step>
      <Step>Enable Helmet, limit payload sizes, sanitize inputs.</Step>
      <Step>Use Secrets Manager for envs, configure KMS for S3/Mongo encryption keys.</Step>
    </Steps>
    <Validation>
      <Check>Cookies are httpOnly and secure; refresh flow works via cookie; app only accessible via HTTPS.</Check>
    </Validation>
  </Task>

  <!-- 23: DEPLOY CHECKLIST -->
  <Task id="D02" name="ProductionReadinessChecklist" priority="high">
    <Objective>
      Final checklist to allow production deploy in Brazil.
    </Objective>
    <Steps>
      <Step>Complete SSL & DNS (hostinger) setup and verify certs.</Step>
      <Step>Complete secrets rotation and store secrets in AWS Secrets Manager / GitHub Secrets.</Step>
      <Step>Enable monitoring (CloudWatch/Datadog) for latency and errors per tenant.</Step>
      <Step>Run backup & restore test for Mongo (restore to staging).</Step>
      <Step>Run penetration scan / dependency audit (npm audit + Snyk or similar).</Step>
    </Steps>
    <Validation>
      <Check>All above steps marked done; smoke tests passed on staging.</Check>
    </Validation>
  </Task>

  <!-- 24: AUTOMATION / AGENT CHECKS -->
  <Task id="A01" name="AutomatedAuditScript" priority="low">
    <FilesToCreate>
      <File>tools/audit-multitenant.sh</File>
    </FilesToCreate>
    <Objective>
      Create a script that scans frontend/backend for common pitfalls:
      - direct `io(` calls
      - uses of localStorage for refreshToken
      - useQuery without tenant key
      - upload calls missing tenant prefix
    </Objective>
    <Steps>
      <Step>Implement grep-based checks + counts and output CSV report.</Step>
      <Step>Run script and create issue list for found occurrences.</Step>
    </Steps>
    <Validation>
      <Check>Script runs locally and outputs actionable list.</Check>
    </Validation>
  </Task>

  <!-- 25: DOCUMENTATION & ONBOARDING -->
  <Task id="DOC1" name="UpdateREADMEAndPROJECT_ARCHITECTURE" priority="low">
    <FilesToEdit>
      <File>README.md</File>
      <File>PROJECT_ARCHITECTURE.md</File>
      <File>docs/SETUP_LGPD.md</File>
    </FilesToEdit>
    <Objective>
      Document multi-tenant architecture, deployment steps, LGPD compliance summary and how to onboard new tenant (DPA acceptance).
    </Objective>
    <Validation>
      <Check>README updated with tenant resolution instructions and DNS/SSL steps.</Check>
    </Validation>
  </Task>

  <!-- VALIDATION / GATES SUMMARY -->
  <ValidationGates>
    <Gate taskId="B03">Plugin verified + models updated + migration successful</Gate>
    <Gate taskId="B06">Socket isolation confirmed in multi-instance (Redis) environment</Gate>
    <Gate taskId="F01">Refresh queue test: 10 concurrent requests -> 1 refresh call</Gate>
    <Gate taskId="T01">Critical tests (accept concurrency, socket isolation) pass in CI</Gate>
    <Gate taskId="D02">SSL + monitoring + backup tests passed</Gate>
    <Gate taskId="L03">DSR flow tested and admin workflow functional</Gate>
  </ValidationGates>

  <!-- QUICK CHECKLIST FOR AGENT AFTER EACH TASK -->
  <PerTaskChecklist>
    <ChecklistItem>Run unit/integration tests for modified modules.</ChecklistItem>
    <ChecklistItem>Run linter (eslint / prettier) and fix warnings.</ChecklistItem>
    <ChecklistItem>Run `npm run build` for frontend to ensure Vite builds without errors.</ChecklistItem>
    <ChecklistItem>Create a PR per major task (B03, B04, F01, F02, L01-L03) with clear description and tests.</ChecklistItem>
  </PerTaskChecklist>

  <!-- NOTES TO AGENT: HOW TO VALIDATE TENANT SCOPING LOCALLY -->
  <LocalTenantValidation>
    <Step>Run backend in develop with env TENANT_DEFAULT_KEY=default.</Step>
    <Step>Seed default tenant and at least one other tenant (tenant-a).</Step>
    <Step>Run frontend and open two hosts (simulate subdomains with hosts file): tenant-a.localhost and default.localhost or use query param for testing.</Step>
    <Step>Verify isolation: create chat in tenant-a -> does not appear in default tenant list.</Step>
  </LocalTenantValidation>

  <!-- LEGAL REFERENCES (AGENT SHOULD INCLUDE LINKS TO AUTHORITATIVE SOURCES IN PR) -->
  <LegalReferences>
    <Reference>Lei nº 13.709/2018 (LGPD) - gov.br</Reference>
    <Reference>ANPD - Guidelines and FAQs</Reference>
    <Reference>ENISA / OWASP - Secure Development Practices</Reference>
  </LegalReferences>

  <!-- STATUS SUMMARY ADDED 2025-08-27 -->
  <StatusSummary>
    <TotalTasks>25</TotalTasks>
    <CompletedTasks>13</CompletedTasks>
    <InProgressTasks>0</InProgressTasks>
    <PendingTasks>12</PendingTasks>
    <Progress>52%</Progress>
    <LastUpdate>2025-08-27T19:56:00</LastUpdate>
    <NextTasks>
      <NextTask id="F04" name="ReactQueryTenantKeyIntegration" estimatedHours="1" note="Projeto não usa React Query ainda, pode ser pulada"/>
      <NextTask id="F05" name="FrontendUploadServicePrefixTenant" estimatedHours="2" note="Sistema de upload já existe e funciona com tenant"/>
      <NextTask id="F06" name="FrontendGlobalErrorHandling" estimatedHours="2"/>
      <NextTask id="F07" name="AcceptChatUIAtomicHandling" estimatedHours="1"/>
    </NextTasks>
    <CompletedBackendTasks>
      <Task>B01 - Tenant Model & Seed</Task>
      <Task>B02 - Tenant Resolver Middleware</Task>
      <Task>B03 - Mongoose Tenant Scope Plugin</Task>
      <Task>B04 - Models Refactor with TenantId</Task>
      <Task>B05 - JWT Include Tenant & Roles</Task>
      <Task>B06 - Socket.IO Isolation & Redis</Task>
      <Task>B07 - S3 Tenant Prefix</Task>
      <Task>B08 - Atomic Chat Accept</Task>
      <Task>B09 - Dynamic CORS per Tenant</Task>
      <Task>B10 - Structured Logging</Task>
    </CompletedBackendTasks>
    <CompletedFrontendTasks>
      <Task>F01 - API Interceptor & Refresh Queue</Task>
      <Task>F02 - Socket Singleton</Task>
      <Task>F03 - TenantProvider & FeatureGate</Task>
    </CompletedFrontendTasks>
  </StatusSummary>

</ProjectManifest>
