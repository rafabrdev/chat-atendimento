import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Clock, BarChart3, Plus, History as HistoryIcon } from 'lucide-react';
import api from '../config/api.js';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState({
    totalToday: 0,
    resolved: 0,
    avgResponseTime: 0,
    activeConversations: 0
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      // Carregar conversas
      const { data: convData } = await api.get('/chat/conversations');
      setConversations(convData);
      
      // Calcular estatísticas reais
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayConversations = convData.filter(conv => 
        new Date(conv.createdAt) >= today
      );
      
      const activeConvs = convData.filter(conv => conv.status === 'active');
      const resolvedToday = todayConversations.filter(conv => conv.status === 'closed');
      
      setStats({
        totalToday: todayConversations.length,
        resolved: resolvedToday.length,
        activeConversations: activeConvs.length,
        avgResponseTime: 0 // Seria necessário calcular baseado nas mensagens
      });
      
      // Se for agente, buscar estatísticas do agente
      if (user?.role === 'agent' || user?.role === 'admin') {
        try {
          const { data: agentStats } = await api.get('/chat/agent/stats');
          setStats(prev => ({ ...prev, ...agentStats }));
        } catch (error) {
          console.error('Erro ao carregar estatísticas do agente:', error);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError(error.message || 'Erro ao carregar dados');
      setLoading(false);
    }
  };

  // Função helper deve ser definida antes de ser usada
  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'agora mesmo';
    if (minutes < 60) return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
    if (hours < 24) return `${hours} hora${hours > 1 ? 's' : ''} atrás`;
    return `${days} dia${days > 1 ? 's' : ''} atrás`;
  };

  const statsCards = [
    {
      title: 'Conversas Ativas',
      value: stats.activeConversations.toString(),
      icon: MessageSquare,
      color: 'bg-blue-500',
      change: stats.activeConversations > 0 ? '+' + stats.activeConversations : '0',
      changeType: stats.activeConversations > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Resolvidas Hoje',
      value: stats.resolved.toString(),
      icon: Clock,
      color: 'bg-green-500',
      change: stats.resolved > 0 ? '+' + stats.resolved : '0',
      changeType: stats.resolved > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Atendimentos Hoje',
      value: stats.totalToday.toString(),
      icon: BarChart3,
      color: 'bg-purple-500',
      change: stats.totalToday > 0 ? '+' + stats.totalToday : '0',
      changeType: stats.totalToday > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Total de Conversas',
      value: conversations.length.toString(),
      icon: Users,
      color: 'bg-orange-500',
      change: conversations.length > 0 ? 'Total' : '0',
      changeType: 'neutral'
    }
  ];

  // Gerar atividades recentes baseadas nas conversas reais
  const recentActivities = conversations
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5)
    .map((conv, index) => {
      const time = new Date(conv.updatedAt || conv.createdAt);
      const timeAgo = getTimeAgo(time);
      
      let message = '';
      let status = '';
      
      // Para clientes, mostrar o nome do agente; para agentes, mostrar o nome do cliente
      const isClient = user?.role === 'client';
      const displayName = isClient 
        ? (conv.assignedAgent?.name || 'Suporte')
        : (conv.client?.name || 'Cliente');
      
      if (conv.status === 'active') {
        message = isClient 
          ? `Conversa ativa com ${displayName}`
          : `Conversa ativa com ${displayName}`;
        status = 'active';
      } else if (conv.status === 'waiting') {
        message = isClient
          ? `Sua conversa está aguardando atendimento`
          : `Nova conversa aguardando atendimento`;
        status = 'waiting';
      } else if (conv.status === 'closed') {
        message = isClient
          ? `Conversa encerrada com ${displayName}`
          : `Conversa encerrada com ${displayName}`;
        status = 'completed';
      }
      
      return {
        id: conv._id,
        type: 'conversation',
        message,
        time: timeAgo,
        status
      };
    });

  // Mostrar loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Mostrar erro
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium">Erro ao carregar dashboard</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Recarregar página
        </button>
      </div>
    );
  }

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
          {statsCards.map((stat, index) => {
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
                    stat.changeType === 'positive' ? 'text-green-600' : 
                    stat.changeType === 'neutral' ? 'text-gray-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-600 ml-1">hoje</span>
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
            <button 
              onClick={() => navigate('/conversations')}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center group"
            >
              <MessageSquare className="w-8 h-8 text-gray-400 group-hover:text-primary-600 mx-auto mb-2 transition-colors" />
              <p className="text-sm font-medium text-gray-600 group-hover:text-primary-700">Iniciar Nova Conversa</p>
            </button>
            <button 
              onClick={() => navigate('/history')}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center group"
            >
              <HistoryIcon className="w-8 h-8 text-gray-400 group-hover:text-primary-600 mx-auto mb-2 transition-colors" />
              <p className="text-sm font-medium text-gray-600 group-hover:text-primary-700">Ver Histórico</p>
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-center group"
            >
              <Users className="w-8 h-8 text-gray-400 group-hover:text-primary-600 mx-auto mb-2 transition-colors" />
              <p className="text-sm font-medium text-gray-600 group-hover:text-primary-700">Meu Perfil</p>
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
                  activity.status === 'waiting' ? 'bg-yellow-400' :
                  activity.status === 'transferred' ? 'bg-orange-400' :
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
