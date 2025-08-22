# 💬 Chat Atendimento - Sistema de Atendimento em Tempo Real

## 🚀 Sobre o Projeto

Sistema completo de chat para atendimento ao cliente com múltiplos atendentes, fila de espera, dashboard administrativo e comunicação em tempo real via WebSockets.

### ✨ Principais Funcionalidades

- 💬 **Chat em tempo real** com WebSockets (Socket.io)
- 👥 **Múltiplos atendentes** simultâneos
- 📊 **Dashboard** com estatísticas e métricas
- 🔐 **Autenticação segura** com JWT
- 📱 **Interface responsiva** para desktop e mobile
- 🔄 **Fila de atendimento** inteligente
- 📎 **Envio de arquivos** com armazenamento na AWS S3
- 🔔 **Notificações** em tempo real
- 🎨 **Temas personalizáveis** (claro/escuro)

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** (v20+) com Express
- **MongoDB** com Mongoose ODM
- **Socket.io** para WebSockets
- **JWT** para autenticação
- **AWS S3** para armazenamento de arquivos
- **Docker** para containerização

### Frontend
- **React 18** com Vite
- **TailwindCSS** para estilização
- **Socket.io Client** para comunicação real-time
- **React Router v6** para roteamento
- **Zustand** para gerenciamento de estado
- **React Query** para cache e sincronização

## 📦 Estrutura do Projeto

```
chat-atendimento/
├── backend/              # Servidor Node.js
│   ├── config/          # Configurações (DB, AWS, etc)
│   ├── controllers/     # Lógica de negócio
│   ├── middlewares/     # Middlewares Express
│   ├── models/          # Schemas MongoDB
│   ├── routes/          # Rotas da API REST
│   ├── services/        # Serviços (email, upload, etc)
│   ├── sockets/         # Handlers Socket.io
│   └── server.js        # Entry point
│
├── frontend/            # Aplicação React
│   ├── src/
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── pages/       # Páginas/Rotas
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # Chamadas API
│   │   ├── stores/      # Estado global (Zustand)
│   │   └── utils/       # Utilitários
│   └── public/          # Assets estáticos
│
├── docker-compose.yml   # Orquestração de containers
├── .github/workflows/   # CI/CD com GitHub Actions
└── README.md           # Este arquivo
```

## 🚀 Como Executar

### Pré-requisitos

- Node.js 20+ e npm/yarn
- Docker e Docker Compose (opcional)
- MongoDB (local ou Atlas)
- Conta AWS (para produção)

### 🏃 Execução Local

1. **Clone o repositório**
```bash
git clone https://github.com/rafabrdev/chat-atendimento.git
cd chat-atendimento
```

2. **Configure as variáveis de ambiente**
```bash
# Crie um arquivo .env na raiz
cp .env.example .env
# Edite com suas configurações
```

3. **Com Docker (Recomendado)**
```bash
# Inicia todos os serviços
docker-compose up -d

# Acompanhar logs
docker-compose logs -f
```

4. **Sem Docker**
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

5. **Acesse a aplicação**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Socket.io: http://localhost:5000

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# Servidor
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/chat-atendimento

# Autenticação
JWT_SECRET=sua-chave-secreta-aqui
JWT_EXPIRE=7d

# Frontend URLs
CLIENT_URL=http://localhost:5173
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

# AWS S3 (opcional)
AWS_ACCESS_KEY_ID=sua-chave
AWS_SECRET_ACCESS_KEY=seu-secret
S3_BUCKET_NAME=seu-bucket
AWS_REGION=us-east-1
```

## 📱 Como Usar

### 👤 Para Clientes
1. Acesse a página inicial
2. Clique em "Iniciar Conversa"
3. Informe nome e email
4. Aguarde conexão com atendente
5. Converse em tempo real

### 🧑‍💼 Para Atendentes
1. Faça login em `/login`
2. Visualize a fila de espera
3. Aceite chats pendentes
4. Atenda múltiplos clientes
5. Encerre conversas quando finalizar

### 👨‍💼 Para Administradores
1. Acesse `/admin`
2. Gerencie usuários atendentes
3. Visualize métricas e relatórios
4. Configure parâmetros do sistema

## 🌐 Deploy em Produção

### AWS EC2 + GitHub Actions

O projeto está configurado para deploy automático:

1. **Configure os GitHub Secrets necessários**
2. **Faça push para branch `main`**
3. **Deploy automático será executado**

### Acesso Produção
- URL: http://52.90.17.204 (temporário)
- Futuro: https://suporte.brsi.net.br

## 📡 API Documentation

### Endpoints Principais

#### Autenticação
```http
POST   /api/auth/register   # Cadastro de atendente
POST   /api/auth/login      # Login
GET    /api/auth/me         # Usuário atual
POST   /api/auth/logout     # Logout
```

#### Chat
```http
POST   /api/chat/start      # Cliente inicia chat
GET    /api/chat/queue      # Fila de atendimento
POST   /api/chat/:id/accept # Atendente aceita chat
POST   /api/chat/:id/close  # Encerrar chat
GET    /api/chat/history    # Histórico de chats
```

#### Mensagens
```http
GET    /api/messages/:chatId  # Buscar mensagens
POST   /api/messages           # Enviar mensagem
POST   /api/messages/upload    # Upload de arquivo
```

### WebSocket Events

```javascript
// Cliente → Servidor
socket.emit('join-chat', { chatId })
socket.emit('send-message', { message, chatId })
socket.emit('typing', { chatId, isTyping })

// Servidor → Cliente
socket.on('new-message', (data) => {})
socket.on('chat-accepted', (data) => {})
socket.on('chat-closed', (data) => {})
socket.on('user-typing', (data) => {})
```

## 🧪 Testes

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma feature branch (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Add: Nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📝 Roadmap

- [ ] Integração com WhatsApp Business API
- [ ] Sistema de tickets/chamados
- [ ] Chatbot com IA para respostas automáticas
- [ ] Videochamadas integradas
- [ ] App mobile nativo
- [ ] Integração com CRM
- [ ] Analytics avançado

## 🐛 Encontrou um Bug?

Abra uma [issue](https://github.com/pedbarros/chat-atendimento/issues) descrevendo o problema.

## 📄 Licença

Este projeto está sob a licença MIT. Veja [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

**rafael França**
- GitHub: [@rafabrdev](https://github.com/rafabrdev)
- LinkedIn: [Rafael França](https://linkedin.com/in/rafabrdev)

## 🏢 Empresa

**BR Sistemas**
- Website: https://www.brsi.com.br/
- Email: suporte@brsi.net.br

---

<p align="center">
  Feito com ❤️ por <strong>BR Sistemas</strong>
</p>
