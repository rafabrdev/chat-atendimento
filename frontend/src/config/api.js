import axios from 'axios';
import authService from '../services/authService';
import errorService from '../services/errorService';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Criar instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Aumentado para dar tempo ao refresh
  headers: {
    'Content-Type': 'application/json',
  },
});

// Criar instância pública para rotas que não requerem autenticação
export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - adiciona token e tenant headers
api.interceptors.request.use(
  (config) => {
    // Skip auth for certain requests
    if (config._skipAuthInterceptor) {
      return config;
    }

    // Add access token
    const token = authService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add tenant ID header if available
    const tenantId = authService.getTenantId();
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }

    // Add request ID for tracing
    config.headers['X-Request-ID'] = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and refresh tokens
api.interceptors.response.use(
  (response) => {
    // Success response
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Skip if it's a refresh request
    if (originalRequest._skipAuthInterceptor) {
      return Promise.reject(error);
    }

    // Enhanced error handling with errorService
    if (error.response?.data?.code) {
      // If backend provides error code, use errorService
      errorService.handleError({
        ...error,
        code: error.response.data.code,
        data: error.response.data
      });
    } else {
      // Legacy error handling for backward compatibility
      const errorAction = authService.mapErrorToAction(error);

      // Handle specific error actions
      switch (errorAction.action) {
      case 'TENANT_INACTIVE':
        if (errorAction.showModal) {
          // Show modal (this would be handled by a global modal manager)
          toast.error(errorAction.message, { duration: 10000 });
        }
        if (errorAction.logout) {
          authService.clearAuthData();
          window.location.href = '/login';
        }
        break;

      case 'SUBSCRIPTION_SUSPENDED':
        toast.warning(errorAction.message, {
          duration: 8000,
          action: {
            label: 'Upgrade',
            onClick: () => window.location.href = errorAction.ctaLink
          }
        });
        break;

      case 'PLAN_LIMIT_REACHED':
        if (errorAction.showToast) {
          toast.warning(errorAction.message, { duration: 6000 });
        }
        if (errorAction.showUpgrade) {
          // Trigger upgrade modal (handled by global state)
          window.dispatchEvent(new CustomEvent('show-upgrade-modal'));
        }
        break;

      case 'MODULE_DISABLED':
        if (errorAction.showToast) {
          toast.info(errorAction.message, { duration: 5000 });
        }
        break;

      case 'PERMISSION_DENIED':
        if (errorAction.showToast) {
          toast.error(errorAction.message);
        }
        break;

      case 'AUTH_ERROR':
      case 'TOKEN_EXPIRED':
      case 'INVALID_TOKEN':
        // Handle token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await authService.refreshAccessToken(api);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            // Refresh failed, user will be redirected to login by authService
            return Promise.reject(refreshError);
          }
        }
        break;

      case 'RATE_LIMIT':
        if (errorAction.showToast) {
          toast.error(errorAction.message, { 
            duration: errorAction.retryAfter * 1000 
          });
        }
        break;

      case 'UNAUTHORIZED':
        // Only logout if it's not a token issue (already handled above)
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (errorAction.logout) {
            authService.clearAuthData();
            window.location.href = '/login';
          }
        }
        break;

      case 'FORBIDDEN':
      case 'SERVER_ERROR':
        if (errorAction.showToast) {
          toast.error(errorAction.message);
        }
        break;

      case 'NETWORK_ERROR':
        console.error('[API Interceptor] Network error detected:', error);
        toast.error(errorAction.message, { duration: 5000 });
        break;

        default:
          // Only show toast for non-404 errors
          if (error.response?.status !== 404 && errorAction.severity === 'error') {
            toast.error(errorAction.message);
          }
      }
    }

    // Always reject the promise so the calling code can handle it
    return Promise.reject(error);
  }
);

// Export additional utilities
export const setupAuthAutoRefresh = () => {
  authService.setupAutoRefresh(api);
};

export const clearAuthAutoRefresh = () => {
  authService.clearAutoRefresh();
};

// Test helper to simulate concurrent requests with expired token
export const testConcurrentRefresh = async (requestCount = 10) => {
  console.log(`🧪 Testing ${requestCount} concurrent requests with expired token...`);
  
  // Force token to be "expired" by manipulating the check
  const originalIsTokenExpired = authService.isTokenExpired;
  authService.isTokenExpired = () => true;
  
  const requests = [];
  for (let i = 0; i < requestCount; i++) {
    requests.push(
      api.get('/auth/profile')
        .then(() => ({ id: i, status: 'success' }))
        .catch(() => ({ id: i, status: 'failed' }))
    );
  }
  
  const results = await Promise.allSettled(requests);
  
  // Restore original function
  authService.isTokenExpired = originalIsTokenExpired;
  
  // Count how many refresh calls were made (should be 1)
  const successCount = results.filter(r => r.value?.status === 'success').length;
  const failCount = results.filter(r => r.value?.status === 'failed').length;
  
  console.log(`✅ Results: ${successCount} success, ${failCount} failed`);
  console.log('Check network tab - there should be only 1 refresh call!');
  
  return results;
};

export default api;
