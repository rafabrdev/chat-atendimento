import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  MessageSquare, 
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  Building,
  User,
  ArrowRight,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { socketService } from '../../lib/socket';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';

const AgentDashboard = ({ onAcceptConversation }) => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const socket = useSocket(token, user); // Inicializar socket
  const [queuedConversations, setQueuedConversations] = useState([]);
  const [activeConversations, setActiveConversations] = useState([]);
  const [stats, setStats] = useState({
    queueCount: 0,
    activeCount: 0,
    avgWaitTime: 0,
    todayResolved: 0
  });
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState('online'); // online, busy, away

  useEffect(() => {
    loadQueue();
    loadActiveConversations();
    loadStats();
    
    // Atualizar a cada 1 segundo para garantir dados em tempo real
    const interval = setInterval(() => {
      // Só atualizar se não estiver carregando para evitar sobrecarga
      if (!loading) {
        loadStats();
        // Atualizar fila e conversas ativas também
        loadQueue();
        loadActiveConversations();
      }
    }, 1000); // Atualizar a cada 1 segundo

    return () => clearInterval(interval);
  }, []);
  
  // Listener separado para socket events
  useEffect(() => {
    // Socket listeners com melhor logging
    const handleQueueUpdate = () => {
      console.log('🔄 Queue updated - reloading...');
      loadQueue();
      loadActiveConversations();
      loadStats();
    };
    
    const handleNewConv = (conversation) => {
      console.log('🆕 New conversation in queue:', conversation);
      setQueuedConversations(prev => {
        // Evitar duplicatas
        if (prev.some(c => c._id === conversation._id)) return prev;
        return [conversation, ...prev];
      });
      // Atualizar contador
      setStats(prev => ({
        ...prev,
        queueCount: prev.queueCount + 1
      }));
      toast('Nova conversa na fila!', {
        icon: '🔔',
        duration: 4000
      });
    };
    
    const handleConversationAccepted = (data) => {
      console.log('✅ Conversation accepted by agent:', data);
      // Remover da fila se outro agente aceitou
      setQueuedConversations(prev => prev.filter(c => c._id !== data.conversationId));
      // Atualizar estatísticas
      setStats(prev => ({
        ...prev,
        queueCount: Math.max(0, prev.queueCount - 1),
        activeCount: prev.activeCount + 1
      }));
      loadActiveConversations();
    };
    
    const handleConversationAssigned = ({ conversationId }) => {
      setQueuedConversations(prev => prev.filter(c => c._id !== conversationId));
      loadActiveConversations();
    };
    
    socketService.on('queue-updated', handleQueueUpdate);
    socketService.on('new-conversation', handleNewConv);
    socketService.on('conversation-assigned', handleConversationAssigned);
    socketService.on('conversation-accepted', handleConversationAccepted);
    socketService.on('conversation-status-changed', handleQueueUpdate);

    return () => {
      socketService.off('queue-updated', handleQueueUpdate);
      socketService.off('new-conversation', handleNewConv);
      socketService.off('conversation-assigned', handleConversationAssigned);
      socketService.off('conversation-accepted', handleConversationAccepted);
      socketService.off('conversation-status-changed', handleQueueUpdate);
    };
  }, []);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/chat/conversations?status=waiting');
      setQueuedConversations(data);
    } catch (error) {
      console.error('Erro ao carregar fila:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveConversations = async () => {
    try {
      const { data } = await api.get('/chat/conversations?status=active');
      setActiveConversations(data.filter(conv => conv.assignedAgent?._id === localStorage.getItem('userId')));
    } catch (error) {
      console.error('Erro ao carregar conversas ativas:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [queueData, activeData] = await Promise.all([
        api.get('/chat/queue/status'),
        api.get('/chat/conversations?status=active')
      ]);
      
      const myActiveConvs = activeData.data.filter(
        conv => conv.assignedAgent?._id === (user?._id || user?.id || localStorage.getItem('userId'))
      );
      
      setStats({
        queueCount: queueData.data.queueCount || queuedConversations.length || 0,
        activeCount: myActiveConvs.length || 0,
        avgWaitTime: queueData.data.estimatedWait || 0,
        todayResolved: queueData.data.todayResolved || 0
      });
      
      // Atualizar lista de conversas ativas também
      setActiveConversations(myActiveConvs);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      // Usar dados locais como fallback
      setStats(prev => ({
        ...prev,
        queueCount: queuedConversations.length,
        activeCount: activeConversations.length
      }));
    }
  };

  const handleNewConversation = (conversation) => {
    setQueuedConversations(prev => [conversation, ...prev]);
    toast('Nova conversa na fila!', {
      icon: '🔔',
      duration: 4000
    });
  };

  const handleConversationAssigned = ({ conversationId }) => {
    setQueuedConversations(prev => prev.filter(c => c._id !== conversationId));
    loadActiveConversations();
  };

  const handleAcceptConversation = async (conversation) => {
    try {
      console.log('Aceitando conversa:', conversation._id);
      
      // Usar a rota /accept que é específica para agentes aceitarem conversas
      const { data } = await api.patch(`/chat/conversations/${conversation._id}/accept`);
      
      console.log('Conversa aceita, dados retornados:', data);
      
      toast.success('Conversa aceita com sucesso!');
      
      // Chamar callback para abrir a conversa no chat
      onAcceptConversation(data);
      
      // Remover da fila local
      setQueuedConversations(prev => prev.filter(c => c._id !== conversation._id));
      
      // Adicionar às conversas ativas
      setActiveConversations(prev => [data, ...prev]);
    } catch (error) {
      console.error('Erro ao aceitar conversa:', error);
      console.error('Detalhes do erro:', error.response?.data);
      
      // Verificar se é erro de permissão
      if (error.response?.status === 403) {
        toast.error('Você não tem permissão para aceitar conversas');
      } else if (error.response?.status === 404) {
        toast.error('Conversa não encontrada');
      } else {
        toast.error(error.response?.data?.error || 'Erro ao aceitar conversa');
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    setAgentStatus(newStatus);
    socketService.setAgentStatus(newStatus === 'online' ? 'available' : 'busy');
    toast.success(`Status alterado para ${newStatus}`);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatWaitTime = (date) => {
    if (!date) return 'Agora';
    const now = new Date();
    const created = new Date(date);
    const diffMinutes = Math.floor((now - created) / 60000);
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes} min`;
    return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}min`;
  };

  return (
    <div className="h-full bg-gray-50 p-6">
      {/* Header com Status do Agente */}
      <div className="mb-6 bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard do Agente</h1>
            <p className="text-sm text-gray-600 mt-1">Gerencie suas conversas e atendimentos</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Status:</span>
              <select
                value={agentStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="online">🟢 Online</option>
                <option value="busy">🟡 Ocupado</option>
                <option value="away">🔴 Ausente</option>
              </select>
            </div>
            
            <button
              onClick={loadQueue}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Na Fila</p>
              <p className="text-2xl font-bold text-gray-900">{stats.queueCount}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeCount}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tempo Médio</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgWaitTime}min</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolvidos Hoje</p>
              <p className="text-2xl font-bold text-gray-900">{stats.todayResolved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Fila de Atendimento */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            Fila de Atendimento ({queuedConversations.length})
          </h2>
        </div>
        
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : queuedConversations.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Nenhuma conversa na fila!</p>
              <p className="text-gray-500 text-sm mt-2">Todas as conversas foram atendidas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queuedConversations.map((conversation) => (
                <div
                  key={conversation._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {conversation.client?.name || 'Cliente'}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {conversation.client?.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {conversation.client.email}
                              </span>
                            )}
                            {conversation.client?.companyId && (
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {conversation.client.companyName || 'Empresa'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(conversation.priority)}`}>
                          {conversation.priority === 'urgent' && '🔴 Urgente'}
                          {conversation.priority === 'high' && '🟠 Alta'}
                          {conversation.priority === 'normal' && '🔵 Normal'}
                          {conversation.priority === 'low' && '⚪ Baixa'}
                        </span>
                        
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Aguardando há {formatWaitTime(conversation.createdAt)}
                        </span>
                        
                        {conversation.tags?.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {conversation.lastMessage && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            {conversation.lastMessage.content}
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleAcceptConversation(conversation)}
                      className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aceitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversas Ativas */}
      {activeConversations.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              Suas Conversas Ativas ({activeConversations.length})
            </h2>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {activeConversations.map((conversation) => (
                <button
                  key={conversation._id}
                  onClick={() => onAcceptConversation(conversation)}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {conversation.client?.name || 'Cliente'}
                    </span>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {conversation.lastMessage?.content || 'Sem mensagens'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
