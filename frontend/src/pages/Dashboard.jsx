import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
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
