/**
 * Error Service
 * 
 * Centralized error handling and mapping service
 * Maps backend error codes to UI actions
 */

import toast from 'react-hot-toast';

class ErrorService {
  constructor() {
    this.errorHandlers = new Map();
    this.globalErrorListeners = new Set();
    this.setupDefaultHandlers();
  }

  /**
   * Setup default error handlers for common error codes
   */
  setupDefaultHandlers() {
    // Tenant-related errors
    this.registerHandler('TENANT_INACTIVE', {
      action: 'MODAL_AND_LOGOUT',
      severity: 'critical',
      handler: (error) => {
        this.showErrorModal({
          title: 'Conta Inativa',
          message: 'Sua conta está inativa. Entre em contato com o administrador.',
          icon: '🔒',
          actions: [
            {
              label: 'Fazer Logout',
              action: () => {
                window.location.href = '/login';
              }
            }
          ]
        });
        
        // Clear auth data
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    });

    this.registerHandler('SUBSCRIPTION_SUSPENDED', {
      action: 'UPGRADE_CTA',
      severity: 'warning',
      handler: (error) => {
        const message = error.message || 'Sua assinatura está suspensa. Atualize seu plano para continuar.';
        
        // Show warning toast
        toast.error(message, {
          duration: 10000,
          icon: '⚠️'
        });
        
        // Show upgrade modal after a delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('show-upgrade-modal', {
            detail: { reason: 'subscription_suspended' }
          }));
        }, 2000);
      }
    });

    this.registerHandler('PLAN_LIMIT_REACHED', {
      action: 'TOAST_AND_BLOCK',
      severity: 'warning',
      handler: (error) => {
        const limitType = error.data?.limitType || 'recurso';
        const currentUsage = error.data?.currentUsage;
        const limit = error.data?.limit;
        
        let message = `Limite do plano atingido para ${limitType}.`;
        if (currentUsage && limit) {
          message += ` (${currentUsage}/${limit})`;
        }
        
        toast.error(message, {
          duration: 6000,
          icon: '🚫'
        });
        
        // Trigger upgrade modal after a short delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('show-upgrade-modal', {
            detail: { reason: 'limit_reached', limitType }
          }));
        }, 1000);
      }
    });

    this.registerHandler('MODULE_DISABLED', {
      action: 'INFO_TOAST',
      severity: 'info',
      handler: (error) => {
        const moduleName = error.data?.module || 'Este módulo';
        toast.info(`${moduleName} não está disponível no seu plano atual.`, {
          duration: 5000,
          icon: 'ℹ️'
        });
      }
    });

    // Auth errors
    this.registerHandler('TOKEN_EXPIRED', {
      action: 'AUTO_REFRESH',
      severity: 'info',
      handler: (error) => {
        console.log('[ErrorService] Token expired, triggering refresh...');
        // Auth service should handle this automatically
      }
    });

    this.registerHandler('INVALID_TOKEN', {
      action: 'REDIRECT_LOGIN',
      severity: 'error',
      handler: (error) => {
        toast.error('Sessão inválida. Por favor, faça login novamente.', {
          duration: 3000
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      }
    });

    this.registerHandler('UNAUTHORIZED', {
      action: 'TOAST',
      severity: 'error',
      handler: (error) => {
        toast.error(error.message || 'Não autorizado', {
          duration: 4000
        });
      }
    });

    this.registerHandler('FORBIDDEN', {
      action: 'TOAST',
      severity: 'error',
      handler: (error) => {
        toast.error('Você não tem permissão para realizar esta ação.', {
          duration: 4000,
          icon: '🚫'
        });
      }
    });

    // Rate limiting
    this.registerHandler('RATE_LIMIT_EXCEEDED', {
      action: 'TOAST_WITH_RETRY',
      severity: 'warning',
      handler: (error) => {
        const retryAfter = error.data?.retryAfter || 60;
        toast.error(`Muitas tentativas. Tente novamente em ${retryAfter} segundos.`, {
          duration: retryAfter * 1000,
          icon: '⏱️'
        });
      }
    });

    // Network errors
    this.registerHandler('NETWORK_ERROR', {
      action: 'TOAST',
      severity: 'error',
      handler: (error) => {
        toast.error('Erro de conexão. Verifique sua internet.', {
          duration: 5000,
          icon: '🌐'
        });
      }
    });

    // Server errors
    this.registerHandler('SERVER_ERROR', {
      action: 'TOAST',
      severity: 'error',
      handler: (error) => {
        toast.error('Erro no servidor. Por favor, tente novamente.', {
          duration: 4000,
          icon: '⚠️'
        });
      }
    });

    // Validation errors
    this.registerHandler('VALIDATION_ERROR', {
      action: 'TOAST',
      severity: 'warning',
      handler: (error) => {
        const fields = error.data?.fields;
        if (fields && Array.isArray(fields)) {
          fields.forEach(field => {
            toast.error(`${field.field}: ${field.message}`, {
              duration: 5000
            });
          });
        } else {
          toast.error(error.message || 'Dados inválidos', {
            duration: 4000
          });
        }
      }
    });

    // File upload errors
    this.registerHandler('FILE_TOO_LARGE', {
      action: 'TOAST',
      severity: 'warning',
      handler: (error) => {
        const maxSize = error.data?.maxSize || '50MB';
        toast.error(`Arquivo muito grande. Tamanho máximo: ${maxSize}`, {
          duration: 5000,
          icon: '📁'
        });
      }
    });

    this.registerHandler('INVALID_FILE_TYPE', {
      action: 'TOAST',
      severity: 'warning',
      handler: (error) => {
        const allowedTypes = error.data?.allowedTypes?.join(', ') || 'tipos permitidos';
        toast.error(`Tipo de arquivo inválido. Use: ${allowedTypes}`, {
          duration: 5000,
          icon: '📁'
        });
      }
    });

    // Storage quota errors
    this.registerHandler('STORAGE_QUOTA_EXCEEDED', {
      action: 'MODAL_AND_UPGRADE',
      severity: 'warning',
      handler: (error) => {
        const usage = error.data?.currentUsage;
        const limit = error.data?.limit;
        
        this.showErrorModal({
          title: 'Limite de Armazenamento Excedido',
          message: `Você atingiu o limite de armazenamento do seu plano${usage && limit ? ` (${usage}/${limit})` : ''}. Faça upgrade para continuar.`,
          icon: '💾',
          actions: [
            {
              label: 'Ver Planos',
              action: () => window.location.href = '/pricing',
              primary: true
            },
            {
              label: 'Fechar',
              action: () => {}
            }
          ]
        });
      }
    });
  }

  /**
   * Register a custom error handler
   */
  registerHandler(code, config) {
    this.errorHandlers.set(code, config);
  }

  /**
   * Handle an error based on its code
   */
  handleError(error) {
    console.log('[ErrorService] Handling error:', error);
    
    // Extract error code
    const code = error.code || error.response?.data?.code || this.inferErrorCode(error);
    
    // Get handler for this error code
    const handler = this.errorHandlers.get(code);
    
    if (handler) {
      console.log(`[ErrorService] Using handler for code: ${code}`);
      handler.handler(error);
    } else {
      // Default handler for unknown errors
      console.warn(`[ErrorService] No handler for code: ${code}`);
      this.handleUnknownError(error);
    }

    // Notify global listeners
    this.notifyListeners(error, code);
  }

  /**
   * Infer error code from error object
   */
  inferErrorCode(error) {
    if (!error.response) return 'NETWORK_ERROR';
    
    const status = error.response.status;
    const message = error.response.data?.message?.toLowerCase() || '';
    
    // Try to infer from status code
    if (status === 401) {
      if (message.includes('token')) return 'INVALID_TOKEN';
      return 'UNAUTHORIZED';
    }
    if (status === 403) {
      if (message.includes('tenant')) return 'TENANT_INACTIVE';
      if (message.includes('subscription')) return 'SUBSCRIPTION_SUSPENDED';
      if (message.includes('limit')) return 'PLAN_LIMIT_REACHED';
      return 'FORBIDDEN';
    }
    if (status === 422) return 'VALIDATION_ERROR';
    if (status === 429) return 'RATE_LIMIT_EXCEEDED';
    if (status >= 500) return 'SERVER_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Handle unknown errors
   */
  handleUnknownError(error) {
    const message = error.response?.data?.message || error.message || 'Ocorreu um erro inesperado';
    
    toast.error(message, {
      duration: 4000,
      icon: '❌'
    });
  }

  /**
   * Show error modal
   */
  showErrorModal(config) {
    // Dispatch event for modal component to handle
    window.dispatchEvent(new CustomEvent('show-error-modal', {
      detail: config
    }));
  }

  /**
   * Add global error listener
   */
  addListener(callback) {
    this.globalErrorListeners.add(callback);
    return () => this.globalErrorListeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(error, code) {
    this.globalErrorListeners.forEach(listener => {
      try {
        listener(error, code);
      } catch (err) {
        console.error('[ErrorService] Error in listener:', err);
      }
    });
  }

  /**
   * Clear all error states
   */
  clearErrors() {
    toast.dismiss();
    window.dispatchEvent(new CustomEvent('clear-error-modal'));
  }
}

// Export singleton instance
const errorService = new ErrorService();

export default errorService;

// Also export class for testing
export { ErrorService };
