# Sistema de Atendimento via Live Chat

Sistema completo de atendimento ao cliente via chat em tempo real, desenvolvido em React.js e Node.js.

## 🚀 Tecnologias

- **Frontend**: React.js (Vite), Tailwind CSS, Socket.io-client
- **Backend**: Node.js, Express, MongoDB, Socket.io
- **Autenticação**: JWT
- **Real-time**: WebSockets

## 📋 Pré-requisitos

- Node.js (v16 ou superior)
- MongoDB (local ou cloud)
- NPM ou Yarn

## ⚡ Instalação Rápida

### Windows (PowerShell)

1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd chat-atendimento
```

2. Execute o script de setup
```powershell
.\scripts\setup.ps1
```

### Instalação Manual

1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd chat-atendimento
```

2. Instale as dependências do projeto raiz
```bash
npm install
```

3. Instale as dependências do backend
```bash
cd backend
npm install
cd ..
```

4. Instale as dependências do frontend
```bash
cd frontend
npm install
cd ..
```

5. Configure as variáveis de ambiente:
   - Copie os exemplos abaixo para os respectivos arquivos

### Backend `.env` (backend/.env)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/chat-atendimento
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend `.env` (frontend/.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## 🏃 Executando o Projeto

### Desenvolvimento (Backend + Frontend)
```bash
npm run dev
```

### Executar separadamente
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 📁 Estrutura do Projeto

```
chat-atendimento/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   └── authController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── models/
│   │   ├── User.js
│   │   └── Conversation.js
│   ├── routes/
│   │   └── auth.js
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── MainLayout.js
│   │   │   │   └── Sidebar.js
│   │   │   ├── PrivateRoute.js
│   │   │   └── PublicRoute.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Conversations.js
│   │   │   ├── History.js
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── NotFound.js
│   │   │   └── Unauthorized.js
│   │   ├── config/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── scripts/
│   └── setup.ps1
└── package.json
```

## 🔐 Usuários de Teste

Após executar o projeto, você pode criar usuários com diferentes roles:
- **Cliente**: Para fazer atendimentos
- **Agente**: Para atender clientes  
- **Admin**: Para gerenciar o sistema

## 🌐 URLs de Acesso

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## 📊 Project Status

### ✅ Sprint 1 - Foundation (Completed)
- Complete authentication system (login/register)
- Responsive layout with sidebar
- Basic dashboard structure
- Protected routes system
- Context API for state management
- Complete environment setup
- Error pages (404, Unauthorized)
- Toast notification system
- Security middleware

### ✅ Sprint 2 - Core Features (Completed)
- Real-time chat system with Socket.io
- Modern conversation interface
- Agent assignment system
- Real-time message synchronization
- Conversation status management (waiting, active, closed)
- Functional dashboard with real data
- Client and agent differentiated views
- Recent activities tracking
- Real-time statistics
- Improved UI/UX with modern design

### 🚧 Sprint 3 - Advanced Features (In Planning)
- File and media upload
- Advanced agent management
- Detailed conversation history
- Reports and analytics
- Performance optimizations
- Advanced filtering and search

## 🔄 Development Roadmap

- **Sprint 3**: File uploads and advanced features
- **Sprint 4**: Analytics and reporting
- **Sprint 5**: Admin panel and management tools
- **Sprint 6**: Deployment and production optimizations

## 🐛 Problemas Comuns

### MongoDB não conecta
```bash
# Windows - Iniciar MongoDB
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

### Erro de CORS
Verifique se a URL do frontend está correta no arquivo `.env` do backend (CLIENT_URL).

### Porta já em uso
```powershell
# Windows - Encontrar processo na porta
netstat -ano | findstr :5000

# Matar processo
taskkill /PID <PID> /F
```

## 🧪 Testando a API

### Registrar usuário
```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d "{\"name\":\"Teste\",\"email\":\"teste@email.com\",\"password\":\"123456\",\"role\":\"client\"}"
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"teste@email.com\",\"password\":\"123456\"}"
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 License

Este projeto está sob a licença MIT.
