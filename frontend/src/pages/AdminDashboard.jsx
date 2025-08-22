import React, { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Eye,
  Ban,
  RefreshCw,
  Star,
  User,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const AdminDashboard = () => {
  const socket = useSocket();
  const [activeTab, setActiveTab] = useState('agents');
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [metrics, setMetrics] = useState({
    totalAgents: 0,
    onlineAgents: 0,
    availableAgents: 0,
    totalChats: 0,
    activeChats: 0,
    queuedChats: 0,
    avgResponseTime: 0,
    avgRating: 0
  });
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [showEditAgent, setShowEditAgent] = useState(false);
  const [agentPerformance, setAgentPerformance] = useState(null);
  const [editForm, setEditForm] = useState({
    maxConcurrentChats: 5,
    departments: [],
    skills: []
  });

  // Buscar dados iniciais
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('agent:statusUpdate', handleAgentStatusUpdate);
    socket.on('conversation:new', handleNewConversation);
    socket.on('conversation:closed', handleConversationClosed);
    socket.on('conversation:assigned', handleConversationAssigned);

    return () => {
      socket.off('agent:statusUpdate');
      socket.off('conversation:new');
      socket.off('conversation:closed');
      socket.off('conversation:assigned');
    };
  }, [socket, agents, activeChats]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [agentsRes, chatsRes, workloadRes, analyticsRes] = await Promise.all([
        axios.get(`${API_URL}/agents/all`, { headers }),
        axios.get(`${API_URL}/chat/conversations`, { headers }),
        axios.get(`${API_URL}/agents/workload`, { headers }),
        axios.get(`${API_URL}/history/analytics?period=day`, { headers })
      ]);

      setAgents(agentsRes.data.agents || []);
      const allChats = chatsRes.data.conversations || [];
      setActiveChats(allChats.filter(chat => chat.status !== 'closed'));

      const onlineAgents = agentsRes.data.agents.filter(a => a.status === 'online').length;
      const availableAgents = agentsRes.data.agents.filter(a => 
        a.status === 'online' && 
        a.availability?.isAvailable && 
        a.availability?.currentActiveChats < a.availability?.maxConcurrentChats
      ).length;

      setMetrics({
        totalAgents: agentsRes.data.agents.length,
        onlineAgents,
        availableAgents,
        totalChats: allChats.length,
        activeChats: allChats.filter(c => c.status === 'active').length,
        queuedChats: allChats.filter(c => c.status === 'waiting').length,
        avgResponseTime: analyticsRes.data.analytics?.avgResponseTime || 0,
        avgRating: analyticsRes.data.analytics?.avgRating || 0
      });
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentStatusUpdate = (data) => {
    setAgents(prev => prev.map(agent => 
      agent.user._id === data.agentId 
        ? { ...agent, status: data.status }
        : agent
    ));
  };

  const handleNewConversation = (conversation) => {
    setActiveChats(prev => [...prev, conversation]);
    setMetrics(prev => ({
      ...prev,
      totalChats: prev.totalChats + 1,
      queuedChats: prev.queuedChats + 1
    }));
  };

  const handleConversationClosed = (conversationId) => {
    setActiveChats(prev => prev.filter(chat => chat._id !== conversationId));
    setMetrics(prev => ({
      ...prev,
      activeChats: Math.max(0, prev.activeChats - 1)
    }));
  };

  const handleConversationAssigned = (data) => {
    setActiveChats(prev => prev.map(chat =>
      chat._id === data.conversationId
        ? { ...chat, status: 'active', assignedAgent: data.agentId }
        : chat
    ));
    setMetrics(prev => ({
      ...prev,
      queuedChats: Math.max(0, prev.queuedChats - 1),
      activeChats: prev.activeChats + 1
    }));
  };

  const fetchAgentPerformance = async (agentId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_URL}/agents/performance/${agentId}?period=week`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAgentPerformance(res.data.performance);
    } catch (error) {
      console.error('Erro ao buscar performance:', error);
    }
  };

  const handleViewAgentDetails = async (agent) => {
    setSelectedAgent(agent);
    await fetchAgentPerformance(agent.user._id);
    setShowAgentDetails(true);
  };

  const handleEditAgent = (agent) => {
    setSelectedAgent(agent);
    setEditForm({
      maxConcurrentChats: agent.availability?.maxConcurrentChats || 5,
      departments: agent.departments || [],
      skills: agent.skills || []
    });
    setShowEditAgent(true);
  };

  const handleSaveAgentChanges = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/agents/availability`,
        {
          agentId: selectedAgent.user._id,
          maxConcurrentChats: editForm.maxConcurrentChats,
          departments: editForm.departments,
          skills: editForm.skills
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setShowEditAgent(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Erro ao atualizar agente:', error);
    }
  };

  const handleBlockAgent = async (agentId) => {
    if (confirm('Tem certeza que deseja bloquear este agente?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.put(
          `${API_URL}/agents/status`,
          { agentId, status: 'blocked' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchDashboardData();
      } catch (error) {
        console.error('Erro ao bloquear agente:', error);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'online': return 'Online';
      case 'busy': return 'Ocupado';
      case 'offline': return 'Offline';
      case 'blocked': return 'Bloqueado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
        <p className="text-gray-600 mt-1">Gerencie agentes e monitore o sistema</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Agentes</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalAgents}</p>
              <p className="text-sm text-green-600 mt-1">
                {metrics.onlineAgents} online
              </p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chats Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.activeChats}</p>
              <p className="text-sm text-yellow-600 mt-1">
                {metrics.queuedChats} na fila
              </p>
            </div>
            <MessageSquare className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tempo de Resposta</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.avgResponseTime}s</p>
              <p className="text-sm text-gray-600 mt-1">Média do dia</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avaliação Média</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.avgRating.toFixed(1)}</p>
              <div className="flex mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round(metrics.avgRating) 
                        ? 'text-yellow-400 fill-yellow-400' 
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'agents'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="inline-block w-4 h-4 mr-2" />
              Agentes
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={`px-6 py-3 text-sm font-medium border-b-2 relative ${
                activeTab === 'chats'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="inline-block w-4 h-4 mr-2" />
              Chats Ativos
              {activeChats.length > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                  {activeChats.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'performance'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp className="inline-block w-4 h-4 mr-2" />
              Performance
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Tab: Agentes */}
          {activeTab === 'agents' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Gerenciamento de Agentes</h2>
                <button
                  onClick={fetchDashboardData}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Agente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chats Ativos
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Limite
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avaliação
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Atendidos
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {agents.map((agent) => (
                      <tr key={agent._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white">
                              {agent.user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {agent.user?.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {agent.user?.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(agent.status)}`}>
                            {getStatusLabel(agent.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center">
                            <span className="text-sm text-gray-900">
                              {agent.availability?.currentActiveChats || 0}
                            </span>
                            {agent.availability?.currentActiveChats >= agent.availability?.maxConcurrentChats && (
                              <XCircle className="w-4 h-4 text-red-500 ml-1" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {agent.availability?.maxConcurrentChats || 5}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 mr-1" />
                            <span className="text-sm text-gray-900">
                              {agent.performance?.averageRating?.toFixed(1) || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {agent.performance?.totalConversations || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleViewAgentDetails(agent)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditAgent(agent)}
                            className="text-green-600 hover:text-green-900 mr-3"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {agent.status !== 'blocked' && (
                            <button
                              onClick={() => handleBlockAgent(agent.user._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Bloquear"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Chats Ativos */}
          {activeTab === 'chats' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Chats em Andamento</h2>
                <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                  {activeChats.length} conversas ativas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeChats.map((chat) => (
                  <div key={chat._id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-gray-900">
                        {chat.client?.name || 'Cliente'}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        chat.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {chat.status === 'active' ? 'Ativo' : 'Na fila'}
                      </span>
                    </div>

                    {chat.client?.company && (
                      <p className="text-sm text-gray-600 mb-2">
                        Empresa: {chat.client.company}
                      </p>
                    )}

                    {chat.assignedAgent && (
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <User className="w-4 h-4 mr-1" />
                        Agente: {agents.find(a => a.user._id === chat.assignedAgent)?.user?.name || 'Desconhecido'}
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <Clock className="w-4 h-4 mr-1" />
                      Iniciado: {new Date(chat.createdAt).toLocaleTimeString('pt-BR')}
                    </div>

                    <div className="flex items-center text-sm text-gray-600">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      {chat.messages?.length || 0} mensagens
                    </div>
                  </div>
                ))}
              </div>

              {activeChats.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum chat ativo no momento</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Performance */}
          {activeTab === 'performance' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Análise de Performance</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <div key={agent._id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white mr-3">
                          {agent.user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{agent.user?.name}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(agent.status)}`}>
                            {getStatusLabel(agent.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Total Atendimentos</p>
                        <p className="text-lg font-semibold">{agent.performance?.totalConversations || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Avaliação Média</p>
                        <div className="flex items-center">
                          <p className="text-lg font-semibold mr-1">
                            {agent.performance?.averageRating?.toFixed(1) || '-'}
                          </p>
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tempo Médio</p>
                        <p className="text-lg font-semibold">{agent.performance?.averageResponseTime || 0}s</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Taxa Resolução</p>
                        <p className="text-lg font-semibold">{agent.performance?.resolutionRate || 0}%</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Carga de Trabalho</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full"
                          style={{
                            width: `${(agent.availability?.currentActiveChats / agent.availability?.maxConcurrentChats) * 100 || 0}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {agent.availability?.currentActiveChats || 0} de {agent.availability?.maxConcurrentChats || 5} chats
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Detalhes do Agente */}
      {showAgentDetails && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Detalhes do Agente</h2>
                <button
                  onClick={() => setShowAgentDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center text-white text-2xl mr-4">
                  {selectedAgent.user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedAgent.user?.name}</h3>
                  <p className="text-gray-600">{selectedAgent.user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Status Atual</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedAgent.status)}`}>
                    {getStatusLabel(selectedAgent.status)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última Atividade</p>
                  <p className="text-sm">
                    {selectedAgent.lastActiveAt 
                      ? new Date(selectedAgent.lastActiveAt).toLocaleString('pt-BR')
                      : 'Sem registro'}
                  </p>
                </div>
              </div>

              {agentPerformance && (
                <>
                  <h4 className="font-semibold mb-3">Performance (Última Semana)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary-600">
                        {agentPerformance.totalConversations}
                      </p>
                      <p className="text-xs text-gray-600">Conversas</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {agentPerformance.closedConversations}
                      </p>
                      <p className="text-xs text-gray-600">Resolvidas</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {agentPerformance.averageRating}
                      </p>
                      <p className="text-xs text-gray-600">Avaliação</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {agentPerformance.averageResponseTime}s
                      </p>
                      <p className="text-xs text-gray-600">Tempo Resposta</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAgentDetails(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Agente */}
      {showEditAgent && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Editar Configurações</h2>
                <button
                  onClick={() => setShowEditAgent(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limite de Chats Simultâneos
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={editForm.maxConcurrentChats}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    maxConcurrentChats: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamentos (separe por vírgula)
                </label>
                <input
                  type="text"
                  value={editForm.departments.join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    departments: e.target.value.split(',').map(d => d.trim()).filter(Boolean)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Habilidades (separe por vírgula)
                </label>
                <input
                  type="text"
                  value={editForm.skills.join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => setShowEditAgent(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAgentChanges}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
