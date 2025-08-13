# Sprint 1 - Setup Completo do Monorepo
## Passo a Passo do Zero ao Código Funcionando

---

## 🚀 Passo 1: Criando a Estrutura do Monorepo

### 1.1 Criando o diretório principal
```bash
mkdir chat-atendimento
cd chat-atendimento
```

### 1.2 Inicializando o projeto principal
```bash
npm init -y
```

### 1.3 Configurando Workspaces no package.json principal
```json
{
  "name": "chat-atendimento",
  "version": "1.0.0",
  "description": "Sistema de atendimento via live chat",
  "main": "index.js",
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "install:all": "npm install && npm install --workspace=backend && npm install --workspace=frontend"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  },
  "keywords": ["chat", "atendimento", "livechat"],
  "author": "Sua Empresa",
  "license": "ISC"
}
```

### 1.4 Instalando dependência para executar tudo junto
```bash
npm install concurrently --save-dev
```

---

## 🔧 Passo 2: Setup do Backend

### 2.1 Criando estrutura do backend
```bash
mkdir backend
cd backend
npm init -y
```

### 2.2 Instalando dependências do backend
```bash
# Dependências principais
npm install express mongoose bcryptjs jsonwebtoken cors dotenv helmet morgan express-rate-limit socket.io

# Dependências de desenvolvimento
npm install --save-dev nodemon eslint prettier eslint-config-prettier eslint-plugin-prettier
```

### 2.3 Configurando package.json do backend
```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "Backend do sistema de chat",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write ."
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "express-rate-limit": "^7.1.5",
    "socket.io": "^4.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.0"
  }
}
```

### 2.4 Criando estrutura de pastas do backend
```bash
mkdir config controllers middleware models routes utils
touch server.js
```

---

## 📁 Passo 3: Arquivos de Configuração do Backend

### 3.1 Arquivo: `backend/.env`
```env
# Configurações do Servidor
PORT=5000
NODE_ENV=development

# Configurações do Banco
MONGODB_URI=mongodb://localhost:27017/chat-atendimento
MONGODB_URI_TEST=mongodb://localhost:27017/chat-atendimento-test

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
JWT_EXPIRE=7d

# CORS
CLIENT_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3.2 Arquivo: `backend/.eslintrc.js`
```javascript
module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

### 3.3 Arquivo: `backend/.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 3.4 Arquivo: `backend/config/database.js`
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

## 🗄️ Passo 4: Modelos do Backend

### 4.1 Arquivo: `backend/models/User.js`
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Email inválido'
    ]
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    maxlength: [100, 'Nome muito longo']
  },
  role: {
    type: String,
    enum: ['client', 'agent', 'admin'],
    default: 'client'
  },
  profile: {
    phone: {
      type: String,
      default: ''
    },
    company: {
      type: String,
      default: ''
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para verificar senha
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para JSON (remover senha)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
```

### 4.2 Arquivo: `backend/models/Conversation.js`
```javascript
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'closed'],
    default: 'waiting'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  tags: [{
    type: String
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  feedback: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para performance
conversationSchema.index({ status: 1, createdAt: -1 });
conversationSchema.index({ assignedAgent: 1, status: 1 });
conversationSchema.index({ client: 1, createdAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
```

---

## 🛡️ Passo 5: Middleware do Backend

### 5.1 Arquivo: `backend/middleware/auth.js`
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// Middleware para verificar roles específicas
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado para este tipo de usuário'
      });
    }
    next();
  };
};

module.exports = { auth, authorize };
```

### 5.2 Arquivo: `backend/middleware/errorHandler.js`
```javascript
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error Stack:', err.stack);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Recurso não encontrado';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let message = 'Dados duplicados encontrados';
    
    if (err.keyPattern?.email) {
      message = 'Este email já está cadastrado';
    }
    
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = { message, statusCode: 401 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Erro interno do servidor'
  });
};

module.exports = errorHandler;
```

### 5.3 Arquivo: `backend/middleware/rateLimiter.js`
```javascript
const rateLimit = require('express-rate-limit');

// Rate limiter geral
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para autenticação (mais restritivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentativas por IP
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { generalLimiter, authLimiter };
```

---

## 🎮 Passo 6: Controllers do Backend

### 6.1 Arquivo: `backend/controllers/authController.js`
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Gerar JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Registrar usuário
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, profile } = req.body;

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }

    // Criar usuário
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'client',
      profile: profile || {}
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login usuário
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar campos obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }

    // Buscar usuário (incluindo senha para comparação)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar se conta está ativa
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }

    // Atualizar último login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: user.toJSON(), // Remove password
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter perfil do usuário logado
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Atualizar perfil do usuário
// @route   PATCH /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, profile } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name) updateData.name = name;
    if (profile) updateData.profile = { ...req.user.profile, ...profile };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Alterar senha
// @route   PATCH /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    
    // Verificar senha atual
    const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Atualizar senha
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};
```

---

## 🛤️ Passo 7: Rotas do Backend

### 7.1 Arquivo: `backend/routes/auth.js`
```javascript
const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');

const router = express.Router();

// Rotas públicas
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Rotas privadas (requerem autenticação)
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);
router.patch('/change-password', auth, changePassword);

module.exports = router;
```

---

## 🚀 Passo 8: Servidor Principal do Backend

### 8.1 Arquivo: `backend/server.js`
```javascript
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');

// Importar middleware e configurações
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Importar rotas
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
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
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
app.use(generalLimiter);

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
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
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Exemplo de eventos básicos para próximas sprints
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

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
```

---

## 🎨 Passo 9: Setup do Frontend

### 9.1 Voltar para o diretório raiz e criar o frontend
```bash
cd ..
npx create-react-app frontend
cd frontend
```

### 9.2 Instalando dependências do frontend
```bash
# Remover dependências que não vamos usar
npm uninstall @testing-library/jest-dom @testing-library/react @testing-library/user-event web-vitals

# Instalar dependências necessárias
npm install react-router-dom axios tailwindcss postcss autoprefixer lucide-react react-hot-toast socket.io-client

# Instalar Tailwind CSS
npx tailwindcss init -p
```

### 9.3 Configurar Tailwind - Arquivo: `frontend/tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
}
```

### 9.4 Arquivo: `frontend/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Animation classes */
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-in {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
```

---

## ⚙️ Passo 10: Configurações e Contextos do Frontend

### 10.1 Arquivo: `frontend/src/config/api.js`
```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Criar instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Se token expirou ou é inválido
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### 10.2 Arquivo: `frontend/src/context/AuthContext.js`
```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';

// Estado inicial
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

// Tipos de ações
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  LOAD_USER: 'LOAD_USER',
  UPDATE_USER: 'UPDATE_USER',
  SET_LOADING: 'SET_LOADING',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
      };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOAD_USER:
      return {
        ...state,
        user: action.payload,
        isLoading: false,
      };
    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

// Criar contexto
const AuthContext = createContext();

// Provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Carregar usuário do localStorage na inicialização
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token },
        });
        loadUser();
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    } else {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  // Carregar dados atualizados do usuário
  const loadUser = async () => {
    try {
      const response = await api.get('/auth/profile');
      dispatch({
        type: AUTH_ACTIONS.LOAD_USER,
        payload: response.data.data.user,
      });
    } catch (error) {
      console.error('Error loading user:', error);
      logout();
    }
  };

  // Login
  const login = async (email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await api.post('/auth/login', {
        email,
        password,
      });

      const { user, token } = response.data.data;

      // Salvar no localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });

      toast.success('Login realizado com sucesso!');
      return { success: true };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      
      const message = error.response?.data?.message || 'Erro no login';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Registro
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await api.post('/auth/register', userData);
      const { user, token } = response.data.data;

      // Salvar no localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });

      toast.success('Conta criada com sucesso!');
      return { success: true };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      
      const message = error.response?.data?.message || 'Erro no registro';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
    toast.success('Logout realizado com sucesso!');
  };

  // Atualizar perfil
  const updateProfile = async (updateData) => {
    try {
      const response = await api.patch('/auth/profile', updateData);
      const updatedUser = response.data.data.user;

      // Atualizar localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: updatedUser,
      });

      toast.success('Perfil atualizado com sucesso!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Erro ao atualizar perfil';
      toast.error(message);
      return { success: false, message };
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    loadUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export default AuthContext;