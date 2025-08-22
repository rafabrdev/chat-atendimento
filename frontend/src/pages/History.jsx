import React, { useState, useEffect } from 'react';
import { 
  History as HistoryIcon, 
  Search, 
  Download, 
  MessageSquare, 
  Calendar,
  User,
  Filter,
  X,
  FileText,
  ChevronRight,
  Clock,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const History = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    agentId: '',
    rating: ''
  });
  const [agents, setAgents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationDetails, setConversationDetails] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  // Fetch conversations
  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(searchQuery && { search: searchQuery }),
        ...(filters.status && { status: filters.status }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.agentId && { agentId: filters.agentId }),
        ...(filters.rating && { rating: filters.rating })
      });

      const response = await api.get(`/history/conversations?${params}`);
      setConversations(response.data.conversations);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Erro ao carregar histórico de conversas');
    } finally {
      setLoading(false);
    }
  };

  // Fetch conversation details
  const fetchConversationDetails = async (conversationId) => {
    try {
      const response = await api.get(`/history/conversations/${conversationId}`);
      setConversationDetails(response.data);
      setSelectedConversation(conversationId);
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      toast.error('Erro ao carregar detalhes da conversa');
    }
  };

  // Export conversation to PDF
  const exportToPDF = async (conversationId) => {
    setExportingId(conversationId);
    try {
      const response = await api.get(`/history/export/${conversationId}/pdf`, {
        responseType: 'blob'
      });

      // Create a blob URL and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `conversa-${conversationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Conversa exportada para PDF com sucesso!');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Erro ao exportar conversa para PDF');
    } finally {
      setExportingId(null);
    }
  };

  // Export conversation to CSV
  const exportToCSV = async (conversationId) => {
    setExportingId(conversationId);
    try {
      const response = await api.get(`/history/export/${conversationId}/csv`, {
        responseType: 'blob'
      });

      // Create a blob URL and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `conversa-${conversationId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Conversa exportada para CSV com sucesso!');
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error('Erro ao exportar conversa para CSV');
    } finally {
      setExportingId(null);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchConversations();
  };

  // Apply filters
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchConversations();
    setShowFilters(false);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: '',
      startDate: '',
      endDate: '',
      agentId: '',
      rating: ''
    });
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchConversations();
  };

  useEffect(() => {
    fetchConversations();
    // Se for admin, buscar lista de agentes para o filtro
    if (user?.role === 'admin') {
      fetchAgents();
    }
  }, [pagination.page]);
  
  // Buscar lista de agentes
  const fetchAgents = async () => {
    try {
      const response = await api.get('/agents/all');
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      waiting: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return format(new Date(date), "dd 'de' MMM 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Conversas</h1>
          <p className="text-gray-600 mt-1">Visualize e exporte suas conversas anteriores</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtros
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nas conversas..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Buscar
        </button>
      </form>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="active">Ativo</option>
                <option value="waiting">Aguardando</option>
                <option value="closed">Fechado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avaliação
              </label>
              <select
                value={filters.rating}
                onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                <option value="5">5 Estrelas</option>
                <option value="4">4 Estrelas</option>
                <option value="3">3 Estrelas</option>
                <option value="2">2 Estrelas</option>
                <option value="1">1 Estrela</option>
              </select>
            </div>
            {/* Filtro por agente - apenas para admin */}
            {user?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agente
                </label>
                <select
                  value={filters.agentId}
                  onChange={(e) => setFilters({ ...filters, agentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os agentes</option>
                  {agents.map(agent => (
                    <option key={agent._id} value={agent._id}>
                      {agent.user?.name || agent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Limpar
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Conversations List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhuma conversa encontrada
            </h2>
            <p className="text-gray-600">
              Não há conversas que correspondam aos seus critérios de busca.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {conversations.map((conversation) => (
            <div
              key={conversation._id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {user?.role === 'client' 
                          ? (conversation.assignedAgent?.name || 'Aguardando agente')
                          : (conversation.client?.name || 'Cliente')}
                        {user?.role !== 'client' && conversation.client?.company && (
                          <span className="text-sm font-normal text-gray-600 ml-1">
                            ({conversation.client?.company})
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {user?.role === 'client' 
                          ? (conversation.assignedAgent?.email || '')
                          : conversation.client?.email}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(conversation.status)}`}>
                      {conversation.status === 'active' ? 'Ativo' : 
                       conversation.status === 'waiting' ? 'Aguardando' : 'Fechado'}
                    </span>
                  </div>
                  <div className="ml-13 space-y-1">
                    {conversation.lastMessage && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">
                          {conversation.lastMessage.sender?.name}:
                        </span>{' '}
                        {conversation.lastMessage.content.substring(0, 100)}
                        {conversation.lastMessage.content.length > 100 && '...'}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(conversation.createdAt)}
                      </span>
                      <span className="flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        {conversation.messageCount || 0} mensagens
                      </span>
                      {conversation.rating && (
                        <span className="flex items-center">
                          <Star className="w-3 h-3 mr-1 text-yellow-500" />
                          {conversation.rating}/5
                        </span>
                      )}
                      {/* Mostrar agente para admin e clientes */}
                      {conversation.assignedAgent && (
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          <span className="font-medium">
                            {conversation.assignedAgent.name}
                            {user?.role === 'admin' && conversation.assignedAgent.company && (
                              <span className="font-normal text-gray-500"> ({conversation.assignedAgent.company})</span>
                            )}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchConversationDetails(conversation._id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Ver detalhes"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => exportToPDF(conversation._id)}
                    disabled={exportingId === conversation._id}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Exportar para PDF"
                  >
                    {exportingId === conversation._id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => exportToCSV(conversation._id)}
                    disabled={exportingId === conversation._id}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Exportar para CSV"
                  >
                    {exportingId === conversation._id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm">
                Página {pagination.page} de {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* Conversation Details Modal */}
      {selectedConversation && conversationDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Detalhes da Conversa</h2>
              <button
                onClick={() => {
                  setSelectedConversation(null);
                  setConversationDetails(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {/* Conversation Info */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Cliente</p>
                    <p className="font-medium">
                      {conversationDetails.conversation?.client?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Agente</p>
                    <p className="font-medium">
                      {conversationDetails.conversation?.assignedAgent?.name || 'Não atribuído'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(conversationDetails.conversation?.status)}`}>
                      {conversationDetails.conversation?.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Data de Criação</p>
                    <p className="font-medium">
                      {formatDate(conversationDetails.conversation?.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Mensagens</h3>
                {conversationDetails.messages?.map((message) => (
                  <div
                    key={message._id}
                    className={`p-3 rounded-lg ${
                      message.senderType === 'client'
                        ? 'bg-blue-50 ml-auto max-w-[70%]'
                        : 'bg-gray-50 mr-auto max-w-[70%]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-sm">
                        {message.sender?.name || 'Sistema'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(message.createdAt), 'HH:mm')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700">{message.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => exportToPDF(selectedConversation)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Exportar PDF
              </button>
              <button
                onClick={() => exportToCSV(selectedConversation)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
