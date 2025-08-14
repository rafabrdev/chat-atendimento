import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

const MainLayout = ({ children }) => {
  const location = useLocation();
  // Verificar se é a página de conversas para não adicionar padding
  const isConversationsPage = location.pathname === '/conversations';
  
  return (
    <div className={`flex h-screen ${isConversationsPage ? '' : 'bg-gray-50'}`}>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className={`flex-1 overflow-auto ${isConversationsPage ? '' : 'p-6'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
