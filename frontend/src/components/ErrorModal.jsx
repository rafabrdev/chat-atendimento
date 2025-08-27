/**
 * ErrorModal Component
 * 
 * Global error modal for displaying critical errors
 * Listens to error events and displays appropriate UI
 */

import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiX, FiLogOut, FiRefreshCw } from 'react-icons/fi';

const ErrorModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [errorConfig, setErrorConfig] = useState(null);

  useEffect(() => {
    // Listen for show-error-modal events
    const handleShowModal = (event) => {
      setErrorConfig(event.detail);
      setIsOpen(true);
    };

    // Listen for clear-error-modal events
    const handleClearModal = () => {
      setIsOpen(false);
      setErrorConfig(null);
    };

    window.addEventListener('show-error-modal', handleShowModal);
    window.addEventListener('clear-error-modal', handleClearModal);

    return () => {
      window.removeEventListener('show-error-modal', handleShowModal);
      window.removeEventListener('clear-error-modal', handleClearModal);
    };
  }, []);

  if (!isOpen || !errorConfig) {
    return null;
  }

  const handleClose = () => {
    setIsOpen(false);
    setErrorConfig(null);
  };

  const handleAction = (action) => {
    if (action.action && typeof action.action === 'function') {
      action.action();
    }
    if (!action.keepOpen) {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* This element is to trick the browser into centering the modal contents. */}
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              {/* Icon */}
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                {errorConfig.icon ? (
                  <span className="text-2xl">{errorConfig.icon}</span>
                ) : (
                  <FiAlertTriangle className="h-6 w-6 text-red-600" />
                )}
              </div>

              {/* Content */}
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {errorConfig.title || 'Erro'}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {errorConfig.message || 'Ocorreu um erro inesperado.'}
                  </p>
                  
                  {/* Additional details if provided */}
                  {errorConfig.details && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {errorConfig.details}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            {errorConfig.actions?.map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleAction(action)}
                className={`
                  inline-flex w-full justify-center rounded-md border px-4 py-2 text-base font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm
                  ${action.primary
                    ? 'border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-indigo-500'
                  }
                `}
              >
                {action.icon === 'logout' && <FiLogOut className="mr-2 h-4 w-4" />}
                {action.icon === 'refresh' && <FiRefreshCw className="mr-2 h-4 w-4" />}
                {action.label}
              </button>
            ))}
            
            {/* Default close button if no actions provided */}
            {(!errorConfig.actions || errorConfig.actions.length === 0) && (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
