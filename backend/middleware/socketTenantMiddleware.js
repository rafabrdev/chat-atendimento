const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

/**
 * Middleware para autenticar e resolver tenant em conexões Socket.IO
 * Suporta múltiplas formas de identificação de tenant
 */
class SocketTenantMiddleware {
  constructor() {
    // Map para armazenar conexões por tenant
    this.tenantConnections = new Map();
    
    // Map para armazenar informações de conexão
    this.connectionInfo = new Map();
  }

  /**
   * Middleware de autenticação para Socket.IO
   */
  async authenticate(socket, next) {
    try {
      console.log('[SocketTenant] Nova conexão Socket.IO');
      
      const token = socket.handshake.auth?.token;
      const tenantKey = socket.handshake.auth?.tenantKey;
      const tenantId = socket.handshake.auth?.tenantId;
      
      // Validar token JWT
      if (!token) {
        console.log('[SocketTenant] Token não fornecido');
        return next(new Error('Authentication required'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        console.log('[SocketTenant] Token inválido:', error.message);
        return next(new Error('Invalid token'));
      }

      // Buscar usuário
      const user = await User.findById(decoded.id).populate('tenantId');
      if (!user) {
        console.log('[SocketTenant] Usuário não encontrado:', decoded.id);
        return next(new Error('User not found'));
      }

      // Resolver tenant
      let tenant = null;
      let resolvedBy = null;

      // 1. Prioridade: Tenant do usuário
      if (user.tenantId) {
        tenant = typeof user.tenantId === 'object' ? user.tenantId : await Tenant.findById(user.tenantId);
        resolvedBy = 'user-tenant';
      }

      // 2. Tenant especificado no handshake
      if (!tenant && tenantId) {
        tenant = await Tenant.findById(tenantId);
        resolvedBy = 'handshake-id';
        
        // Validar que o usuário tem acesso a este tenant
        if (tenant && user.role !== 'master' && user.tenantId?.toString() !== tenantId) {
          console.log('[SocketTenant] Usuário não tem acesso ao tenant especificado');
          return next(new Error('Access denied to specified tenant'));
        }
      }

      // 3. Tenant por key/slug
      if (!tenant && tenantKey) {
        // Buscar primeiro por key, depois por slug para compatibilidade
        tenant = await Tenant.findOne({ 
          $or: [
            { key: tenantKey.toLowerCase() },
            { slug: tenantKey.toLowerCase() }
          ]
        });
        resolvedBy = 'handshake-key';
        
        // Validar acesso
        if (tenant && user.role !== 'master' && user.tenantId?.toString() !== tenant._id.toString()) {
          console.log('[SocketTenant] Usuário não tem acesso ao tenant especificado');
          return next(new Error('Access denied to specified tenant'));
        }
      }

      // 4. Fallback para tenant default
      if (!tenant && process.env.USE_DEFAULT_TENANT_FALLBACK === 'true') {
        tenant = await Tenant.findOne({ key: 'default' });
        resolvedBy = 'fallback-default';
      }

      // Validar tenant
      if (tenant) {
        if (!tenant.isActive) {
          console.log('[SocketTenant] Tenant inativo:', tenant.slug);
          return next(new Error('Tenant suspended'));
        }

        // Anexar informações ao socket
        socket.tenant = tenant;
        socket.tenantId = tenant._id.toString();
        socket.tenantKey = tenant.key;
        socket.user = user;
        socket.userId = user._id.toString();
        socket.userRole = user.role;
        socket.resolvedBy = resolvedBy;

        // Registrar conexão
        this.registerConnection(socket);

        console.log(`[SocketTenant] ✅ Conexão autenticada: User ${user.email} | Tenant ${tenant.key || tenant.slug} (${resolvedBy})`);
        
        next();
      } else if (user.role === 'master') {
        // Master sem tenant específico
        socket.user = user;
        socket.userId = user._id.toString();
        socket.userRole = 'master';
        socket.isMaster = true;
        
        console.log('[SocketTenant] ✅ Master conectado sem tenant específico');
        next();
      } else {
        console.log('[SocketTenant] Tenant não identificado para usuário:', user.email);
        next(new Error('Tenant not identified'));
      }
    } catch (error) {
      console.error('[SocketTenant] Erro na autenticação:', error);
      next(new Error('Authentication failed'));
    }
  }

  /**
   * Registra uma conexão no mapa de tenants
   */
  registerConnection(socket) {
    const tenantId = socket.tenantId;
    
    // Adicionar ao mapa de conexões por tenant
    if (!this.tenantConnections.has(tenantId)) {
      this.tenantConnections.set(tenantId, new Set());
    }
    this.tenantConnections.get(tenantId).add(socket.id);

    // Armazenar informações da conexão
    this.connectionInfo.set(socket.id, {
      tenantId,
      userId: socket.userId,
      userRole: socket.userRole,
      connectedAt: new Date()
    });

    // Fazer o socket entrar nas rooms apropriadas
    socket.join(`tenant:${tenantId}`);
    
    // Room específica por role
    if (socket.userRole === 'agent' || socket.userRole === 'admin') {
      socket.join(`tenant:${tenantId}:agents`);
    } else if (socket.userRole === 'client') {
      socket.join(`tenant:${tenantId}:clients`);
    }

    console.log(`[SocketTenant] Socket ${socket.id} registrado no tenant ${socket.tenant.key || socket.tenant.slug}`);
  }

  /**
   * Remove uma conexão dos registros
   */
  unregisterConnection(socketId) {
    const info = this.connectionInfo.get(socketId);
    
    if (info) {
      // Remover do mapa de conexões por tenant
      const connections = this.tenantConnections.get(info.tenantId);
      if (connections) {
        connections.delete(socketId);
        
        // Limpar o Set se estiver vazio
        if (connections.size === 0) {
          this.tenantConnections.delete(info.tenantId);
        }
      }

      // Remover informações da conexão
      this.connectionInfo.delete(socketId);
      
      console.log(`[SocketTenant] Socket ${socketId} removido do tenant`);
    }
  }

  /**
   * Middleware para validar tenant em eventos
   */
  validateTenantAccess(eventName) {
    return (socket, data, next) => {
      // Master tem acesso a tudo
      if (socket.isMaster) {
        return next();
      }

      // Verificar se o socket tem tenant
      if (!socket.tenantId) {
        return next(new Error('Tenant not identified'));
      }

      // Verificar se o tenant está ativo
      if (socket.tenant && !socket.tenant.isActive) {
        return next(new Error('Tenant suspended'));
      }

      // Validações específicas por evento
      if (data && data.tenantId && data.tenantId !== socket.tenantId) {
        console.log(`[SocketTenant] Tentativa de acesso cross-tenant bloqueada: ${eventName}`);
        return next(new Error('Cross-tenant access denied'));
      }

      next();
    };
  }

  /**
   * Middleware para validar módulo do tenant
   */
  requireModule(moduleName) {
    return (socket, data, next) => {
      // Master tem acesso a tudo
      if (socket.isMaster) {
        return next();
      }

      if (!socket.tenant) {
        return next(new Error('Tenant not identified'));
      }

      if (!socket.tenant.hasModule(moduleName)) {
        return next(new Error(`Module ${moduleName} not enabled`));
      }

      next();
    };
  }

  /**
   * Aplicar escopo de tenant aos dados
   */
  applyTenantScope(socket, data) {
    if (socket.tenantId && !socket.isMaster) {
      return {
        ...data,
        tenantId: socket.tenantId
      };
    }
    return data;
  }

  /**
   * Emitir evento para todos os sockets de um tenant
   */
  emitToTenant(io, tenantId, event, data) {
    io.to(`tenant:${tenantId}`).emit(event, data);
  }

  /**
   * Emitir evento para agentes de um tenant
   */
  emitToTenantAgents(io, tenantId, event, data) {
    io.to(`tenant:${tenantId}:agents`).emit(event, data);
  }

  /**
   * Emitir evento para clientes de um tenant
   */
  emitToTenantClients(io, tenantId, event, data) {
    io.to(`tenant:${tenantId}:clients`).emit(event, data);
  }

  /**
   * Obter estatísticas de conexões por tenant
   */
  getConnectionStats() {
    const stats = {};
    
    for (const [tenantId, connections] of this.tenantConnections.entries()) {
      stats[tenantId] = {
        totalConnections: connections.size,
        connections: Array.from(connections).map(socketId => {
          const info = this.connectionInfo.get(socketId);
          return {
            socketId,
            userId: info?.userId,
            userRole: info?.userRole,
            connectedAt: info?.connectedAt
          };
        })
      };
    }
    
    return stats;
  }

  /**
   * Verificar se um usuário está conectado
   */
  isUserConnected(userId, tenantId = null) {
    for (const [socketId, info] of this.connectionInfo.entries()) {
      if (info.userId === userId) {
        if (!tenantId || info.tenantId === tenantId) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Obter sockets de um usuário específico
   */
  getUserSockets(userId, tenantId = null) {
    const sockets = [];
    
    for (const [socketId, info] of this.connectionInfo.entries()) {
      if (info.userId === userId) {
        if (!tenantId || info.tenantId === tenantId) {
          sockets.push(socketId);
        }
      }
    }
    
    return sockets;
  }
}

module.exports = SocketTenantMiddleware;
