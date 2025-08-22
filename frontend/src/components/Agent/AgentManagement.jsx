import React, { useState, useEffect } from 'react';
import {
  FiUser,
  FiCircle,
  FiClock,
  FiMessageSquare,
  FiTrendingUp,
  FiStar,
  FiSettings,
  FiToggleLeft,
  FiToggleRight,
  FiRefreshCw
} from 'react-icons/fi';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const AgentManagement = () => {
  const { user } = useAuth();
  const [agentData, setAgentData] = useState(null);
  const [agents, setAgents] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [isUpdating, setIsUpdating] = useState(false);

  // Status options
  const statusOptions = [
    { value: 'online', label: 'Disponível', color: 'green' },
    { value: 'busy', label: 'Ocupado', color: 'yellow' },
    { value: 'away', label: 'Ausente', color: 'orange' },
    { value: 'break', label: 'Pausa', color: 'blue' },
    { value: 'offline', label: 'Offline', color: 'gray' }
  ];

  // Fetch agent data
  const fetchAgentData = async () => {
    try {
      setLoading(true);
      
      // Get current agent profile
      if (user?.role === 'agent') {
        const profileRes = await api.get('/agents/profile');
        setAgentData(profileRes.data.agent);
      }

      // Get all agents (for admin/supervisor view)
      if (user?.role === 'admin' || user?.role === 'agent') {
        const agentsRes = await api.get('/agents/all');
        setAgents(agentsRes.data.agents);
      }

      // Get performance metrics
      const perfRes = await api.get(`/agents/performance?period=${selectedPeriod}`);
      setPerformance(perfRes.data.performance);

      // Get workload distribution
      const workloadRes = await api.get('/agents/workload');
      setWorkload(workloadRes.data.workload);

    } catch (error) {
      console.error('Error fetching agent data:', error);
      toast.error('Falha ao carregar dados do agente');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, [selectedPeriod]);

  // Update agent status
  const updateStatus = async (newStatus) => {
    setIsUpdating(true);
    try {
      const response = await api.put('/agents/status', { status: newStatus });
      setAgentData(response.data.agent);
      toast.success(`Status atualizado para ${newStatus}`);
      fetchAgentData(); // Refresh all data
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Falha ao atualizar status');
    } finally {
      setIsUpdating(false);
    }
  };

  // Update availability settings
  const updateAvailability = async (settings) => {
    try {
      const response = await api.put('/agents/availability', settings);
      setAgentData(response.data.agent);
      toast.success('Configurações de disponibilidade atualizadas');
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Falha ao atualizar disponibilidade');
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusObj = statusOptions.find(s => s.value === status);
    return statusObj ? statusObj.color : 'gray';
  };

  // Format time
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Agentes</h1>
        <button
          onClick={fetchAgentData}
          className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
        >
          <FiRefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Current Agent Status (for agents) */}
      {user?.role === 'agent' && agentData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FiUser className="mr-2" />
            Meu Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Atual
              </label>
              <div className="flex space-x-2">
                {statusOptions.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => updateStatus(status.value)}
                    disabled={isUpdating}
                    className={`
                      px-3 py-2 rounded-md flex items-center space-x-2 transition-all
                      ${agentData.status === status.value
                        ? `bg-${status.color}-100 border-2 border-${status.color}-500 text-${status.color}-700`
                        : 'bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100'
                      }
                      ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <FiCircle className={`w-3 h-3 fill-current text-${status.color}-500`} />
                    <span className="text-sm font-medium">{status.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Availability Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Máximo de Chats Simultâneos
              </label>
              <div className="flex items-center space-x-3">
                {user?.role === 'admin' ? (
                  <>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={agentData.availability?.maxConcurrentChats || 5}
                      onChange={(e) => updateAvailability({ 
                        maxConcurrentChats: parseInt(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-lg font-semibold text-blue-600 w-8">
                      {agentData.availability?.maxConcurrentChats || 5}
                    </span>
                  </>
                ) : (
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <span className="text-lg font-semibold text-gray-700">
                      {agentData.availability?.maxConcurrentChats || 5} chats
                    </span>
                    <span className="text-xs text-gray-500 ml-2">(definido pelo administrador)</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Atualmente atendendo: {agentData.availability?.currentActiveChats || 0} chats
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">
                {agentData.performance?.totalConversations || 0}
              </div>
              <div className="text-xs text-gray-600">Total de Chats</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">
                {agentData.performance?.resolvedConversations || 0}
              </div>
              <div className="text-xs text-gray-600">Resolvidos</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-600">
                {formatTime(agentData.performance?.averageResponseTime || 0)}
              </div>
              <div className="text-xs text-gray-600">Tempo Médio</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600 flex items-center">
                {agentData.performance?.averageRating?.toFixed(1) || '0.0'}
                <FiStar className="w-4 h-4 ml-1" />
              </div>
              <div className="text-xs text-gray-600">Avaliação</div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {performance && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <FiTrendingUp className="mr-2" />
              Métricas de Desempenho
            </h2>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="day">Hoje</option>
              <option value="week">Esta Semana</option>
              <option value="month">Este Mês</option>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="text-sm text-gray-600">Total de Conversas</div>
              <div className="text-2xl font-bold">{performance.totalConversations}</div>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <div className="text-sm text-gray-600">Conversas Fechadas</div>
              <div className="text-2xl font-bold">{performance.closedConversations}</div>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <div className="text-sm text-gray-600">Taxa de Resolução</div>
              <div className="text-2xl font-bold">{performance.resolutionRate}%</div>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="text-sm text-gray-600">Tempo Médio de Resposta</div>
              <div className="text-2xl font-bold">{formatTime(performance.averageResponseTime)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Team Overview (for admin/supervisor) */}
      {agents.length > 0 && (user?.role === 'admin' || user?.role === 'supervisor') && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FiUser className="mr-2" />
            Visão Geral da Equipe
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agente
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chats Ativos
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Atendidos
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tempo Médio
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avaliação
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agents.map((agent) => (
                  <tr key={agent._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <FiUser className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {agent.user?.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {agent.user?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(agent.status)}-100 text-${getStatusColor(agent.status)}-800`}>
                        <FiCircle className={`w-2 h-2 mr-1 fill-current`} />
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {agent.availability?.currentActiveChats || 0} / {agent.availability?.maxConcurrentChats || 5}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {agent.performance?.totalConversations || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(agent.performance?.averageResponseTime || 0)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {agent.performance?.averageRating?.toFixed(1) || '0.0'}
                        </span>
                        <FiStar className="w-3 h-3 ml-1 text-yellow-400 fill-current" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workload Distribution */}
      {workload && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FiMessageSquare className="mr-2" />
            Distribuição de Carga de Trabalho
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">
                {workload.summary.totalAgents}
              </div>
              <div className="text-sm text-gray-600">Total de Agentes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {workload.summary.onlineAgents}
              </div>
              <div className="text-sm text-gray-600">Online</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {workload.summary.availableAgents}
              </div>
              <div className="text-sm text-gray-600">Disponíveis</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">
                {workload.summary.offlineAgents}
              </div>
              <div className="text-sm text-gray-600">Offline</div>
            </div>
          </div>

          {workload.distribution && workload.distribution.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Distribuição de Chats Ativos</h3>
              <div className="space-y-2">
                {workload.distribution.map((dist) => (
                  <div key={dist._id} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-gray-600">{dist._id}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{dist.count} agentes</span>
                      <span className="text-xs text-gray-500">
                        ({dist.totalActiveChats} chats)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentManagement;
