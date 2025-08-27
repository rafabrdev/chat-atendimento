# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a **multi-tenant chat system** built with Node.js/Express backend and React frontend. The system supports multiple companies (tenants) with complete data isolation, real-time chat via Socket.IO, file uploads to AWS S3, and Stripe payment integration.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 MULTI-TENANT SYSTEM                     │
├─────────────────┬────────────────┬────────────────────────┤
│ Master Panel    │  Admin Panel   │    Agent/Client        │
│   (Master)      │    (Admin)     │    (Users)            │
└─────┬───────────┴────────┬───────┴────────┬───────────────┘
      │                    │                │
      ▼                    ▼                ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND (Node.js/Express)                  │
├─────────────────────────────────────────────────────────┤
│ Multi-Tenant │ Socket.IO │ JWT Auth │ AWS S3 │ Stripe    │
│ Isolation    │ Namespaces│ + Roles  │ Upload │ Payments  │
└────────────────┬──────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│               DATABASE (MongoDB)                        │
├─────────────────────────────────────────────────────────┤
│ Tenants │ Users │ Conversations │ Messages │ Files      │
│ (All collections have tenantId for isolation)           │
└─────────────────────────────────────────────────────────┘
```

## Key Development Commands

### Backend Development
```bash
# Install dependencies
cd backend
npm install

# Development with hot reload
npm run dev

# Production start
npm start

# Environment-specific starts
npm run staging
npm run prod

# Testing
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # With coverage report
npm run test:watch         # Watch mode

# Code quality
npm run lint               # ESLint check
npm run lint:fix          # Fix ESLint issues
npm run format            # Prettier formatting

# Database seeding
npm run seed              # Run all seeds
npm run seed:tenant       # Create default tenant
npm run seed:migrate      # Migrate existing data
```

### Frontend Development
```bash
# Install dependencies
cd frontend
npm install

# Development server (port 5173)
npm run dev
npm start

# Production build
npm run build

# Code quality
npm run lint

# Preview production build
npm run preview
```

### Docker Development
```bash
# Development environment (with hot reload)
docker-compose -f docker-dev.yml up -d

# Staging environment
docker-compose -f docker-staging.yml up -d

# Production environment
docker-compose -f docker-production.yml up -d

# View logs
docker-compose logs -f backend-dev
docker-compose logs -f frontend-dev
```

### Multi-Tenant Testing
```bash
cd backend

# Test tenant isolation
node tests/testMultiTenant.js

# Test socket isolation
node tests/testSocketIsolation.js

# Test chat accept concurrency
node tests/test-chat-atomicity.js
```

## Core Architecture Components

### 1. Multi-Tenant System
- **Tenant Resolution**: Middleware resolves tenant from subdomain/header (`tenantMiddlewareV2.js`)
- **Data Isolation**: Mongoose plugin (`tenantScopePlugin.js`) automatically adds `tenantId` to all queries
- **JWT with Tenant**: Tokens include `tenantId` and are validated against request tenant
- **Socket.IO Namespacing**: Rooms prefixed with `tenant:${tenantId}:chat:${chatId}`

### 2. User Roles & Permissions
- **master**: Global admin (no tenantId, can manage all tenants)
- **admin**: Tenant admin (can manage their company's users and settings)
- **agent**: Customer service agent (can handle chats within their tenant)
- **client**: End customer (can create chats within their tenant)

### 3. Real-time Chat System
- **Socket.IO**: Tenant-isolated namespaces and rooms
- **Chat Accept**: Atomic operations with Redis locks prevent double-accept
- **File Sharing**: S3 integration with tenant-prefixed paths
- **Typing Indicators**: Real-time typing status per conversation

### 4. File Management
- **S3 Structure**: `tenants/{tenantId}/{environment}/{category}/{year}/{month}/{filename}`
- **Tenant Isolation**: Files are isolated by tenant prefix
- **Security**: Pre-signed URLs with content-type validation
- **Storage Quotas**: Per-tenant storage limits and usage tracking

### 5. Monitoring & Observability
- **Winston Logging**: Structured logs with tenant context
- **Prometheus Metrics**: Application and business metrics
- **Health Checks**: Liveness and readiness probes
- **Request Tracing**: Each request has unique ID with tenant context

## Environment Configuration

### Required Environment Variables
```bash
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key

# AWS S3 (File Storage)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=secret...
S3_BUCKET=chat-atendimento-staging
S3_REGION=us-east-1

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional - Redis (for clustering and locks)
REDIS_URL=redis://localhost:6379

# CORS (for multi-tenant)
CLIENT_URL=https://yourdomain.com
```

### Environment Files Structure
- `.env.development` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

## Key Code Patterns

### 1. Tenant Context Usage
```javascript
// Controllers automatically get tenant from middleware
const { tenantId } = req;

// Use tenant options in queries (plugin handles this automatically)
const conversations = await Conversation.find({}, null, { tenantId });

// Socket.IO with tenant context
socket.join(`tenant:${tenantId}:chat:${chatId}`);
io.to(`tenant:${tenantId}:agent:${userId}`).emit('notification', data);
```

### 2. Multi-Tenant Safe Operations
```javascript
// Always use atomic operations for critical actions
const result = await Conversation.findOneAndUpdate(
  { _id: conversationId, tenantId, status: 'waiting' },
  { status: 'active', assignedAgent: agentId },
  { new: true }
);

// Use locks for race condition prevention
const lockKey = `chat:accept:${conversationId}`;
const acquired = await lockService.acquireLock(lockKey, 10000);
if (!acquired) throw new Error('Chat already being processed');
```

### 3. File Operations
```javascript
// S3 with tenant isolation
const s3Key = s3Service.generateS3Key(tenantId, 'documents', filename);
const uploadUrl = await s3Service.generatePresignedUrl(s3Key, 'PUT');

// Always validate tenant access to files
const hasAccess = s3Service.validateTenantAccess(fileKey, tenantId);
```

### 4. Error Handling Patterns
```javascript
// Tenant-aware error responses
if (!tenant) {
  return res.status(400).json({
    success: false,
    error: 'TENANT_REQUIRED',
    message: 'Tenant context is required'
  });
}

// Permission-based errors
if (user.tenantId !== tenantId) {
  return res.status(403).json({
    success: false,
    error: 'TENANT_ACCESS_DENIED',
    message: 'Access denied to this tenant'
  });
}
```

## Testing Strategy

### Unit Tests
- Service layer logic (lockService, corsService)
- Utility functions (tenant validation, S3 key generation)
- Middleware functions (tenant resolution, auth)

### Integration Tests
- Multi-tenant API endpoints
- Socket.IO tenant isolation
- File access permissions
- Chat accept atomicity

### Manual Testing Scripts
- `testMultiTenant.js` - Validates tenant isolation
- `testSocketIsolation.js` - Tests WebSocket isolation
- `test-chat-atomicity.js` - Concurrency testing

## Deployment Architecture

### Development
- Docker Compose with hot reload
- LocalStack for S3 simulation
- MailHog for email testing

### Staging/Production
- AWS EC2 deployment
- MongoDB Atlas
- AWS S3 for file storage
- GitHub Actions CI/CD

### Infrastructure Commands
```bash
# Deploy to staging
./deploy-staging.ps1

# Deploy to production (requires confirmation)
./deploy-production.ps1

# Manual server setup
ssh -i key.pem ec2-user@server-ip
```

## Security Considerations

### Multi-Tenant Security
- Data isolation enforced at database level via tenantId
- JWT tokens include and validate tenant context
- Socket.IO events isolated by tenant namespaces
- File access validated by tenant ownership

### Authentication & Authorization
- Role-based access control (RBAC)
- JWT with refresh tokens
- Password hashing with bcrypt
- Rate limiting per IP and tenant

### Data Protection
- Sensitive data sanitization in logs
- CORS configured per tenant's allowed origins
- Helmet.js for security headers
- Input validation with comprehensive schemas

## Common Troubleshooting

### Tenant Issues
```bash
# Check tenant resolution
curl -H "X-Tenant-ID: tenant123" http://localhost:5000/api/chat/queue

# Validate tenant exists in database
db.tenants.find({slug: "tenant-slug"})
```

### Socket.IO Issues
```bash
# Check socket connections by tenant
# In browser console:
io.engine.id // Get socket ID
// Check server logs for tenant assignment
```

### Multi-Tenant Data Leaks
```bash
# Run isolation tests
npm run test:integration

# Manual tenant isolation check
node tests/testMultiTenant.js
```

### Performance Issues
```bash
# Check Redis connection (if used)
redis-cli ping

# Monitor database queries
# Enable MongoDB profiler for slow queries

# Check metrics endpoint
curl http://localhost:5000/api/monitoring/metrics
```

## Key Files to Understand

### Backend Core
- `server.js` - Main server setup and middleware chain
- `middleware/tenantMiddlewareV2.js` - Tenant resolution logic
- `plugins/tenantScopePlugin.js` - Mongoose tenant isolation
- `services/chatService.js` - Chat business logic with atomicity
- `services/lockService.js` - Distributed locking system

### Multi-Tenant Infrastructure
- `models/Tenant.js` - Tenant data model
- `middleware/authMiddleware.js` - JWT validation with tenant
- `services/corsService.js` - Dynamic CORS per tenant
- `socket/socketHandlers.js` - WebSocket tenant isolation

### Frontend Architecture
- `src/App.jsx` - Main routing and authentication
- `src/context/AuthContext.jsx` - Authentication state
- `src/services/api.js` - HTTP client configuration
- `src/hooks/useSocket.js` - WebSocket connection management

This is a production-ready multi-tenant system with enterprise-grade security, observability, and scalability features. The architecture prioritizes data isolation, security, and maintainability while supporting real-time features and file management.
