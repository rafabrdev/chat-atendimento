# 🚀 Sprint 2: Sistema de Conversas Base - Guia Completo

## 📋 Visão Geral
Esta sprint implementará o sistema de chat em tempo real, incluindo WebSockets, sistema de filas e interface completa de chat.

**Stack Observada no Projeto:**
- Backend: NestJS + Prisma + PostgreSQL + Socket.io
- Frontend: React + Vite + Tailwind CSS + Socket.io-client

## 🏗️ Etapa 1: Configuração e Dependências

### Backend - Instalar Dependências Adicionais

```bash
cd apps/backend
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io multer @nestjs/platform-express class-transformer class-validator
npm install -D @types/multer
```

### Frontend - Instalar Dependências Adicionais

```bash
cd apps/frontend
npm install socket.io-client react-router-dom axios @headlessui/react react-hot-toast
npm install -D @types/socket.io-client
```

## 🗄️ Etapa 2: Atualização do Schema Prisma

### Arquivo: `apps/backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Company {
  id        String   @id @default(uuid())
  name      String
  cnpj      String?
  plan      String   @default("ESSENTIAL")
  createdAt DateTime @default(now())
  users     User[]
  contacts  Contact[]
  conversations Conversation[]
  metrics   Metric[]
}

model User {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  name      String
  email     String   @unique
  password  String
  role      String   // 'client', 'agent', 'admin'
  active    Boolean  @default(true)
  status    String   @default("offline") // 'online', 'busy', 'away', 'offline'
  lastSeen  DateTime?
  createdAt DateTime @default(now())
  sentMessages Message[]
  assignedConversations Conversation[] @relation("AgentConversations")
}

model Contact {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  name      String
  email     String?
  phone     String?
  metadata  Json?
  createdAt DateTime @default(now())
  conversations Conversation[]
}

model Conversation {
  id           String    @id @default(uuid())
  companyId    String
  company      Company   @relation(fields: [companyId], references: [id])
  contactId    String?
  contact      Contact?  @relation(fields: [contactId], references: [id])
  assignedAgentId String?
  assignedAgent   User?  @relation("AgentConversations", fields: [assignedAgentId], references: [id])
  status       String    @default("waiting") // 'waiting', 'active', 'closed'
  priority     String    @default("normal") // 'low', 'normal', 'high', 'urgent'
  tags         String[]
  createdAt    DateTime  @default(now())
  closedAt     DateTime?
  lastActivity DateTime  @default(now())
  messages     Message[]
  
  @@index([companyId, status])
  @@index([assignedAgentId])
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String?
  sender         User?        @relation(fields: [senderId], references: [id])
  senderType     String       // 'agent', 'client', 'system'
  content        String?
  type           String       @default("text") // 'text', 'image', 'file', 'audio', 'system'
  metadata       Json?        // Para armazenar informações extras do arquivo, etc.
  isRead         Boolean      @default(false)
  createdAt      DateTime     @default(now())
  
  @@index([conversationId, createdAt])
}

model QueueEntry {
  id             String       @id @default(uuid())
  conversationId String       @unique
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  priority       Int          @default(1)
  estimatedWait  Int?         // tempo em minutos
  createdAt      DateTime     @default(now())
  
  @@index([priority, createdAt])
}

model Thread {
  id           String   @id @default(uuid())
  companyId    String
  company      Company  @relation(fields: [companyId], references: [id])
  contactId    String?
  contact      Contact? @relation(fields: [contactId], references: [id])
  status       String   @default("new")
  subject      String?
  createdBy    String?
  createdAt    DateTime @default(now())
  lastActivity DateTime?
  messages     ThreadMessage[]
}

model ThreadMessage {
  id          String   @id @default(uuid())
  threadId    String
  thread      Thread   @relation(fields: [threadId], references: [id])
  senderType  String
  senderId    String?
  content     String?
  contentJson Json?
  attachments Json?
  createdAt   DateTime @default(now())
  readAt      DateTime?
}

model Metric {
  id                 String  @id @default(uuid())
  companyId          String
  company            Company @relation(fields: [companyId], references: [id])
  metricDate         DateTime
  ticketsOpened      Int
  ticketsClosed      Int
  avgResponseSeconds Int
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String
  payload   Json?
  createdAt DateTime @default(now())
}
```

### Executar Migração

```bash
cd apps/backend
npx prisma migrate dev --name "add-conversation-system"
npx prisma generate
```

## 🔧 Etapa 3: Backend - Implementação do Sistema de Chat

### 3.1: Gateway WebSocket Principal

**Arquivo: `apps/backend/src/chat/chat.gateway.ts`**

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/chat',
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, { socket: Socket; userId: string; role: string }>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      // Armazenar conexão
      this.connectedUsers.set(client.id, {
        socket: client,
        userId: user.id,
        role: user.role,
      });

      // Atualizar status do usuário
      await this.prisma.user.update({
        where: { id: user.id },
        data: { 
          status: 'online',
          lastSeen: new Date(),
        },
      });

      // Juntar-se às salas apropriadas
      client.join(`company:${user.companyId}`);
      if (user.role === 'agent') {
        client.join('agents');
      }

      // Notificar outros usuários
      client.to(`company:${user.companyId}`).emit('user-status-changed', {
        userId: user.id,
        status: 'online',
      });

      this.logger.log(`User ${user.id} connected`);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const connection = this.connectedUsers.get(client.id);
    if (connection) {
      // Atualizar status do usuário
      await this.prisma.user.update({
        where: { id: connection.userId },
        data: { 
          status: 'offline',
          lastSeen: new Date(),
        },
      });

      // Notificar outros usuários
      const user = await this.prisma.user.findUnique({
        where: { id: connection.userId },
      });

      if (user) {
        client.to(`company:${user.companyId}`).emit('user-status-changed', {
          userId: user.id,
          status: 'offline',
        });
      }

      this.connectedUsers.delete(client.id);
      this.logger.log(`User ${connection.userId} disconnected`);
    }
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const connection = this.connectedUsers.get(client.id);
    if (!connection) return;

    // Verificar se o usuário tem acesso à conversa
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: data.conversationId,
        OR: [
          { assignedAgentId: connection.userId },
          { contact: { id: connection.userId } }, // Se for um contato
        ],
      },
    });

    if (conversation) {
      client.join(`conversation:${data.conversationId}`);
      this.logger.log(`User ${connection.userId} joined conversation ${data.conversationId}`);
    }
  }

  @SubscribeMessage('leave-conversation')
  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody() data: {
      conversationId: string;
      content: string;
      type?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const connection = this.connectedUsers.get(client.id);
    if (!connection) return;

    try {
      const message = await this.chatService.sendMessage({
        conversationId: data.conversationId,
        senderId: connection.userId,
        content: data.content,
        type: data.type || 'text',
        senderType: connection.role,
      });

      // Emitir mensagem para todos na conversa
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('new-message', message);

      // Emitir para agentes se necessário
      if (connection.role === 'client') {
        this.server.to('agents').emit('new-message-notification', {
          conversationId: data.conversationId,
          message,
        });
      }
    } catch (error) {
      client.emit('message-error', { error: error.message });
    }
  }

  @SubscribeMessage('typing-start')
  handleTypingStart(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const connection = this.connectedUsers.get(client.id);
    if (!connection) return;

    client.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId: connection.userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing-stop')
  handleTypingStop(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const connection = this.connectedUsers.get(client.id);
    if (!connection) return;

    client.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId: connection.userId,
      isTyping: false,
    });
  }

  @SubscribeMessage('agent-available')
  async handleAgentAvailable(@ConnectedSocket() client: Socket) {
    const connection = this.connectedUsers.get(client.id);
    if (!connection || connection.role !== 'agent') return;

    await this.prisma.user.update({
      where: { id: connection.userId },
      data: { status: 'online' },
    });

    // Processar fila de espera
    await this.chatService.processQueue();
  }

  @SubscribeMessage('agent-busy')
  async handleAgentBusy(@ConnectedSocket() client: Socket) {
    const connection = this.connectedUsers.get(client.id);
    if (!connection || connection.role !== 'agent') return;

    await this.prisma.user.update({
      where: { id: connection.userId },
      data: { status: 'busy' },
    });
  }

  // Método para notificar nova conversa atribuída
  async notifyNewConversationAssigned(conversationId: string, agentId: string) {
    const agentConnection = Array.from(this.connectedUsers.values()).find(
      conn => conn.userId === agentId
    );

    if (agentConnection) {
      agentConnection.socket.emit('conversation-assigned', { conversationId });
    }
  }

  // Método para notificar atualização de fila
  async notifyQueueUpdate(companyId: string) {
    this.server.to(`company:${companyId}`).emit('queue-updated');
  }
}
```

### 3.2: Service de Chat

**Arquivo: `apps/backend/src/chat/chat.service.ts`**

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';

export interface SendMessageDto {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  senderType: string;
  metadata?: any;
}

export interface CreateConversationDto {
  contactId?: string;
  companyId: string;
  subject?: string;
  priority?: string;
  tags?: string[];
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(data: CreateConversationDto) {
    const conversation = await this.prisma.conversation.create({
      data: {
        companyId: data.companyId,
        contactId: data.contactId,
        priority: data.priority || 'normal',
        tags: data.tags || [],
        status: 'waiting',
      },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });

    // Adicionar à fila de espera
    await this.prisma.queueEntry.create({
      data: {
        conversationId: conversation.id,
        priority: this.getPriorityValue(data.priority || 'normal'),
      },
    });

    // Processar fila automaticamente
    setTimeout(() => this.processQueue(), 1000);

    return conversation;
  }

  async sendMessage(data: SendMessageDto) {
    // Verificar se a conversa existe
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Criar mensagem
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        type: data.type,
        senderType: data.senderType,
        metadata: data.metadata,
      },
      include: {
        sender: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // Atualizar última atividade da conversa
    await this.prisma.conversation.update({
      where: { id: data.conversationId },
      data: { lastActivity: new Date() },
    });

    return message;
  }

  async getConversations(companyId: string, status?: string, assignedAgentId?: string) {
    const where: any = { companyId };
    
    if (status) {
      where.status = status;
    }
    
    if (assignedAgentId) {
      where.assignedAgentId = assignedAgentId;
    }

    return this.prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        assignedAgent: {
          select: { id: true, name: true, role: true, status: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastActivity: 'desc' },
    });
  }

  async getConversationMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignConversationToAgent(conversationId: string, agentId: string) {
    // Verificar se o agente existe e está disponível
    const agent = await this.prisma.user.findFirst({
      where: {
        id: agentId,
        role: 'agent',
        active: true,
      },
    });

    if (!agent) {
      throw new BadRequestException('Agent not found or not available');
    }

    // Atualizar conversa
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedAgentId: agentId,
        status: 'active',
      },
      include: {
        contact: true,
        assignedAgent: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // Remover da fila
    await this.prisma.queueEntry.deleteMany({
      where: { conversationId },
    });

    // Atualizar status do agente
    await this.prisma.user.update({
      where: { id: agentId },
      data: { status: 'busy' },
    });

    return conversation;
  }

  async processQueue() {
    // Buscar agentes disponíveis
    const availableAgents = await this.prisma.user.findMany({
      where: {
        role: 'agent',
        active: true,
        status: 'online',
      },
    });

    if (availableAgents.length === 0) {
      return;
    }

    // Buscar próxima conversa na fila
    const queueEntry = await this.prisma.queueEntry.findFirst({
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        conversation: true,
      },
    });

    if (!queueEntry) {
      return;
    }

    // Atribuir ao primeiro agente disponível
    const agent = availableAgents[0];
    await this.assignConversationToAgent(queueEntry.conversationId, agent.id);

    // Continuar processando se houver mais itens na fila
    const remainingQueue = await this.prisma.queueEntry.count();
    if (remainingQueue > 0 && availableAgents.length > 1) {
      setTimeout(() => this.processQueue(), 2000);
    }
  }

  async closeConversation(conversationId: string, closedBy: string) {
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    // Se tinha agente atribuído, liberar o agente
    if (conversation.assignedAgentId) {
      await this.prisma.user.update({
        where: { id: conversation.assignedAgentId },
        data: { status: 'online' },
      });
    }

    // Processar fila novamente
    setTimeout(() => this.processQueue(), 1000);

    return conversation;
  }

  async getQueueStatus(companyId: string) {
    const queueCount = await this.prisma.queueEntry.count({
      where: {
        conversation: { companyId },
      },
    });

    const availableAgents = await this.prisma.user.count({
      where: {
        companyId,
        role: 'agent',
        active: true,
        status: 'online',
      },
    });

    const busyAgents = await this.prisma.user.count({
      where: {
        companyId,
        role: 'agent',
        active: true,
        status: 'busy',
      },
    });

    return {
      queueCount,
      availableAgents,
      busyAgents,
      estimatedWait: queueCount > 0 ? Math.ceil(queueCount / Math.max(availableAgents, 1)) * 5 : 0,
    };
  }

  private getPriorityValue(priority: string): number {
    const priorities = {
      low: 1,
      normal: 2,
      high: 3,
      urgent: 4,
    };
    return priorities[priority] || 2;
  }
}
```

### 3.3: Controller de Chat

**Arquivo: `apps/backend/src/chat/chat.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService, CreateConversationDto } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  async createConversation(
    @Body() createConversationDto: Omit<CreateConversationDto, 'companyId'>,
    @Request() req,
  ) {
    return this.chatService.createConversation({
      ...createConversationDto,
      companyId: req.user.companyId,
    });
  }

  @Get('conversations')
  async getConversations(
    @Query('status') status?: string,
    @Query('assignedAgentId') assignedAgentId?: string,
    @Request() req,
  ) {
    return this.chatService.getConversations(
      req.user.companyId,
      status,
      assignedAgentId,
    );
  }

  @Get('conversations/:id/messages')
  async getConversationMessages(@Param('id') conversationId: string) {
    return this.chatService.getConversationMessages(conversationId);
  }

  @Patch('conversations/:id/assign')
  async assignConversation(
    @Param('id') conversationId: string,
    @Body('agentId') agentId: string,
  ) {
    return this.chatService.assignConversationToAgent(conversationId, agentId);
  }

  @Patch('conversations/:id/close')
  async closeConversation(
    @Param('id') conversationId: string,
    @Request() req,
  ) {
    return this.chatService.closeConversation(conversationId, req.user.id);
  }

  @Get('queue/status')
  async getQueueStatus(@Request() req) {
    return this.chatService.getQueueStatus(req.user.companyId);
  }

  @Post('queue/process')
  async processQueue() {
    return this.chatService.processQueue();
  }
}
```

### 3.4: Módulo de Chat

**Arquivo: `apps/backend/src/chat/chat.module.ts`**

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [ChatGateway, ChatService],
  controllers: [ChatController],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
```

### 3.5: Atualizar App Module

**Arquivo: `apps/backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 3.6: Service do Prisma

**Arquivo: `apps/backend/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

**Arquivo: `apps/backend/src/prisma/prisma.module.ts`**

```typescript
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

## 🎨 Etapa 4: Frontend - Implementação da Interface de Chat

### 4.1: Configuração do Socket.io Client

**Arquivo: `apps/frontend/src/lib/socket.js`**

```javascript
import { io } from 'socket.io-client';

class SocketService {
  socket = null;
  
  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/chat`, {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  joinConversation(conversationId) {
    this.emit('join-conversation', { conversationId });
  }

  leaveConversation(conversationId) {
    this.emit('leave-conversation', { conversationId });
  }

  sendMessage(conversationId, content, type = 'text') {
    this.emit('send-message', { conversationId, content, type });
  }

  startTyping(conversationId) {
    this.emit('typing-start', { conversationId });
  }

  stopTyping(conversationId) {
    this.emit('typing-stop', { conversationId });
  }

  setAgentStatus(status) {
    if (status === 'available') {
      this.emit('agent-available');
    } else if (status === 'busy') {
      this.emit('agent-busy');
    }
  }
}

export const socketService = new SocketService();
```

### 4.2: Hook para gerenciar Socket

**Arquivo: `apps/frontend/src/hooks/useSocket.js`**

```javascript
import { useEffect, useRef } from 'react';
import { socketService } from '../lib/socket';

export const useSocket = (token, user) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (token && user) {
      socketRef.current = socketService.connect(token);
    }

    return () => {
      if (socketRef.current) {
        socketService.disconnect();
      }
    };
  }, [token, user]);

  return socketRef.current;
};
```

### 4.3: Context para Chat

**Arquivo: `apps/frontend/src/contexts/ChatContext.jsx`**

```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { socketService } from '../lib/socket';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload,
      };
    
    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
      };
    
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.id ? { ...conv, ...action.payload } : conv
        ),
      };
    
    case 'SET_ACTIVE_CONVERSATION':
      return {
        ...state,
        activeConversation: action.payload,
      };
    
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.conversationId]: action.payload,
        },
      };
    
    case 'ADD_MESSAGE':
      const conversationId = action.payload.conversationId;
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: [
            ...(state.messages[conversationId] || []),
            action.payload,
          ],
        },
      };
    
    case 'SET_TYPING_USERS':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.conversationId]: action.payload,
        },
      };
    
    case 'SET_QUEUE_STATUS':
      return {
        ...state,
        queueStatus: action.payload,
      };
    
    case 'SET_ONLINE_USERS':
      return {
        ...state,
        onlineUsers: action.payload,
      };
    
    default:
      return state;
  }
};

const initialState = {
  conversations: [],
  activeConversation: null,
  messages: {},
  typingUsers: {},
  queueStatus: null,
  onlineUsers: [],
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, token } = useAuth();

  useEffect(() => {
    if (!token || !user) return;

    const socket = socketService.connect(token);

    // Listeners de Socket
    socket.on('new-message', (message) => {
      dispatch({ type: 'ADD_MESSAGE', payload: message });
      
      // Atualizar última atividade da conversa
      dispatch({
        type: 'UPDATE_CONVERSATION',
        payload: {
          id: message.conversationId,
          lastActivity: new Date().toISOString(),
        },
      });
    });

    socket.on('user-typing', ({ userId, isTyping, conversationId }) => {
      dispatch({
        type: 'SET_TYPING_USERS',
        conversationId,
        payload: isTyping 
          ? [...(state.typingUsers[conversationId] || []), userId]
          : (state.typingUsers[conversationId] || []).filter(id => id !== userId),
      });
    });

    socket.on('conversation-assigned', ({ conversationId }) => {
      loadConversations();
    });

    socket.on('queue-updated', () => {
      loadQueueStatus();
    });

    socket.on('user-status-changed', ({ userId, status }) => {
      dispatch({
        type: 'SET_ONLINE_USERS',
        payload: state.onlineUsers.map(user =>
          user.id === userId ? { ...user, status } : user
        ),
      });
    });

    return () => {
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('conversation-assigned');
      socket.off('queue-updated');
      socket.off('user-status-changed');
    };
  }, [token, user]);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const conversations = await response.json();
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const messages = await response.json();
      dispatch({ 
        type: 'SET_MESSAGES', 
        conversationId, 
        payload: messages 
      });
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createConversation = async (data) => {
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const conversation = await response.json();
      dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const sendMessage = (conversationId, content, type = 'text') => {
    socketService.sendMessage(conversationId, content, type);
  };

  const setActiveConversation = (conversation) => {
    if (state.activeConversation?.id) {
      socketService.leaveConversation(state.activeConversation.id);
    }
    
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conversation });
    
    if (conversation?.id) {
      socketService.joinConversation(conversation.id);
      loadMessages(conversation.id);
    }
  };

  const startTyping = (conversationId) => {
    socketService.startTyping(conversationId);
  };

  const stopTyping = (conversationId) => {
    socketService.stopTyping(conversationId);
  };

  const loadQueueStatus = async () => {
    try {
      const response = await fetch('/api/chat/queue/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const queueStatus = await response.json();
      dispatch({ type: 'SET_QUEUE_STATUS', payload: queueStatus });
    } catch (error) {
      console.error('Error loading queue status:', error);
    }
  };

  const setAgentStatus = (status) => {
    socketService.setAgentStatus(status);
  };

  useEffect(() => {
    if (token && user) {
      loadConversations();
      loadQueueStatus();
    }
  }, [token, user]);

  const value = {
    ...state,
    loadConversations,
    loadMessages,
    createConversation,
    sendMessage,
    setActiveConversation,
    startTyping,
    stopTyping,
    loadQueueStatus,
    setAgentStatus,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
```

### 4.4: Componente Principal de Chat

**Arquivo: `apps/frontend/src/components/Chat/ChatInterface.jsx`**

```javascript
import React, { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import QueueStatus from './QueueStatus';
import AgentStatus from './AgentStatus';

const ChatInterface = () => {
  const { user } = useAuth();
  const { 
    conversations, 
    activeConversation, 
    setActiveConversation,
    queueStatus 
  } = useChat();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">
              Chat
            </h1>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          {user?.role === 'agent' && (
            <div className="mt-4 space-y-3">
              <AgentStatus />
              <QueueStatus status={queueStatus} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            onConversationSelect={setActiveConversation}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!isSidebarOpen && (
          <div className="p-4 border-b border-gray-200 bg-white">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}

        {activeConversation ? (
          <ChatWindow conversation={activeConversation} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-gray-500">
                Escolha uma conversa da lista ou inicie um novo atendimento
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
```

### 4.5: Lista de Conversas

**Arquivo: `apps/frontend/src/components/Chat/ConversationList.jsx`**

```javascript
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ConversationList = ({ conversations, activeConversation, onConversationSelect }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'normal':
        return 'border-l-blue-500';
      case 'low':
        return 'border-l-gray-500';
      default:
        return 'border-l-gray-500';
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Nenhuma conversa encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => onConversationSelect(conversation)}
          className={`
            p-4 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors
            ${activeConversation?.id === conversation.id ? 'bg-blue-50 border-l-blue-500' : getPriorityColor(conversation.priority)}
            ${conversation.status === 'waiting' ? 'border-b border-yellow-200' : 'border-b border-gray-100'}
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {conversation.contact?.name || `Conversa #${conversation.id.slice(-6)}`}
                </p>
                <span className={`
                  inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                  ${getStatusColor(conversation.status)}
                `}>
                  {conversation.status === 'waiting' && 'Aguardando'}
                  {conversation.status === 'active' && 'Ativo'}
                  {conversation.status === 'closed' && 'Fechado'}
                </span>
              </div>
              
              {conversation.messages?.[0] && (
                <p className="text-sm text-gray-600 truncate mb-2">
                  {conversation.messages[0].content}
                </p>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {formatDistanceToNow(new Date(conversation.lastActivity), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
                
                {conversation._count?.messages > 0 && (
                  <span className="bg-gray-100 px-2 py-1 rounded-full">
                    {conversation._count.messages} msgs
                  </span>
                )}
              </div>
              
              {conversation.assignedAgent && (
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <div className="w-4 h-4 rounded-full bg-gray-300 mr-2"></div>
                  {conversation.assignedAgent.name}
                </div>
              )}
            </div>
          </div>
          
          {conversation.tags && conversation.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {conversation.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ConversationList;
```

### 4.6: Janela de Chat

**Arquivo: `apps/frontend/src/components/Chat/ChatWindow.jsx`**

```javascript
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

const ChatWindow = ({ conversation }) => {
  const { user } = useAuth();
  const { 
    messages, 
    typingUsers, 
    sendMessage, 
    startTyping, 
    stopTyping 
  } = useChat();
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const conversationMessages = messages[conversation.id] || [];
  const currentTypingUsers = typingUsers[conversation.id] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);

  const handleSendMessage = (content, type = 'text') => {
    sendMessage(conversation.id, content, type);
    
    // Parar indicador de digitação
    if (isTyping) {
      stopTyping(conversation.id);
      setIsTyping(false);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      startTyping(conversation.id);
      setIsTyping(true);
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Parar de digitar após 3 segundos de inatividade
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversation.id);
      setIsTyping(false);
    }, 3000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting':
        return 'text-yellow-600 bg-yellow-50';
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'closed':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {conversation.contact?.name || `Conversa #${conversation.id.slice(-6)}`}
            </h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`
                inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                ${getStatusColor(conversation.status)}
              `}>
                {conversation.status === 'waiting' && 'Aguardando Atendimento'}
                {conversation.status === 'active' && 'Em Atendimento'}
                {conversation.status === 'closed' && 'Finalizado'}
              </span>
              
              {conversation.priority !== 'normal' && (
                <span className={`
                  inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                  ${conversation.priority === 'urgent' ? 'bg-red-100 text-red-800' : ''}
                  ${conversation.priority === 'high' ? 'bg-orange-100 text-orange-800' : ''}
                  ${conversation.priority === 'low' ? 'bg-gray-100 text-gray-800' : ''}
                `}>
                  {conversation.priority === 'urgent' && 'Urgente'}
                  {conversation.priority === 'high' && 'Alta'}
                  {conversation.priority === 'low' && 'Baixa'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {conversation.assignedAgent && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs mr-2">
                  {conversation.assignedAgent.name.charAt(0).toUpperCase()}
                </div>
                {conversation.assignedAgent.name}
              </div>
            )}
            
            <div className="flex space-x-1">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {conversationMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-500">Inicie a conversa enviando uma mensagem</p>
            </div>
          </div>
        ) : (
          <>
            {conversationMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderId === user.id}
                user={user}
              />
            ))}
            
            {currentTypingUsers.length > 0 && (
              <TypingIndicator users={currentTypingUsers} />
            )}
          </>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <MessageInput 
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        disabled={conversation.status === 'closed'}
      />
    </div>
  );
};

export default ChatWindow;
```

### 4.7: Componente de Mensagem

**Arquivo: `apps/frontend/src/components/Chat/MessageBubble.jsx`**

```javascript
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MessageBubble = ({ message, isOwn, user }) => {
  const formatTime = (date) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        );
      
      case 'image':
        return (
          <div className="space-y-2">
            <img
              src={message.content}
              alt="Imagem enviada"
              className="max-w-sm rounded-lg"
              loading="lazy"
            />
            {message.metadata?.caption && (
              <div className="text-sm">{message.metadata.caption}</div>
            )}
          </div>
        );
      
      case 'file':
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {message.metadata?.filename || 'Arquivo'}
              </p>
              <p className="text-sm text-gray-500">
                {message.metadata?.size ? `${(message.metadata.size / 1024).toFixed(1)} KB` : 'Tamanho desconhecido'}
              </p>
            </div>
            <button className="flex-shrink-0 p-2 text-blue-600 hover:text-blue-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
        );
      
      case 'audio':
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg max-w-xs">
            <button className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <div className="flex-1">
              <div className="h-1 bg-gray-200 rounded-full">
                <div className="h-1 bg-blue-600 rounded-full w-1/3"></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {message.metadata?.duration ? `${message.metadata.duration}s` : 'Áudio'}
              </p>
            </div>
          </div>
        );
      
      case 'system':
        return (
          <div className="text-center text-sm text-gray-500 italic">
            {message.content}
          </div>
        );
      
      default:
        return <div>{message.content}</div>;
    }
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 px-3 py-1 rounded-full">
          {renderMessageContent()}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white ${
            isOwn ? 'bg-blue-600 ml-2' : 'bg-gray-500 mr-2'
          }`}>
            {message.sender?.name?.charAt(0).toUpperCase() || 
             (isOwn ? user.name?.charAt(0).toUpperCase() : '?')}
          </div>
        </div>

        {/* Message Content */}
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* Sender name (only show if not own message) */}
          {!isOwn && message.sender && (
            <span className="text-xs text-gray-500 mb-1 px-3">
              {message.sender.name}
            </span>
          )}
          
          {/* Message bubble */}
          <div className={`px-4 py-2 rounded-lg ${
            isOwn 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-900 border border-gray-200'
          }`}>
            {renderMessageContent()}
          </div>
          
          {/* Timestamp */}
          <span className="text-xs text-gray-500 mt-1 px-1">
            {formatTime(message.createdAt)}
            {isOwn && message.isRead && (
              <span className="ml-1">✓✓</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
```

### 4.8: Input de Mensagem

**Arquivo: `apps/frontend/src/components/Chat/MessageInput.jsx`**

```javascript
import React, { useState, useRef } from 'react';

const MessageInput = ({ onSendMessage, onTyping, disabled = false }) => {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else {
      onTyping?.();
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    onTyping?.();
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // TODO: Implementar upload de arquivo
      console.log('File selected:', file);
      // onSendMessage(fileUrl, 'file');
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (disabled) {
    return (
      <div className="p-4 bg-gray-100 border-t border-gray-200">
        <div className="flex items-center justify-center text-gray-500 text-sm">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Esta conversa foi finalizada
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        {/* File Upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
        />

        {/* Message Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[42px] max-h-32"
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim() || isUploading}
          className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
```

### 4.9: Indicador de Digitação

**Arquivo: `apps/frontend/src/components/Chat/TypingIndicator.jsx`**

```javascript
import React from 'react';

const TypingIndicator = ({ users = [] }) => {
  if (users.length === 0) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="flex max-w-xs">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-500 text-white flex items-center justify-center text-xs font-medium mr-2">
            ...
          </div>
        </div>
        
        <div className="bg-gray-100 px-4 py-2 rounded-lg">
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600">
              {users.length === 1 ? 'está digitando' : 'estão digitando'}
            </span>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
```

### 4.10: Status da Fila

**Arquivo: `apps/frontend/src/components/Chat/QueueStatus.jsx`**

```javascript
import React from 'react';

const QueueStatus = ({ status }) => {
  if (!status) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <h3 className="text-sm font-medium text-blue-900 mb-2">Status da Fila</h3>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-blue-700">Na fila</div>
          <div className="font-semibold text-blue-900">{status.queueCount}</div>
        </div>
        
        <div>
          <div className="text-blue-700">Disponíveis</div>
          <div className="font-semibold text-blue-900">{status.availableAgents}</div>
        </div>
        
        <div>
          <div className="text-blue-700">Ocupados</div>
          <div className="font-semibold text-blue-900">{status.busyAgents}</div>
        </div>
        
        <div>
          <div className="text-blue-700">Tempo est.</div>
          <div className="font-semibold text-blue-900">{status.estimatedWait}min</div>
        </div>
      </div>
      
      {status.queueCount > 0 && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 16.5C3.962 18.333 4.924 20 6.464 20z" />
            </svg>
            Há conversas aguardando atendimento
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueStatus;
```

### 4.11: Status do Agente

**Arquivo: `apps/frontend/src/components/Chat/AgentStatus.jsx`**

```javascript
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';

const AgentStatus = () => {
  const { user } = useAuth();
  const { setAgentStatus } = useChat();
  const [currentStatus, setCurrentStatus] = useState('online');

  if (user?.role !== 'agent') return null;

  const statusOptions = [
    { value: 'available', label: 'Disponível', color: 'bg-green-500' },
    { value: 'busy', label: 'Ocupado', color: 'bg-red-500' },
    { value: 'away', label: 'Ausente', color: 'bg-yellow-500' },
  ];

  const handleStatusChange = (status) => {
    setCurrentStatus(status);
    setAgentStatus(status);
  };

  const getCurrentStatusConfig = () => {
    return statusOptions.find(option => option.value === currentStatus) || statusOptions[0];
  };

  const currentConfig = getCurrentStatusConfig();

  return (
    <div className="relative">
      <button
        className="w-full flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        onClick={() => {/* Implementar dropdown */}}
      >
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${currentConfig.color}`}></div>
          <span className="text-sm font-medium text-gray-900">
            {currentConfig.label}
          </span>
        </div>
        
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Implementar dropdown menu aqui se necessário */}
    </div>
  );
};

export default AgentStatus;
```

## 🚀 Etapa 5: Configuração e Deploy

### 5.1: Variáveis de Ambiente

**Arquivo: `apps/backend/.env`**

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/saas_chat?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="24h"

# App
PORT=3000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"

# Redis (opcional para escalar WebSockets)
REDIS_URL="redis://localhost:6379"
```

**Arquivo: `apps/frontend/.env`**

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

### 5.2: Scripts de Inicialização

**Arquivo: `scripts/start-dev.sh`**

```bash
#!/bin/bash

# Iniciar PostgreSQL (se usando Docker)
docker-compose up -d postgres

# Aguardar PostgreSQL inicializar
sleep 5

# Executar migrations
cd apps/backend
npx prisma migrate dev
npx prisma generate
cd ../..

# Iniciar aplicações
pnpm dev
```

### 5.3: Docker Compose para Desenvolvimento

**Arquivo: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: saas_chat
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## ✅ Checklist de Implementação

### Backend Completo:
- [ ] Schema Prisma atualizado com conversas e mensagens
- [ ] Gateway WebSocket configurado com Socket.io
- [ ] Service de chat com todas as funcionalidades
- [ ] Controller de chat com APIs REST
- [ ] Sistema de filas de atendimento
- [ ] Autenticação JWT integrada
- [ ] Módulos devidamente configurados

### Frontend Completo:
- [ ] Socket.io client configurado
- [ ] Context de Chat com gerenciamento de estado
- [ ] Interface principal de chat responsiva
- [ ] Lista de conversas com filtros
- [ ] Janela de chat com mensagens em tempo real
- [ ] Componentes de mensagem (texto, imagem, arquivo)
- [ ] Input de mensagem com upload
- [ ] Indicadores de digitação
- [ ] Status de agente e fila
- [ ] Integração completa com WebSockets

### Funcionalidades Implementadas:
- [ ] ✅ Chat em tempo real
- [ ] ✅ Sistema de filas automático
- [ ] ✅ Atribuição de agentes
- [ ] ✅ Status online/offline
- [ ] ✅ Indicadores de digitação
- [ ] ✅ Histórico de mensagens
- [ ] ✅ Interface moderna e responsiva
- [ ] ✅ Preparação para upload de arquivos
- [ ] ✅ Sistema de notificações
- [ ] ✅ Dashboard básico para agentes

## 🔧 Comandos para Execução

### 1. Instalar Dependências
```bash
# Na raiz do projeto
pnpm install

# Backend específico
cd apps/backend && npm install

# Frontend específico
cd apps/frontend && npm install
```

### 2. Configurar Banco de Dados
```bash
# Inicializar Docker (PostgreSQL)
docker-compose up -d postgres

# Executar migrations
cd apps/backend
npx prisma migrate dev --name "sprint2-chat-system"
npx prisma generate
```

### 3. Iniciar Aplicação
```bash
# Na raiz - modo desenvolvimento
pnpm dev

# Ou individualmente:
# Backend
cd apps/backend && npm run start:dev

# Frontend  
cd apps/frontend && npm run dev
```

### 4. Acessar Aplicação
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- WebSocket: ws://localhost:3000/chat

---

## 🎯 Próximas Etapas (Sprint 3)

Após completar esta sprint, você terá:
- ✅ Sistema de chat funcionando em tempo real
- ✅ Filas de atendimento automatizadas  
- ✅ Interface moderna e responsiva
- ✅ Base sólida para próximas funcionalidades

**Sprint 3 focará em:**
- Upload de arquivos e mídias
- Gravação de áudio
- Preview de arquivos no chat
- Otimizações de performance
          