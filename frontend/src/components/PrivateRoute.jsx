import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const PrivateRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Se não está autenticado, redirecionar para login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se roles foram especificadas, verificar se usuário tem permissão
  if (roles.length > 0 && !roles.includes(user?.role)) {
    // Se é master tentando acessar outras rotas, redirecionar para /master
    if (user?.role === 'master') {
      return <Navigate to="/master" replace />;
    }
    // Para outros casos, redirecionar para unauthorized
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default PrivateRoute;
