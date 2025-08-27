/**
 * Sistema de Permissões Baseado em Roles
 * 
 * Hierarquia:
 * - master: Acesso total ao sistema, gerencia múltiplas empresas
 * - admin: Gerencia uma empresa específica e seus usuários
 * - agent: Atende clientes via chat
 * - client: Recebe suporte via chat
 */

const permissions = {
  // Permissões do Master (Sistema Completo)
  master: {
    // Gestão de Tenants (Empresas)
    tenants: {
      create: true,
      read: true,
      update: true,
      delete: true,
      suspend: true,
      viewAll: true,
      managePlans: true,
      viewAnalytics: true,
      exportData: true
    },
    
    // Gestão de Admins de Empresas
    admins: {
      create: true,
      read: true,
      update: true,
      delete: true,
      resetPassword: true,
      impersonate: true,
      viewAll: true
    },
    
    // Dashboard Master
    dashboard: {
      viewGlobal: true,
      viewRevenue: true,
      viewGrowth: true,
      viewSystemHealth: true,
      viewAllMetrics: true
    },
    
    // Configurações do Sistema
    system: {
      manageModules: true,
      managePlans: true,
      manageIntegrations: true,
      viewLogs: true,
      performMaintenance: true,
      backupData: true
    },
    
    // Billing e Financeiro
    billing: {
      viewAllInvoices: true,
      manageSubscriptions: true,
      issueRefunds: true,
      viewPaymentHistory: true,
      managePricing: true
    }
  },
  
  // Permissões do Admin (Empresa Específica)
  admin: {
    // Gestão da Própria Empresa
    company: {
      read: true,
      update: true,
      updateBranding: true,
      manageSettings: true,
      viewAnalytics: true,
      exportData: true
    },
    
    // Gestão de Agentes
    agents: {
      create: true,
      read: true,
      update: true,
      delete: true,
      assignDepartments: true,
      viewPerformance: true,
      manageSchedules: true,
      bulkImport: true
    },
    
    // Gestão de Clientes
    clients: {
      invite: true,
      create: true,
      read: true,
      update: true,
      delete: true,
      viewHistory: true,
      exportData: true,
      bulkInvite: true
    },
    
    // Dashboard Admin
    dashboard: {
      viewCompanyMetrics: true,
      viewAgentPerformance: true,
      viewClientSatisfaction: true,
      viewChatVolume: true,
      generateReports: true
    },
    
    // Gestão de Chats
    chats: {
      viewAll: true,
      monitor: true,
      intervene: true,
      close: true,
      transfer: true,
      viewTranscripts: true,
      exportHistory: true
    },
    
    // Configurações da Empresa
    settings: {
      manageIntegrations: true,
      manageDepartments: true,
      manageBusinessHours: true,
      manageAutoResponders: true,
      manageChatWidget: true,
      manageEmailTemplates: true
    }
  },
  
  // Permissões do Agente
  agent: {
    // Gestão do Próprio Perfil
    profile: {
      read: true,
      update: true,
      updateAvailability: true,
      viewOwnMetrics: true
    },
    
    // Gestão de Chats
    chats: {
      accept: true,
      handle: true,
      close: true,
      transfer: true,
      viewAssigned: true,
      addNotes: true,
      uploadFiles: true
    },
    
    // Clientes
    clients: {
      viewAssigned: true,
      viewHistory: true,
      addNotes: true,
      updateInfo: true
    },
    
    // Dashboard do Agente
    dashboard: {
      viewOwnMetrics: true,
      viewQueue: true,
      viewSchedule: true
    },
    
    // Ferramentas
    tools: {
      useCannedResponses: true,
      useKnowledgeBase: true,
      createTickets: true
    }
  },
  
  // Permissões do Cliente
  client: {
    // Gestão do Próprio Perfil
    profile: {
      read: true,
      update: true,
      changePassword: true,
      deleteAccount: true
    },
    
    // Chat
    chat: {
      start: true,
      send: true,
      uploadFiles: true,
      rate: true,
      viewHistory: true,
      downloadTranscript: true
    },
    
    // Suporte
    support: {
      createTicket: true,
      viewOwnTickets: true,
      replyToTickets: true
    },
    
    // Dashboard do Cliente
    dashboard: {
      viewOwnHistory: true,
      viewOwnTickets: true
    }
  }
};

/**
 * Verifica se um role tem uma permissão específica
 * @param {string} role - Role do usuário
 * @param {string} resource - Recurso a ser acessado
 * @param {string} action - Ação a ser executada
 * @returns {boolean}
 */
function hasPermission(role, resource, action) {
  if (!permissions[role]) return false;
  if (!permissions[role][resource]) return false;
  return permissions[role][resource][action] === true;
}

/**
 * Retorna todas as permissões de um role
 * @param {string} role - Role do usuário
 * @returns {object}
 */
function getRolePermissions(role) {
  return permissions[role] || {};
}

/**
 * Verifica se um role pode executar ação em outro role
 * @param {string} actorRole - Role que está executando a ação
 * @param {string} targetRole - Role alvo da ação
 * @returns {boolean}
 */
function canManageRole(actorRole, targetRole) {
  const hierarchy = {
    master: ['admin', 'agent', 'client'],
    admin: ['agent', 'client'],
    agent: [],
    client: []
  };
  
  return hierarchy[actorRole]?.includes(targetRole) || false;
}

/**
 * Lista recursos disponíveis para um role
 * @param {string} role - Role do usuário
 * @returns {array}
 */
function getAvailableResources(role) {
  if (!permissions[role]) return [];
  return Object.keys(permissions[role]);
}

/**
 * Verifica múltiplas permissões de uma vez
 * @param {string} role - Role do usuário
 * @param {array} requiredPermissions - Array de permissões [{resource, action}]
 * @returns {boolean}
 */
function hasAllPermissions(role, requiredPermissions) {
  return requiredPermissions.every(perm => 
    hasPermission(role, perm.resource, perm.action)
  );
}

/**
 * Verifica se tem pelo menos uma das permissões
 * @param {string} role - Role do usuário
 * @param {array} requiredPermissions - Array de permissões [{resource, action}]
 * @returns {boolean}
 */
function hasAnyPermission(role, requiredPermissions) {
  return requiredPermissions.some(perm => 
    hasPermission(role, perm.resource, perm.action)
  );
}

module.exports = {
  permissions,
  hasPermission,
  getRolePermissions,
  canManageRole,
  getAvailableResources,
  hasAllPermissions,
  hasAnyPermission
};
