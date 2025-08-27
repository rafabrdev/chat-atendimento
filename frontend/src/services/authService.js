/**
 * Authentication Service
 * 
 * Centralizes authentication logic including:
 * - Token management (access & refresh)
 * - Refresh token queue to prevent multiple concurrent refresh calls
 * - Secure token storage
 * - Error code mapping for UI behaviors
 */

class AuthService {
  constructor() {
    // Refresh token queue management
    this.isRefreshing = false;
    this.failedQueue = [];
    this.refreshPromise = null;
  }

  // Token storage interface (can be swapped to httpOnly cookies later)
  getAccessToken() {
    return localStorage.getItem('token');
  }

  setAccessToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  setRefreshToken(token) {
    if (token) {
      localStorage.setItem('refreshToken', token);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }

  getTenantId() {
    return localStorage.getItem('tenantId');
  }

  setTenantId(tenantId) {
    if (tenantId) {
      localStorage.setItem('tenantId', tenantId);
    } else {
      localStorage.removeItem('tenantId');
    }
  }

  getUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  setUser(user) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', user.id || user._id);
      if (user.tenantId) {
        this.setTenantId(user.tenantId);
      }
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
    }
  }

  // Store auth data after login/refresh
  storeAuthData({ token, refreshToken, user }) {
    this.setAccessToken(token);
    
    if (refreshToken) {
      this.setRefreshToken(refreshToken);
    }
    
    if (user) {
      this.setUser(user);
    }
  }

  // Clear all auth data
  clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('tenantId');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getAccessToken();
  }

  // Process refresh queue
  processQueue(error, token = null) {
    this.failedQueue.forEach(prom => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    
    this.failedQueue = [];
  }

  // Queue failed requests during refresh
  addToQueue(resolve, reject) {
    this.failedQueue.push({ resolve, reject });
  }

  // Refresh token with queue management
  async refreshAccessToken(axiosInstance) {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      this.clearAuthData();
      window.location.href = '/login';
      throw new Error('No refresh token available');
    }

    // If already refreshing, return the existing promise
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.addToQueue(resolve, reject);
      });
    }

    this.isRefreshing = true;

    // Create a new refresh promise
    this.refreshPromise = axiosInstance.post('/auth/refresh', {
      refreshToken
    }, {
      _skipAuthInterceptor: true // Custom flag to skip auth interceptor
    })
    .then(response => {
      const { token, refreshToken: newRefreshToken, user } = response.data.data;
      
      // Store new tokens
      this.storeAuthData({
        token,
        refreshToken: newRefreshToken || refreshToken,
        user
      });
      
      // Process queued requests
      this.processQueue(null, token);
      
      return token;
    })
    .catch(error => {
      // Refresh failed, clear auth and redirect to login
      this.processQueue(error, null);
      this.clearAuthData();
      window.location.href = '/login';
      throw error;
    })
    .finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  // Map backend error codes to UI behaviors
  mapErrorToAction(error) {
    if (!error.response) {
      return {
        action: 'NETWORK_ERROR',
        message: 'Erro de conexão. Verifique sua internet.',
        severity: 'error'
      };
    }

    const { status, data } = error.response;
    const errorCode = data?.code || data?.error;

    // Map specific error codes
    switch (errorCode) {
      case 'TENANT_INACTIVE':
        return {
          action: 'TENANT_INACTIVE',
          message: 'Sua empresa está inativa. Entre em contato com o suporte.',
          severity: 'error',
          showModal: true,
          logout: true
        };

      case 'SUBSCRIPTION_SUSPENDED':
        return {
          action: 'SUBSCRIPTION_SUSPENDED',
          message: 'Sua assinatura está suspensa. Atualize seu pagamento.',
          severity: 'warning',
          showUpgrade: true,
          ctaLink: '/pricing'
        };

      case 'PLAN_LIMIT_REACHED':
        return {
          action: 'PLAN_LIMIT_REACHED',
          message: data?.message || 'Limite do plano atingido. Faça upgrade para continuar.',
          severity: 'warning',
          showToast: true,
          blockAction: true,
          showUpgrade: true
        };

      case 'MODULE_DISABLED':
        return {
          action: 'MODULE_DISABLED',
          message: 'Este módulo não está disponível no seu plano.',
          severity: 'info',
          showToast: true,
          blockAction: true
        };

      case 'PERMISSION_DENIED':
        return {
          action: 'PERMISSION_DENIED',
          message: 'Você não tem permissão para realizar esta ação.',
          severity: 'warning',
          showToast: true
        };

      case 'TOKEN_EXPIRED':
      case 'INVALID_TOKEN':
        return {
          action: 'AUTH_ERROR',
          message: 'Sessão expirada. Fazendo login novamente...',
          severity: 'info',
          refreshToken: true
        };

      case 'RATE_LIMIT_EXCEEDED':
        return {
          action: 'RATE_LIMIT',
          message: 'Muitas tentativas. Aguarde alguns minutos.',
          severity: 'warning',
          showToast: true,
          retryAfter: data?.retryAfter || 60
        };

      default:
        // Generic error handling based on status code
        if (status === 401) {
          return {
            action: 'UNAUTHORIZED',
            message: 'Não autorizado. Faça login novamente.',
            severity: 'error',
            logout: true
          };
        }
        
        if (status === 403) {
          return {
            action: 'FORBIDDEN',
            message: 'Acesso negado.',
            severity: 'error',
            showToast: true
          };
        }
        
        if (status === 404) {
          return {
            action: 'NOT_FOUND',
            message: 'Recurso não encontrado.',
            severity: 'warning'
          };
        }
        
        if (status >= 500) {
          return {
            action: 'SERVER_ERROR',
            message: 'Erro no servidor. Tente novamente mais tarde.',
            severity: 'error',
            showToast: true
          };
        }

        return {
          action: 'UNKNOWN_ERROR',
          message: data?.message || 'Ocorreu um erro. Tente novamente.',
          severity: 'error'
        };
    }
  }

  // Decode JWT token to get payload
  decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(token) {
    if (!token) return true;
    
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    // Check if token expires in the next 30 seconds
    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;
    
    return timeUntilExpiry < 30000; // Less than 30 seconds
  }

  // Get time until token expiry in milliseconds
  getTimeUntilExpiry(token) {
    if (!token) return 0;
    
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return 0;
    
    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;
    
    return Math.max(0, timeUntilExpiry);
  }

  // Setup auto-refresh timer
  setupAutoRefresh(axiosInstance) {
    const token = this.getAccessToken();
    if (!token) return;
    
    const timeUntilExpiry = this.getTimeUntilExpiry(token);
    
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    // Set timer to refresh 1 minute before expiry
    const refreshTime = Math.max(0, timeUntilExpiry - 60000);
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshAccessToken(axiosInstance).catch(console.error);
      }, refreshTime);
    }
  }

  // Clear auto-refresh timer
  clearAutoRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;
