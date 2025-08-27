/**
 * ErrorBoundary Component
 * 
 * Catches React runtime errors and provides fallback UI
 * Integrates with error reporting and logging services
 */

import React, { Component } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Report to error tracking service (e.g., Sentry, LogRocket)
    this.reportError(error, errorInfo);
  }

  reportError(error, errorInfo) {
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      
      // For now, just log to console
      console.error('[ErrorBoundary] Would report to error service:', {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }

    // Also send to backend for logging
    try {
      fetch('/api/errors/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          message: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      }).catch(err => {
        console.error('[ErrorBoundary] Failed to report error to backend:', err);
      });
    } catch (err) {
      console.error('[ErrorBoundary] Failed to report error:', err);
    }
  }

  handleReset = () => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Optionally reload the page if errors persist
    if (this.state.errorCount > 2) {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    // Navigate to home page
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                <FiAlertTriangle className="h-10 w-10 text-red-600" />
              </div>
              
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Ops! Algo deu errado
              </h2>
              
              <p className="mt-2 text-sm text-gray-600">
                Encontramos um erro inesperado. Nossa equipe foi notificada e está trabalhando para resolver.
              </p>

              {/* Show error details in development */}
              {isDevelopment && this.state.error && (
                <div className="mt-4 text-left bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-800 mb-2">
                    Detalhes do erro (desenvolvimento):
                  </h3>
                  <pre className="text-xs text-red-600 whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.error.stack && (
                    <>
                      <h4 className="text-xs font-medium text-red-800 mt-2 mb-1">Stack trace:</h4>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    </>
                  )}
                  {this.state.errorInfo && this.state.errorInfo.componentStack && (
                    <>
                      <h4 className="text-xs font-medium text-red-800 mt-2 mb-1">Component stack:</h4>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-center space-x-4">
                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiRefreshCw className="mr-2 h-4 w-4" />
                  Tentar novamente
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiHome className="mr-2 h-4 w-4" />
                  Ir para início
                </button>
              </div>

              {this.state.errorCount > 1 && (
                <p className="mt-4 text-xs text-gray-500">
                  Este erro ocorreu {this.state.errorCount} vezes. Se persistir, tente recarregar a página.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
