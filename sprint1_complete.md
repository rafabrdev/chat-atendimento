```

---

## 🔐 Passo 11: Componentes de Autenticação

### 11.1 Arquivo: `frontend/src/components/PrivateRoute.js`
```javascript
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default PrivateRoute;
```

### 11.2 Arquivo: `frontend/src/components/PublicRoute.js`
```javascript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Se já está autenticado, redirecionar para dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PublicRoute;
```

---

## 🎨 Passo 12: Layout e Componentes Principais

### 12.1 Arquivo: `frontend/src/components/Layout/Sidebar.js`
```javascript
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
import { useAuth } from '../../context/AuthContext';

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
```

### 12.2 Arquivo: `frontend/src/components/Layout/MainLayout.js`
```javascript
import React from 'react';
import Sidebar from './Sidebar';

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
```

---

## 📱 Passo 13: Páginas de Autenticação

### 13.1 Arquivo: `frontend/src/pages/Login.js`
```javascript
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpar erro do campo quando usuário digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bem-vindo de volta
            </h1>
            <p className="text-gray-600 mt-2">
              Entre com sua conta para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.email 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="seu@email.com"
                />
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.password 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-500 text-white py-3 px-4 rounded-lg hover:bg-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Criando conta...
                </div>
              ) : (
                'Criar conta'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Já tem uma conta?{' '}
              <Link 
                to="/login" 
                className="text-primary-500 hover:text-primary-600 font-medium"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
```

---

## 🏠 Passo 14: Páginas Principais

### 14.1 Arquivo: `frontend/src/pages/Dashboard.js`
```javascript
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Users, Clock, BarChart3 } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();

  const stats = [
    {
      title: 'Conversas Ativas',
      value: '12',
      icon: MessageSquare,
      color: 'bg-blue-500',
      change: '+5%',
      changeType: 'positive'
    },
    {
      title: 'Tempo Médio',
      value: '8m 32s',
      icon: Clock,
      color: 'bg-green-500',
      change: '-2m',
      changeType: 'positive'
    },
    {
      title: 'Atendimentos Hoje',
      value: '47',
      icon: BarChart3,
      color: 'bg-purple-500',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'Usuários Online',
      value: '23',
      icon: Users,
      color: 'bg-orange-500',
      change: '+3',
      changeType: 'positive'
    }
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'conversation',
      message: 'Nova conversa iniciada com João Silva',
      time: '2 minutos atrás',
      status: 'active'
    },
    {
      id: 2,
      type: 'conversation',
      message: 'Conversa com Maria Santos finalizada',
      time: '15 minutos atrás',
      status: 'completed'
    },
    {
      id: 3,
      type: 'user',
      message: 'Novo usuário cadastrado: Pedro Costa',
      time: '1 hora atrás',
      status: 'info'
    },
    {
      id: 4,
      type: 'conversation',
      message: 'Conversa transferida para Agente Ana',
      time: '2 horas atrás',
      status: 'transferred'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Olá, {user?.name}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              Bem-vindo ao seu painel de {user?.role === 'client' ? 'atendimento' : 'controle'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Hoje</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date().toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {(user?.role === 'agent' || user?.role === 'admin') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-600 ml-1">vs ontem</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions for Clients */}
      {user?.role === 'client' && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
              <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">Iniciar Nova Conversa</p>
            </button>
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">Ver Histórico</p>
            </button>
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
              <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">Perfil</p>
            </button>
          </div>
        </div>
      )}

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Atividades Recentes
          </h2>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.status === 'active' ? 'bg-green-400' :
                  activity.status === 'completed' ? 'bg-blue-400' :
                  activity.status === 'transferred' ? 'bg-yellow-400' :
                  'bg-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Status do Sistema
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Servidor Online</span>
              </div>
              <span className="text-xs text-gray-500">99.9% uptime</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Chat Funcionando</span>
              </div>
              <span className="text-xs text-gray-500">Todos os recursos</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Base de Dados</span>
              </div>
              <span className="text-xs text-gray-500">Conectado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
```

### 14.2 Arquivo: `frontend/src/pages/Conversations.js`
```javascript
import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';

const Conversations = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Conversas</h1>
        <button className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2">
          <Plus size={20} />
          <span>Nova Conversa</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Sistema de Chat em Desenvolvimento
          </h2>
          <p className="text-gray-600 mb-6">
            O sistema de conversas será implementado na próxima sprint.
            Por enquanto, você pode navegar pelas outras funcionalidades do sistema.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Próximas funcionalidades:</strong> Chat em tempo real, upload de arquivos, 
              histórico de conversas e muito mais!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversations;
```

### 14.3 Arquivo: `frontend/src/pages/History.js`
```javascript
import React from 'react';
import { History as HistoryIcon, Search } from 'lucide-react';

const History = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Histórico</h1>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <HistoryIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Histórico de Conversas
          </h2>
          <p className="text-gray-600 mb-6">
            O histórico completo de todas as suas conversas será exibido aqui.
            Esta funcionalidade será implementada nas próximas sprints.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">
              <strong>Em desenvolvimento:</strong> Histórico detalhado, filtros avançados, 
              exportação de dados e busca por conteúdo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
```

### 14.4 Arquivo: `frontend/src/pages/NotFound.js`
```javascript
import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary-500">404</h1>
          <h2 className="text-3xl font-bold text-gray-900 mt-4">
            Página não encontrada
          </h2>
          <p className="text-gray-600 mt-4 max-w-md mx-auto">
            A página que você está procurando não existe ou foi movida para outro local.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dashboard"
            className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center space-x-2"
          >
            <Home size={20} />
            <span>Ir para Dashboard</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="bg-white text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-300 flex items-center justify-center space-x-2"
          >
            <ArrowLeft size={20} />
            <span>Voltar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
```

### 14.5 Arquivo: `frontend/src/pages/Unauthorized.js`
```javascript
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, Home } from 'lucide-react';

const Unauthorized = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <ShieldX className="w-24 h-24 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">
            Acesso Negado
          </h1>
          <p className="text-gray-600 mt-4 max-w-md mx-auto">
            Você não tem permissão para acessar esta página. 
            Verifique suas credenciais ou entre em contato com o administrador.
          </p>
        </div>
        
        <Link
          to="/dashboard"
          className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors inline-flex items-center space-x-2"
        >
          <Home size={20} />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;
```

---

## 🔗 Passo 15: Configuração de Rotas

### 15.1 Arquivo: `frontend/src/App.js`
```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context
import { AuthProvider } from './context/AuthContext';

// Components
import PrivateRoute from './components/PrivateRoute';
import PublicRoute from './components/PublicRoute';
import MainLayout from './components/Layout/MainLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import History from './pages/History';
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Rotas públicas */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />

            {/* Rotas privadas */}
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/conversations" 
              element={
                <PrivateRoute>
                  <MainLayout>
                    <Conversations />
                  </MainLayout>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/history" 
              element={
                <PrivateRoute>
                  <MainLayout>
                    <History />
                  </MainLayout>
                </PrivateRoute>
              } 
            />

            {/* Rotas de erro */}
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Redirecionamentos */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### 15.2 Arquivo: `frontend/src/index.js`
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 🔧 Passo 16: Variáveis de Ambiente e Configurações Finais

### 16.1 Arquivo: `frontend/.env`
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### 16.2 Atualizar `frontend/package.json` (scripts)
```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "axios": "^1.6.2",
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    "lucide-react": "^0.294.0",
    "react-hot-toast": "^2.4.1",
    "socket.io-client": "^4.7.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "dev": "react-scripts start"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "react-scripts": "5.0.1"
  }
}
```

---

## 🚀 Passo 17: Scripts de Inicialização

### 17.1 Criar arquivo: `scripts/setup.sh`
```bash
#!/bin/bash

echo "🚀 Configurando ambiente de desenvolvimento..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js primeiro."
    exit 1
fi

# Verificar se MongoDB está rodando
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB não encontrado. Certifique-se de que está instalado e rodando."
fi

echo "📦 Instalando dependências do projeto raiz..."
npm install

echo "📦 Instalando dependências do backend..."
cd backend && npm install && cd ..

echo "📦 Instalando dependências do frontend..."
cd frontend && npm install && cd ..

echo "🔧 Criando arquivos de ambiente..."

# Backend .env
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env 2>/dev/null || cat > backend/.env << EOF
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/chat-atendimento
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    echo "✅ Arquivo backend/.env criado"
fi

# Frontend .env
if [ ! -f frontend/.env ]; then
    cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
EOF
    echo "✅ Arquivo frontend/.env criado"
fi

echo "✨ Setup completo! Execute 'npm run dev' para iniciar o desenvolvimento."
```

### 17.2 Criar arquivo: `README.md`
```markdown
# Sistema de Atendimento via Live Chat

Sistema completo de atendimento ao cliente via chat em tempo real, desenvolvido em React.js e Node.js.

## 🚀 Tecnologias

- **Frontend**: React.js, Tailwind CSS, Socket.io-client
- **Backend**: Node.js, Express, MongoDB, Socket.io
- **Autenticação**: JWT
- **Real-time**: WebSockets

## 📋 Pré-requisitos

- Node.js (v16 ou superior)
- MongoDB (local ou cloud)
- NPM ou Yarn

## ⚡ Instalação Rápida

1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd chat-atendimento
```

2. Execute o script de setup (Linux/Mac)
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

3. Ou instale manualmente:
```bash
npm install
npm run install:all
```

4. Configure as variáveis de ambiente:
   - Copie `backend/.env.example` para `backend/.env`
   - Copie `frontend/.env.example` para `frontend/.env`
   - Ajuste as configurações conforme necessário

## 🏃 Executando o Projeto

### Desenvolvimento (Backend + Frontend)
```bash
npm run dev
```

### Executar separadamente
```bash
# Backend
npm run dev:backend

# Frontend
npm run dev:frontend
```

## 📁 Estrutura do Projeto

```
chat-atendimento/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── config/
│   │   └── App.js
│   └── package.json
└── package.json
```

## 🔐 Usuários de Teste

Após executar o projeto, você pode criar usuários com diferentes roles:
- **Cliente**: Para fazer atendimentos
- **Agente**: Para atender clientes  
- **Admin**: Para gerenciar o sistema

## 🌐 URLs de Acesso

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## 📊 Sprint 1 - Entregáveis

- ✅ Autenticação completa (login/registro)
- ✅ Layout responsivo com sidebar
- ✅ Dashboard básico
- ✅ Sistema de rotas protegidas
- ✅ Context API para gerenciamento de estado
- ✅ Configuração completa do ambiente

## 🔄 Próximas Sprints

- Sprint 2: Sistema de chat em tempo real
- Sprint 3: Upload de arquivos e mídia
- Sprint 4: Gestão de agentes
- Sprint 5: Histórico e relatórios
- Sprint 6: Deploy e otimizações

## 🐛 Problemas Comuns

### MongoDB não conecta
```bash
# Inicie o MongoDB
sudo systemctl start mongod
# ou
brew services start mongodb-community
```

### Erro de CORS
Verifique se a URL do frontend está correta no arquivo `.env` do backend.

### Porta já em uso
```bash
# Matar processo na porta 5000
npx kill-port 5000

# Matar processo na porta 3000  
npx kill-port 3000
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 License

Este projeto está sob a licença MIT.
```

---

## ✅ Passo 18: Checklist de Verificação

### Estrutura de Arquivos Final:
```
chat-atendimento/
├── package.json (workspace config)
├── README.md
├── scripts/
│   └── setup.sh
├── backend/
│   ├── package.json
│   ├── .env
│   ├── .eslintrc.js
│   ├── .prettierrc
│   ├── server.js
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   └── authController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── models/
│   │   ├── User.js
│   │   └── Conversation.js
│   └── routes/
│       └── auth.js
└── frontend/
    ├── package.json
    ├── .env
    ├── tailwind.config.js
    │   ├── App.js
    │   ├── config/
    │   │   └── api.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── components/
    │   │   ├── PrivateRoute.js
    │   │   ├── PublicRoute.js
    │   │   └── Layout/
    │   │       ├── MainLayout.js
    │   │       └── Sidebar.js
    │   └── pages/
    │       ├── Login.js
    │       ├── Register.js
    │       ├── Dashboard.js
    │       ├── Conversations.js
    │       ├── History.js
    │       ├── NotFound.js
    │       └── Unauthorized.js
    ├── public/
    └── build/ (após npm run build)
```

---

## 🚀 Passo 19: Comandos para Executar

### 19.1 Instalação do Projeto (Execute na ordem):

```bash
# 1. Criar diretório e navegar
mkdir chat-atendimento
cd chat-atendimento

# 2. Criar package.json principal
npm init -y

# 3. Instalar dependência para rodar tudo junto
npm install concurrently --save-dev

# 4. Criar estrutura do backend
mkdir backend
cd backend
npm init -y
npm install express mongoose bcryptjs jsonwebtoken cors dotenv helmet morgan express-rate-limit socket.io
npm install --save-dev nodemon eslint prettier eslint-config-prettier eslint-plugin-prettier

# 5. Voltar e criar frontend
cd ..
npx create-react-app frontend
cd frontend

# 6. Remover dependências desnecessárias do CRA
npm uninstall @testing-library/jest-dom @testing-library/react @testing-library/user-event web-vitals

# 7. Instalar dependências do frontend
npm install react-router-dom axios tailwindcss postcss autoprefixer lucide-react react-hot-toast socket.io-client

# 8. Configurar Tailwind
npx tailwindcss init -p

# 9. Voltar para raiz
cd ..
```

### 19.2 Inicializar MongoDB:

```bash
# Ubuntu/Debian
sudo systemctl start mongod

# macOS com Homebrew
brew services start mongodb-community

# Windows
net start MongoDB

# Ou usar Docker
docker run --name mongodb -p 27017:27017 -d mongo:latest
```

### 19.3 Executar o Projeto:

```bash
# Na raiz do projeto
npm run dev

# Ou executar separadamente:
# Terminal 1 (backend)
cd backend && npm run dev

# Terminal 2 (frontend)
cd frontend && npm start
```

---

## 🔧 Passo 20: Testes e Validação

### 20.1 Testar Backend:

```bash
# Health check
curl http://localhost:5000/health

# Registrar usuário
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Usuário Teste",
    "email": "teste@email.com",
    "password": "123456",
    "role": "client"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "password": "123456"
  }'
```

### 20.2 Testar Frontend:

1. **Acesse:** http://localhost:3000
2. **Teste o fluxo:**
   - Página de login deve carregar
   - Link para registro funcionando
   - Registro de novo usuário
   - Login com usuário criado
   - Redirecionamento para dashboard
   - Menu lateral funcionando
   - Logout funcionando

### 20.3 Funcionalidades da Sprint 1:

#### ✅ Backend:
- [x] Servidor Express configurado
- [x] MongoDB conectado
- [x] Modelos User e Conversation
- [x] Autenticação JWT completa
- [x] Middleware de segurança
- [x] Rate limiting
- [x] Error handling
- [x] Socket.io configurado (básico)
- [x] APIs de auth funcionando

#### ✅ Frontend:
- [x] React + Tailwind configurado
- [x] Sistema de rotas
- [x] Context API para auth
- [x] Layout responsivo
- [x] Páginas de login/registro
- [x] Dashboard básico
- [x] Menu lateral
- [x] Proteção de rotas
- [x] Toast notifications
- [x] Design moderno

---

## 🎯 Passo 21: Próximos Passos (Sprint 2)

### Preparação para Sprint 2:
```javascript
// Já configurado no server.js - Socket.io básico
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});
```

### Database Seeds (Opcional para testes):
```javascript
// backend/seeds/users.js
const User = require('../models/User');

const seedUsers = async () => {
  try {
    // Criar admin se não existir
    const adminExists = await User.findOne({ email: 'admin@sistema.com' });
    if (!adminExists) {
      await User.create({
        name: 'Administrador',
        email: 'admin@sistema.com',
        password: '123456',
        role: 'admin'
      });
    }

    // Criar agente se não existir
    const agentExists = await User.findOne({ email: 'agente@sistema.com' });
    if (!agentExists) {
      await User.create({
        name: 'Agente Teste',
        email: 'agente@sistema.com',
        password: '123456',
        role: 'agent'
      });
    }

    console.log('Usuários de teste criados');
  } catch (error) {
    console.error('Erro ao criar usuários:', error);
  }
};

module.exports = seedUsers;
```

---

## 🐛 Possíveis Problemas e Soluções

### 1. Erro de CORS:
```javascript
// Já configurado no server.js, mas se persistir:
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}));
```

### 2. MongoDB não conecta:
```bash
# Verificar se está rodando
sudo systemctl status mongod

# Verificar logs
sudo journalctl -u mongod

# Iniciar se parado
sudo systemctl start mongod
```

### 3. Porta em uso:
```bash
# Encontrar processo usando porta 5000
lsof -i :5000

# Matar processo
kill -9 <PID>

# Ou usar npx
npx kill-port 5000
```

### 4. Problemas com Tailwind:
```bash
# Recriar config do Tailwind
cd frontend
rm tailwind.config.js
npx tailwindcss init -p
```

---

## 📈 Métricas de Sucesso da Sprint 1

### Critérios de Aceitação:
- ✅ **Autenticação**: Login e registro funcionais
- ✅ **UI/UX**: Interface moderna e responsiva
- ✅ **Segurança**: JWT, rate limiting, validações
- ✅ **Estrutura**: Código organizado e documentado
- ✅ **Performance**: Carregamento rápido das páginas
- ✅ **Responsividade**: Funciona em mobile/desktop

### Tempo Estimado vs Real:
- **Estimado**: 2 semanas
- **Arquivos criados**: 25+ arquivos
- **Linhas de código**: ~2500 linhas
- **Dependências**: 15+ packages

---

## 🎉 Conclusão da Sprint 1

**Parabéns! Você agora tem:**

1. **Monorepo funcional** com backend e frontend integrados
2. **Sistema de autenticação robusto** com JWT
3. **Interface moderna** inspirada no ChatGPT/Claude
4. **Base sólida** para as próximas sprints
5. **Arquitetura escalável** preparada para crescimento

### Comandos para testar tudo:
```bash
# 1. Instalar tudo
npm run install:all

# 2. Executar
npm run dev

# 3. Acessar
# Frontend: http://localhost:3000
# Backend: http://localhost:5000/health
```

**Próxima Sprint**: Sistema de chat em tempo real com WebSockets! 🚀d-lg hover:bg-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Não tem uma conta?{' '}
              <Link 
                to="/register" 
                className="text-primary-500 hover:text-primary-600 font-medium"
              >
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
```

### 13.2 Arquivo: `frontend/src/pages/Register.js`
```javascript
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Building } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'client',
    phone: '',
    company: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpar erro do campo quando usuário digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const userData = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      profile: {
        phone: formData.phone,
        company: formData.company
      }
    };

    const result = await register(userData);
    
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Criar conta
            </h1>
            <p className="text-gray-600 mt-2">
              Preencha os dados para começar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome completo
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.name 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="Seu nome completo"
                />
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              {errors.name && (
                <p className="text-red-600 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.email 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="seu@email.com"
                />
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de conta
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              >
                <option value="client">Cliente</option>
                <option value="agent">Agente</option>
              </select>
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone (opcional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* Company (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empresa (opcional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                  placeholder="Nome da empresa"
                />
                <Building className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.password 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.confirmPassword 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-500 text-white py-3 px-4 rounde# Sprint 1 - Setup Completo do Monorepo
## Passo a Passo do Zero ao Código Funcionando

---

## 🚀 Passo 1: Criando a Estrutura do Monorepo

### 1.1 Criando o diretório principal
```bash
mkdir chat-atendimento
cd chat-atendimento
```

### 1.2 Inicializando o projeto principal
```bash
npm init -y
```

### 1.3 Configurando Workspaces no package.json principal
```json
{
  "name": "chat-atendimento",
  "version": "1.0.0",
  "description": "Sistema de atendimento via live chat",
  "main": "index.js",
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "install:all": "npm install && npm install --workspace=backend && npm install --workspace=frontend"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  },
  "keywords": ["chat", "atendimento", "livechat"],
  "author": "Sua Empresa",
  "license": "ISC"
}
```

### 1.4 Instalando dependência para executar tudo junto
```bash
npm install concurrently --save-dev
```

---

## 🔧 Passo 2: Setup do Backend

### 2.1 Criando estrutura do backend
```bash
mkdir backend
cd backend
npm init -y
```

### 2.2 Instalando dependências do backend
```bash
# Dependências principais
npm install express mongoose bcryptjs jsonwebtoken cors dotenv helmet morgan express-rate-limit socket.io

# Dependências de desenvolvimento
npm install --save-dev nodemon eslint prettier eslint-config-prettier eslint-plugin-prettier
```

### 2.3 Configurando package.json do backend
```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "Backend do sistema de chat",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write ."
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "express-rate-limit": "^7.1.5",
    "socket.io": "^4.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.0"
  }
}
```

### 2.4 Criando estrutura de pastas do backend
```bash
mkdir config controllers middleware models routes utils
touch server.js
```

---

## 📁 Passo 3: Arquivos de Configuração do Backend

### 3.1 Arquivo: `backend/.env`
```env
# Configurações do Servidor
PORT=5000
NODE_ENV=development

# Configurações do Banco
MONGODB_URI=mongodb://localhost:27017/chat-atendimento
MONGODB_URI_TEST=mongodb://localhost:27017/chat-atendimento-test

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
JWT_EXPIRE=7d

# CORS
CLIENT_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3.2 Arquivo: `backend/.eslintrc.js`
```javascript
module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

### 3.3 Arquivo: `backend/.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 3.4 Arquivo: `backend/config/database.js`
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

## 🗄️ Passo 4: Modelos do Backend

### 4.1 Arquivo: `backend/models/User.js`
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Email inválido'
    ]
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    maxlength: [100, 'Nome muito longo']
  },
  role: {
    type: String,
    enum: ['client', 'agent', 'admin'],
    default: 'client'
  },
  profile: {
    phone: {
      type: String,
      default: ''
    },
    company: {
      type: String,
      default: ''
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para verificar senha
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para JSON (remover senha)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
```

### 4.2 Arquivo: `backend/models/Conversation.js`
```javascript
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'closed'],
    default: 'waiting'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  tags: [{
    type: String
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  feedback: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para performance
conversationSchema.index({ status: 1, createdAt: -1 });
conversationSchema.index({ assignedAgent: 1, status: 1 });
conversationSchema.index({ client: 1, createdAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
```

---

## 🛡️ Passo 5: Middleware do Backend

### 5.1 Arquivo: `backend/middleware/auth.js`
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// Middleware para verificar roles específicas
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado para este tipo de usuário'
      });
    }
    next();
  };
};

module.exports = { auth, authorize };
```

### 5.2 Arquivo: `backend/middleware/errorHandler.js`
```javascript
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error Stack:', err.stack);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Recurso não encontrado';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let message = 'Dados duplicados encontrados';
    
    if (err.keyPattern?.email) {
      message = 'Este email já está cadastrado';
    }
    
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = { message, statusCode: 401 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Erro interno do servidor'
  });
};

module.exports = errorHandler;
```

### 5.3 Arquivo: `backend/middleware/rateLimiter.js`
```javascript
const rateLimit = require('express-rate-limit');

// Rate limiter geral
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para autenticação (mais restritivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentativas por IP
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { generalLimiter, authLimiter };
```

---

## 🎮 Passo 6: Controllers do Backend

### 6.1 Arquivo: `backend/controllers/authController.js`
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Gerar JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Registrar usuário
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, profile } = req.body;

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }

    // Criar usuário
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'client',
      profile: profile || {}
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login usuário
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar campos obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }

    // Buscar usuário (incluindo senha para comparação)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar se conta está ativa
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }

    // Atualizar último login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: user.toJSON(), // Remove password
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter perfil do usuário logado
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Atualizar perfil do usuário
// @route   PATCH /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, profile } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name) updateData.name = name;
    if (profile) updateData.profile = { ...req.user.profile, ...profile };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Alterar senha
// @route   PATCH /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    
    // Verificar senha atual
    const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Atualizar senha
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};
```

---

## 🛤️ Passo 7: Rotas do Backend

### 7.1 Arquivo: `backend/routes/auth.js`
```javascript
const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');

const router = express.Router();

// Rotas públicas
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Rotas privadas (requerem autenticação)
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);
router.patch('/change-password', auth, changePassword);

module.exports = router;
```

---

## 🚀 Passo 8: Servidor Principal do Backend

### 8.1 Arquivo: `backend/server.js`
```javascript
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');

// Importar middleware e configurações
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Importar rotas
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Conectar ao banco de dados
connectDB();

// Middleware de segurança e logging
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
app.use(generalLimiter);

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Error handler middleware (deve ser o último)
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Exemplo de eventos básicos para próximas sprints
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
🚀 Servidor rodando em http://localhost:${PORT}
📊 Environment: ${process.env.NODE_ENV}
🔗 Health check: http://localhost:${PORT}/health
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});
```

---

## 🎨 Passo 9: Setup do Frontend

### 9.1 Voltar para o diretório raiz e criar o frontend
```bash
cd ..
npx create-react-app frontend
cd frontend
```

### 9.2 Instalando dependências do frontend
```bash
# Remover dependências que não vamos usar
npm uninstall @testing-library/jest-dom @testing-library/react @testing-library/user-event web-vitals

# Instalar dependências necessárias
npm install react-router-dom axios tailwindcss postcss autoprefixer lucide-react react-hot-toast socket.io-client

# Instalar Tailwind CSS
npx tailwindcss init -p
```

### 9.3 Configurar Tailwind - Arquivo: `frontend/tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
}
```

### 9.4 Arquivo: `frontend/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Animation classes */
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-in {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
```

---

## ⚙️ Passo 10: Configurações e Contextos do Frontend

### 10.1 Arquivo: `frontend/src/config/api.js`
```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Criar instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Se token expirou ou é inválido
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### 10.2 Arquivo: `frontend/src/context/AuthContext.js`
```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';

// Estado inicial
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

// Tipos de ações
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  LOAD_USER: 'LOAD_USER',
  UPDATE_USER: 'UPDATE_USER',
  SET_LOADING: 'SET_LOADING',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
      };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOAD_USER:
      return {
        ...state,
        user: action.payload,
        isLoading: false,
      };
    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

// Criar contexto
const AuthContext = createContext();

// Provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Carregar usuário do localStorage na inicialização
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token },
        });
        loadUser();
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    } else {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  // Carregar dados atualizados do usuário
  const loadUser = async () => {
    try {
      const response = await api.get('/auth/profile');
      dispatch({
        type: AUTH_ACTIONS.LOAD_USER,
        payload: response.data.data.user,
      });
    } catch (error) {
      console.error('Error loading user:', error);
      logout();
    }
  };

  // Login
  const login = async (email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await api.post('/auth/login', {
        email,
        password,
      });

      const { user, token } = response.data.data;

      // Salvar no localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });

      toast.success('Login realizado com sucesso!');
      return { success: true };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      
      const message = error.response?.data?.message || 'Erro no login';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Registro
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await api.post('/auth/register', userData);
      const { user, token } = response.data.data;

      // Salvar no localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });

      toast.success('Conta criada com sucesso!');
      return { success: true };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      
      const message = error.response?.data?.message || 'Erro no registro';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
    toast.success('Logout realizado com sucesso!');
  };

  // Atualizar perfil
  const updateProfile = async (updateData) => {
    try {
      const response = await api.patch('/auth/profile', updateData);
      const updatedUser = response.data.data.user;

      // Atualizar localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: updatedUser,
      });

      toast.success('Perfil atualizado com sucesso!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Erro ao atualizar perfil';
      toast.error(message);
      return { success: false, message };
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    loadUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export default AuthContext;