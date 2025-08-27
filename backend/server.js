require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Importar middleware e configurações
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const { resolveTenant, applyTenantScope } = require('./middleware/tenantMiddlewareV2');
const { dynamicCors, validateTenantCors } = require('./middleware/dynamicCors');
const SocketTenantMiddleware = require('./middleware/socketTenantMiddleware');
const { mongooseTenantMiddleware } = require('./plugins/tenantScopePlugin');

// Importar rotas
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chatRoutes');
const fileRoutes = require('./routes/files');
const uploadRoutes = require('./routes/upload');
const agentRoutes = require('./routes/agents');
const historyRoutes = require('./routes/history');
const masterRoutes = require('./routes/master');
const stripeRoutes = require('./routes/stripe');
const buyRoutes = require('./routes/buy');
const corsRoutes = require('./routes/cors');
const monitoringRoutes = require('./routes/monitoringRoutes');
const tenantsRoutes = require('./routes/tenants');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io com CORS dinâmico
const io = socketIo(server, {
  cors: {
    origin: async (origin, callback) => {
      // Permitir todas as origens no Socket.IO
      // A validação será feita no middleware de autenticação
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  // Opções de performance
  pingTimeout: 10000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'] // Priorizar websocket
});

// Configurar Redis adapter para escalabilidade horizontal
if (process.env.REDIS_URL || process.env.ENABLE_REDIS_ADAPTER === 'true') {
  const { createAdapter } = require('@socket.io/redis-adapter');
  const { createClient } = require('redis');
  
  const pubClient = createClient({ 
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        console.error('[Redis] Connection refused');
        return new Error('Redis connection refused');
      }
      if (options.total_retry_time > 1000 * 60) {
        return new Error('Redis retry time exhausted');
      }
      if (options.attempt > 10) {
        return undefined;
      }
      return Math.min(options.attempt * 100, 3000);
    }
  });
  
  const subClient = pubClient.duplicate();
  
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Redis adapter configurado para Socket.IO');
  }).catch(err => {
    console.error('[Redis] Erro ao conectar:', err);
    console.log('⚠️  Socket.IO rodando sem Redis (modo single-server)');
  });
} else {
  console.log('📡 Socket.IO rodando em modo single-server (sem Redis)');
}

// Inicializar middleware de Socket.IO para tenant
const socketTenantMiddleware = new SocketTenantMiddleware();

// Conectar ao banco de dados
connectDB();

// Middleware de segurança e logging
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS dinâmico baseado em tenant
app.use(dynamicCors());

// Ativar fallback para tenant default durante migração
if (!process.env.USE_DEFAULT_TENANT_FALLBACK) {
  process.env.USE_DEFAULT_TENANT_FALLBACK = 'true';
}

// Rate limiting
app.use(generalLimiter);

// Parsing middleware - IMPORTANTE: Stripe webhook precisa de raw body
app.use((req, res, next) => {
  // Skip json parsing for Stripe webhook
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  }
}));

// Swagger Documentation
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
  const { setupSwagger } = require('./config/swagger');
  setupSwagger(app);
}

// Health check
/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Verificar status do servidor
 *     description: Retorna o status de saúde do servidor
 *     responses:
 *       200:
 *         description: Servidor funcionando corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Servidor funcionando
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: production
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Middleware de tenant removido do global
// Cada rota protegida aplica conditionalLoadTenant após auth
// Isso garante que req.user esteja disponível quando o tenant for carregado

// Mongoose Tenant Middleware - injeta contexto de tenant nos modelos
// IMPORTANTE: Deve vir DEPOIS do resolveTenant ser aplicado nas rotas
// Por isso não é global, mas aplicado em cada rota protegida
// app.use(mongooseTenantMiddleware); // Descomentar quando todas as rotas tiverem resolveTenant

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/upload', uploadRoutes); // Rotas de upload com presigned URLs
app.use('/api/agents', agentRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/master', masterRoutes); // Rotas master (sem tenant)
app.use('/api/stripe', stripeRoutes); // Rotas do Stripe (pagamentos)
app.use('/api/cors', corsRoutes); // Rotas de gerenciamento CORS
app.use('/api/monitoring', monitoringRoutes); // Rotas de monitoramento e observabilidade
app.use('/api/tenants', tenantsRoutes); // Rotas públicas de tenants

// Rota de compra (página HTML)
app.use('/buy', buyRoutes);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Error handler middleware (deve ser o último)
app.use(errorHandler);

// Socket.io connection handling com tenant
const SocketHandlers = require('./socket/socketHandlers');
const socketHandlers = new SocketHandlers(io, socketTenantMiddleware);

// Middleware de autenticação Socket.IO
io.use(async (socket, next) => {
  await socketTenantMiddleware.authenticate(socket, next);
});

// Usar namespace root em vez de /chat para simplicidade
io.on('connection', (socket) => {
  socketHandlers.handleConnection(socket);
  
  // Registrar disconnect no middleware de tenant
  socket.on('disconnect', () => {
    socketTenantMiddleware.unregisterConnection(socket.id);
  });
});

// Disponibilizar io para as rotas
app.set('io', io);
app.set('socketHandlers', socketHandlers);

// Iniciar servidor
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
🚀 Servidor rodando em http://localhost:${PORT}
📊 Environment: ${process.env.NODE_ENV}
🔗 Health check: http://localhost:${PORT}/health
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});
