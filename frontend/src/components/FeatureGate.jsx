/**
 * FeatureGate Component
 * 
 * Controls visibility and access to features based on tenant plan and limits
 */

import React from 'react';
import { useTenant } from '../providers/TenantProvider';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/**
 * FeatureGate - Controls feature visibility
 * 
 * @param {string} feature - Feature key to check
 * @param {ReactNode} children - Content to render if feature is allowed
 * @param {ReactNode} fallback - Optional fallback content if feature is not allowed
 * @param {boolean} silent - If true, don't show toast when feature is blocked
 * @param {string} message - Custom message to show when feature is blocked
 * @param {Function} onBlock - Callback when feature is blocked
 */
export const FeatureGate = ({ 
  feature, 
  children, 
  fallback = null,
  silent = false,
  message = null,
  onBlock = null
}) => {
  const { isFeatureAllowed, tenant, getPlanInfo } = useTenant();
  const { user } = useAuth();
  
  // Check if feature is allowed
  const allowed = isFeatureAllowed(feature);
  
  if (allowed) {
    return <>{children}</>;
  }
  
  // Feature is not allowed
  if (!silent && !fallback) {
    const planInfo = getPlanInfo();
    const defaultMessage = message || `Este recurso não está disponível no plano ${planInfo.name}`;
    
    // Show toast notification once
    if (typeof onBlock === 'function') {
      onBlock(feature, planInfo);
    } else {
      // Use a flag to prevent multiple toasts
      if (!window._featureGateToasts) {
        window._featureGateToasts = new Set();
      }
      
      const toastKey = `${feature}-${user?.id}`;
      if (!window._featureGateToasts.has(toastKey)) {
        window._featureGateToasts.add(toastKey);
        
        toast.error(defaultMessage, {
          duration: 5000,
          icon: '🔒'
        });
        
        // Clear flag after some time
        setTimeout(() => {
          window._featureGateToasts.delete(toastKey);
        }, 10000);
      }
    }
  }
  
  return <>{fallback}</>;
};

/**
 * FeatureButton - Button that shows upgrade prompt if feature is not allowed
 */
export const FeatureButton = ({ 
  feature, 
  children, 
  onClick,
  className = '',
  ...props 
}) => {
  const { isFeatureAllowed, getPlanInfo } = useTenant();
  const allowed = isFeatureAllowed(feature);
  
  const handleClick = (e) => {
    if (!allowed) {
      e.preventDefault();
      e.stopPropagation();
      
      const planInfo = getPlanInfo();
      
      toast((t) => (
        <div>
          <p className="font-semibold mb-2">Recurso Premium 🌟</p>
          <p className="text-sm mb-3">
            Este recurso está disponível em planos superiores ao {planInfo.name}.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                window.location.href = '/pricing';
              }}
              className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary-dark"
            >
              Ver Planos
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
            >
              Fechar
            </button>
          </div>
        </div>
      ), {
        duration: 10000,
        position: 'top-center'
      });
      
      return;
    }
    
    if (onClick) {
      onClick(e);
    }
  };
  
  return (
    <button
      {...props}
      onClick={handleClick}
      className={`${className} ${!allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={!allowed ? 'Recurso não disponível no seu plano' : ''}
    >
      {children}
      {!allowed && (
        <span className="ml-2 text-xs">
          🔒
        </span>
      )}
    </button>
  );
};

/**
 * FeatureBadge - Shows a badge indicating feature availability
 */
export const FeatureBadge = ({ feature, className = '' }) => {
  const { isFeatureAllowed, getPlanInfo } = useTenant();
  const allowed = isFeatureAllowed(feature);
  const planInfo = getPlanInfo();
  
  if (allowed) {
    return null;
  }
  
  return (
    <span 
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 ${className}`}
      title={`Disponível em planos superiores ao ${planInfo.name}`}
    >
      Premium
    </span>
  );
};

/**
 * PlanLimit - Shows current usage vs limit for a resource
 */
export const PlanLimit = ({ 
  limitKey, 
  current, 
  label,
  showProgress = true,
  className = '' 
}) => {
  const { getTenantLimit, isLimitExceeded } = useTenant();
  
  const limit = getTenantLimit(limitKey);
  const exceeded = isLimitExceeded(limitKey, current);
  
  if (!limit) {
    return null;
  }
  
  const percentage = Math.min(100, (current / limit) * 100);
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 95 || exceeded;
  
  return (
    <div className={`${className}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className={`text-sm font-medium ${
          isDanger ? 'text-red-600' : 
          isWarning ? 'text-yellow-600' : 
          'text-gray-900'
        }`}>
          {current} / {limit}
        </span>
      </div>
      
      {showProgress && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              isDanger ? 'bg-red-500' : 
              isWarning ? 'bg-yellow-500' : 
              'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      
      {exceeded && (
        <p className="text-xs text-red-600 mt-1">
          Limite excedido. Faça upgrade do seu plano.
        </p>
      )}
    </div>
  );
};

/**
 * TenantStatusGate - Controls access based on tenant status
 */
export const TenantStatusGate = ({ children, fallback = null }) => {
  const { isTenantActive, isTenantSuspended, tenant } = useTenant();
  
  if (isTenantActive()) {
    return <>{children}</>;
  }
  
  if (isTenantSuspended()) {
    return fallback || (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Conta Suspensa
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>Sua conta está temporariamente suspensa. Entre em contato com o suporte para mais informações.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Tenant is inactive
  return fallback || (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Conta Inativa
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>Sua conta está inativa. Entre em contato com o administrador.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export all components
export default FeatureGate;
