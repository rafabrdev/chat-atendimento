import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  MessageSquare, 
  History, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  X,
  Home,
  UserCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  const menuItems = [
    {
      title: 'Dashboard',
      icon: Home,
      path: '/dashboard',
      roles: ['client', 'agent', 'admin']
    },
    {
      title: 'Conversas',
      icon: MessageSquare,
      path: '/conversations',
      roles: ['client', 'agent', 'admin']
    },
    {
      title: 'Histórico',
      icon: History,
      path: '/history',
      roles: ['client', 'agent', 'admin']
    },
    {
      title: 'Usuários',
      icon: Users,
      path: '/users',
      roles: ['admin']
    },
    {
      title: 'Configurações',
      icon: Settings,
      path: '/settings',
      roles: ['agent', 'admin']
    },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  const handleLogout = () => {
    logout();
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleMobile}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md"
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-gray-200 z-50 transition-all duration-300
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {!isCollapsed && (
                <h1 className="text-xl font-bold text-gray-800">
                  Chat Sistema
                </h1>
              )}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:block p-2 rounded-md hover:bg-gray-100"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <UserCircle size={24} className="text-white" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.role}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Icon size={20} />
                  {!isCollapsed && <span>{item.title}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            >
              <LogOut size={20} />
              {!isCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
