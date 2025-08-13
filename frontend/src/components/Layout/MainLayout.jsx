import React from 'react';
import Sidebar from './Sidebar.jsx';

const MainLayout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <div className="h-full p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
