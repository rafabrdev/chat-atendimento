/**
 * Tenant Service
 * 
 * Service for managing tenant-related API calls
 */

import api from '../config/api';
import authService from './authService';

class TenantService {
  constructor() {
    // Cache do tenant atual
    this.currentTenant = null;
    this.tenantLoadPromise = null;
  }

  /**
   * Resolve tenant by subdomain or key
   */
  async resolveTenant(key = null) {
    try {
      // Se não foi fornecido key, tentar extrair do subdomínio
      if (!key) {
        key = this.extractTenantFromHost();
      }

      // Se ainda não tem key, usar default
      if (!key) {
        key = 'default';
      }

      const response = await api.get('/tenants/resolve', {
        params: { key }
      });
      
      this.currentTenant = response.data.data;
      
      // Armazenar tenantId no authService
      if (this.currentTenant?._id) {
        authService.setTenantId(this.currentTenant._id);
      }
      
      return this.currentTenant;
    } catch (error) {
      console.error('Error resolving tenant:', error);
      // Em caso de erro, tentar usar tenant default
      if (key !== 'default') {
        return this.resolveTenant('default');
      }
      throw error;
    }
  }

  /**
   * Extract tenant key from hostname
   */
  extractTenantFromHost() {
    const hostname = window.location.hostname;
    
    // Se for localhost ou IP, verificar query param
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const params = new URLSearchParams(window.location.search);
      return params.get('tenant');
    }
    
    // Extrair subdomínio
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      // Tem subdomínio
      return parts[0];
    }
    
    return null;
  }

  /**
   * Load tenant if not already loaded
   */
  async ensureTenantLoaded() {
    if (this.currentTenant) {
      return this.currentTenant;
    }

    // Se já está carregando, aguardar
    if (this.tenantLoadPromise) {
      return this.tenantLoadPromise;
    }

    // Iniciar carregamento
    this.tenantLoadPromise = this.resolveTenant();
    
    try {
      const tenant = await this.tenantLoadPromise;
      return tenant;
    } finally {
      this.tenantLoadPromise = null;
    }
  }

  /**
   * Apply tenant branding to document
   */
  applyBranding(tenant) {
    if (!tenant?.branding) return;

    const { colors, fonts, logoUrl } = tenant.branding;
    const root = document.documentElement;

    // Aplicar cores
    if (colors) {
      if (colors.primary) root.style.setProperty('--primary-color', colors.primary);
      if (colors.secondary) root.style.setProperty('--secondary-color', colors.secondary);
      if (colors.accent) root.style.setProperty('--accent-color', colors.accent);
      if (colors.background) root.style.setProperty('--background-color', colors.background);
      if (colors.text) root.style.setProperty('--text-color', colors.text);
    }

    // Aplicar fontes
    if (fonts) {
      if (fonts.heading) root.style.setProperty('--font-heading', fonts.heading);
      if (fonts.body) root.style.setProperty('--font-body', fonts.body);
    }

    // Atualizar favicon e título
    if (tenant.name) {
      document.title = tenant.name;
    }

    // Aplicar favicon customizado se houver
    if (logoUrl) {
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.href = logoUrl;
      }
    }
  }

  /**
   * Check if feature is allowed for current tenant
   */
  isFeatureAllowed(feature) {
    if (!this.currentTenant) return false;
    
    const { plan, allowedModules, limits } = this.currentTenant;
    
    // Verificar módulos permitidos
    if (allowedModules && !allowedModules.includes(feature)) {
      return false;
    }
    
    // Verificar limites do plano
    if (limits && limits[feature] === false) {
      return false;
    }
    
    // Verificar features do plano
    if (plan?.features && !plan.features.includes(feature)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get current tenant cached
   */
  getCachedTenant() {
    return this.currentTenant;
  }
  /**
   * Get current tenant information
   */
  async getCurrentTenant() {
    try {
      const response = await api.get('/tenant/current');
      return response.data;
    } catch (error) {
      console.error('Error fetching current tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId) {
    try {
      const response = await api.get(`/tenant/${tenantId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tenant:', error);
      throw error;
    }
  }

  /**
   * Update tenant settings
   */
  async updateTenantSettings(tenantId, settings) {
    try {
      const response = await api.put(`/tenant/${tenantId}/settings`, settings);
      return response.data;
    } catch (error) {
      console.error('Error updating tenant settings:', error);
      throw error;
    }
  }

  /**
   * Update tenant profile
   */
  async updateTenantProfile(tenantId, profile) {
    try {
      const response = await api.put(`/tenant/${tenantId}`, profile);
      return response.data;
    } catch (error) {
      console.error('Error updating tenant profile:', error);
      throw error;
    }
  }

  /**
   * Upload tenant logo
   */
  async uploadLogo(tenantId, file) {
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await api.post(`/tenant/${tenantId}/logo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  }

  /**
   * Remove tenant logo
   */
  async removeLogo(tenantId) {
    try {
      const response = await api.delete(`/tenant/${tenantId}/logo`);
      return response.data;
    } catch (error) {
      console.error('Error removing logo:', error);
      throw error;
    }
  }

  /**
   * Update tenant theme
   */
  async updateTheme(tenantId, theme) {
    try {
      const response = await api.put(`/tenant/${tenantId}/theme`, theme);
      return response.data;
    } catch (error) {
      console.error('Error updating theme:', error);
      throw error;
    }
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantStats(tenantId) {
    try {
      const response = await api.get(`/tenant/${tenantId}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
      throw error;
    }
  }

  /**
   * Get tenant limits
   */
  async getTenantLimits(tenantId) {
    try {
      const response = await api.get(`/tenant/${tenantId}/limits`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tenant limits:', error);
      throw error;
    }
  }

  /**
   * Update tenant limits (admin only)
   */
  async updateTenantLimits(tenantId, limits) {
    try {
      const response = await api.put(`/tenant/${tenantId}/limits`, limits);
      return response.data;
    } catch (error) {
      console.error('Error updating tenant limits:', error);
      throw error;
    }
  }

  /**
   * Get tenant subscription info
   */
  async getSubscription(tenantId) {
    try {
      const response = await api.get(`/tenant/${tenantId}/subscription`);
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      throw error;
    }
  }

  /**
   * Get allowed origins for CORS
   */
  async getAllowedOrigins(tenantId) {
    try {
      const response = await api.get(`/cors/origins`);
      return response.data;
    } catch (error) {
      console.error('Error fetching allowed origins:', error);
      throw error;
    }
  }

  /**
   * Add allowed origin for CORS
   */
  async addAllowedOrigin(origin) {
    try {
      const response = await api.post('/cors/origins', { origin });
      return response.data;
    } catch (error) {
      console.error('Error adding allowed origin:', error);
      throw error;
    }
  }

  /**
   * Remove allowed origin for CORS
   */
  async removeAllowedOrigin(origin) {
    try {
      const response = await api.delete('/cors/origins', { data: { origin } });
      return response.data;
    } catch (error) {
      console.error('Error removing allowed origin:', error);
      throw error;
    }
  }

  /**
   * Validate tenant settings
   */
  validateSettings(settings) {
    const errors = {};

    // Validate company name
    if (!settings.name || settings.name.trim().length < 2) {
      errors.name = 'Nome da empresa deve ter pelo menos 2 caracteres';
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!settings.contactEmail || !emailRegex.test(settings.contactEmail)) {
      errors.contactEmail = 'Email de contato inválido';
    }

    // Validate phone (optional but if provided must be valid)
    if (settings.phone) {
      const phoneRegex = /^[\d\s()+-]+$/;
      if (!phoneRegex.test(settings.phone)) {
        errors.phone = 'Telefone inválido';
      }
    }

    // Validate website (optional but if provided must be valid URL)
    if (settings.website) {
      try {
        new URL(settings.website);
      } catch {
        errors.website = 'Website deve ser uma URL válida';
      }
    }

    // Validate limits
    if (settings.limits) {
      if (settings.limits.maxUsers && settings.limits.maxUsers < 1) {
        errors.maxUsers = 'Número máximo de usuários deve ser pelo menos 1';
      }
      if (settings.limits.maxAgents && settings.limits.maxAgents < 1) {
        errors.maxAgents = 'Número máximo de agentes deve ser pelo menos 1';
      }
      if (settings.limits.maxConversations && settings.limits.maxConversations < 1) {
        errors.maxConversations = 'Número máximo de conversas deve ser pelo menos 1';
      }
      if (settings.limits.maxStorage && settings.limits.maxStorage < 100) {
        errors.maxStorage = 'Armazenamento mínimo é 100 MB';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Calculate usage percentage
   */
  calculateUsagePercentage(used, limit) {
    if (!limit || limit === 0) return 0;
    const percentage = (used / limit) * 100;
    return Math.min(100, Math.max(0, percentage));
  }
}

export default new TenantService();
