require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Importar middleware e configurações
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Importar rotas
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chatRoutes');
const fileRoutes = require('./routes/files');
const agentRoutes = require('./routes/agents');
const historyRoutes = require('./routes/history');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Conectar ao banco de dados
connectDB();

// Middleware de segurança e logging
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

// Rate limiting
app.use(generalLimiter);

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
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

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/history', historyRoutes);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Error handler middleware (deve ser o último)
app.use(errorHandler);

// Socket.io connection handling
const SocketHandlers = require('./socket/socketHandlers');
const socketHandlers = new SocketHandlers(io);

// Usar namespace root em vez de /chat para simplicidade
io.on('connection', (socket) => {
  socketHandlers.handleConnection(socket);
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
