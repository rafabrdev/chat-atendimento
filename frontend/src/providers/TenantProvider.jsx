/**
 * Tenant Provider Context
 * 
 * Provides tenant information, branding, and feature gating
 * throughout the application
 */

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import tenantService from '../services/tenantService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Create context
const TenantContext = createContext({});

// Provider component
export const TenantProvider = ({ children }) => {
  const { user, token } = useAuth();
  
  // State
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [features, setFeatures] = useState({});
  
  /**
   * Load tenant information
   */
  const loadTenant = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Resolve tenant by subdomain or key
      const tenantData = await tenantService.resolveTenant();
      
      if (!tenantData) {
        throw new Error('Tenant not found');
      }
      
      setTenant(tenantData);
      
      // Apply branding
      tenantService.applyBranding(tenantData);
      
      // Process features
      processFeatures(tenantData);
      
      // Log for debugging
      console.log('[TenantProvider] Tenant loaded:', {
        id: tenantData._id,
        key: tenantData.key,
        name: tenantData.name,
        plan: tenantData.plan?.name,
        status: tenantData.status
      });
      
      return tenantData;
    } catch (err) {
      console.error('[TenantProvider] Error loading tenant:', err);
      setError(err.message);
      
      // Show error toast
      toast.error('Erro ao carregar informações do tenant', {
        duration: 5000
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Process tenant features and limits
   */
  const processFeatures = (tenantData) => {
    if (!tenantData) {
      setFeatures({});
      return;
    }
    
    const { plan, allowedModules, limits } = tenantData;
    const processedFeatures = {};
    
    // Process plan features
    if (plan?.features) {
      plan.features.forEach(feature => {
        processedFeatures[feature] = true;
      });
    }
    
    // Process allowed modules
    if (allowedModules) {
      allowedModules.forEach(module => {
        processedFeatures[module] = true;
      });
    }
    
    // Process limits as features
    if (limits) {
      Object.keys(limits).forEach(key => {
        if (typeof limits[key] === 'boolean') {
          processedFeatures[key] = limits[key];
        }
      });
    }
    
    setFeatures(processedFeatures);
  };
  
  /**
   * Check if a feature is allowed
   */
  const isFeatureAllowed = useCallback((feature) => {
    // Master admin bypass
    if (user?.role === 'master') {
      return true;
    }
    
    // Check tenant status
    if (tenant?.status !== 'active') {
      return false;
    }
    
    // Check feature flag
    return features[feature] === true;
  }, [tenant, features, user]);
  
  /**
   * Get tenant limit
   */
  const getTenantLimit = useCallback((limitKey) => {
    if (!tenant?.limits) return null;
    return tenant.limits[limitKey];
  }, [tenant]);
  
  /**
   * Check if limit is exceeded
   */
  const isLimitExceeded = useCallback((limitKey, currentValue) => {
    const limit = getTenantLimit(limitKey);
    if (!limit) return false;
    return currentValue >= limit;
  }, [getTenantLimit]);
  
  /**
   * Update tenant settings
   */
  const updateTenantSettings = useCallback(async (settings) => {
    if (!tenant?._id) {
      throw new Error('No tenant loaded');
    }
    
    try {
      const updated = await tenantService.updateTenantSettings(tenant._id, settings);
      
      // Update local state
      setTenant(prev => ({
        ...prev,
        ...updated.data
      }));
      
      // Reapply branding if changed
      if (settings.branding) {
        tenantService.applyBranding({ ...tenant, ...updated.data });
      }
      
      // Reprocess features if plan changed
      if (settings.plan || settings.allowedModules || settings.limits) {
        processFeatures({ ...tenant, ...updated.data });
      }
      
      toast.success('Configurações atualizadas com sucesso');
      
      return updated;
    } catch (err) {
      console.error('[TenantProvider] Error updating settings:', err);
      toast.error('Erro ao atualizar configurações');
      throw err;
    }
  }, [tenant]);
  
  /**
   * Reload tenant data
   */
  const reloadTenant = useCallback(async () => {
    return loadTenant();
  }, [loadTenant]);
  
  /**
   * Get tenant branding colors
   */
  const getBrandingColors = useCallback(() => {
    return tenant?.branding?.colors || {
      primary: '#007bff',
      secondary: '#6c757d',
      accent: '#28a745',
      background: '#ffffff',
      text: '#212529'
    };
  }, [tenant]);
  
  /**
   * Get tenant logo URL
   */
  const getLogoUrl = useCallback(() => {
    return tenant?.branding?.logoUrl || '/logo.png';
  }, [tenant]);
  
  /**
   * Get tenant plan info
   */
  const getPlanInfo = useCallback(() => {
    if (!tenant?.plan) {
      return {
        name: 'Free',
        level: 0,
        features: []
      };
    }
    
    return {
      name: tenant.plan.name,
      level: tenant.plan.level || 0,
      features: tenant.plan.features || [],
      limits: tenant.limits || {}
    };
  }, [tenant]);
  
  /**
   * Check tenant status
   */
  const isTenantActive = useCallback(() => {
    return tenant?.status === 'active';
  }, [tenant]);
  
  const isTenantSuspended = useCallback(() => {
    return tenant?.status === 'suspended';
  }, [tenant]);
  
  const isTenantInactive = useCallback(() => {
    return tenant?.status === 'inactive';
  }, [tenant]);
  
  // Load tenant on mount
  useEffect(() => {
    loadTenant();
  }, [loadTenant]);
  
  // Reload tenant when user changes
  useEffect(() => {
    if (user && token) {
      loadTenant();
    }
  }, [user?.tenantId, token, loadTenant]);
  
  // Context value
  const value = {
    // State
    tenant,
    loading,
    error,
    features,
    
    // Methods
    loadTenant,
    reloadTenant,
    updateTenantSettings,
    
    // Feature checking
    isFeatureAllowed,
    getTenantLimit,
    isLimitExceeded,
    
    // Branding
    getBrandingColors,
    getLogoUrl,
    
    // Plan info
    getPlanInfo,
    
    // Status checks
    isTenantActive,
    isTenantSuspended,
    isTenantInactive
  };
  
  // Show loading state
  if (loading && !tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }
  
  // Show error state if critical error
  if (error && !tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar aplicação</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

// Custom hook to use tenant context
export const useTenant = () => {
  const context = useContext(TenantContext);
  
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  
  return context;
};

export default TenantProvider;
