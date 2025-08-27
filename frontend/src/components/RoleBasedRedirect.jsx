import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleBasedRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirecionar baseado no role
  switch (user.role) {
    case 'master':
      return <Navigate to="/master" replace />;
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'agent':
      return <Navigate to="/dashboard" replace />;
    case 'client':
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

export default RoleBasedRedirect;
