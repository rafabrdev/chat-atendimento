import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const SimpleDashboard = () => {
  const { user } = useAuth();
  
  return (
    <div style={{ padding: '20px', backgroundColor: 'white' }}>
      <h1 style={{ color: 'black', fontSize: '24px' }}>Dashboard de Teste</h1>
      <p style={{ color: 'gray' }}>Usuário: {user?.name || 'Não identificado'}</p>
      <p style={{ color: 'gray' }}>Role: {user?.role || 'Não identificado'}</p>
      
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <h2 style={{ color: 'black' }}>Teste de Renderização</h2>
        <p style={{ color: 'gray' }}>Se você está vendo este texto, o dashboard está funcionando!</p>
      </div>
    </div>
  );
};

export default SimpleDashboard;
