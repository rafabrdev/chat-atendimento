import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  MessageSquare, 
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  AlertCircle,
  RefreshCw,
  Send,
  Paperclip,
  Search,
  Filter,
  ChevronRight,
  User,
  Building,
  Calendar,
  Tag,
  MoreVertical,
  X,
  File as FileIcon,
  Image as ImageIcon
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { socketService } from '../../lib/socket';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import FileUpload from './FileUpload';

const AgentChatContainer = () => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const socket = useSocket(token, user);
  
  // Estados
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  
  // Estados do agente
  const [agentStatus, setAgentStatus] = useState('online');
  const [queueCount, setQueueCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all'); // all, waiting, active, closed
  
  // Estatísticas
  const [stats, setStats] = useState({
    totalToday: 0,
    resolved: 0,
    avgResponseTime: 0,
    satisfaction: 0
  });

  // Carregar conversas ao iniciar
  useEffect(() => {
    loadConversations();
    loadStats();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      loadConversations();
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [activeFilter]);

  // Socket listeners
  useEffect(() => {
    const handleNewMessage = (message) => {
      console.log('📨 Nova mensagem recebida:', message);
      
      // Atualizar mensagens se for da conversa atual
      if (selectedConversation?._id === message.conversationId) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === message._id);
          if (exists) return prev;
          return [...prev, message];
        });
      }
      
      // Atualizar lista de conversas
      setConversations(prev => prev.map(conv => {
        if (conv._id === message.conversationId) {
          return {
            ...conv,
            lastMessage: message,
            unreadCount: conv._id !== selectedConversation?._id 
              ? (conv.unreadCount || 0) + 1 
              : 0,
            updatedAt: new Date()
          };
        }
        return conv;
      }));
      
      // Som de notificação se não for mensagem própria
      if (message.sender?._id !== user?._id && message.sender?._id !== user?.id) {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGO0fPTgjMGHm7A7+OZURE');
        audio.volume = 0.3;
        audio.play().catch(() => {});
        
        toast(`${message.sender?.name}: ${message.content?.substring(0, 50)}`, {
          icon: '💬',
          duration: 4000
        });
      }
      
      // Atualizar atividade
      socketService.updateActivity();
    };
    
    const handleNewConversation = (conversation) => {
      console.log('🆕 Nova conversa na fila:', conversation);
      setConversations(prev => {
        const exists = prev.some(c => c._id === conversation._id);
        if (exists) return prev;
        return [conversation, ...prev];
      });
      setQueueCount(prev => prev + 1);
      
      toast('Nova conversa aguardando atendimento!', {
        icon: '🔔',
        duration: 5000
      });
    };
    
    const handleConversationUpdated = (data) => {
      console.log('🔄 Conversa atualizada:', data);
      setConversations(prev => prev.map(conv => {
        if (conv._id === data.conversationId) {
          return { ...conv, ...data.updates };
        }
        return conv;
      }));
    };
    
    const handleQueueUpdated = () => {
      console.log('🔄 Fila atualizada');
      loadConversations();
    };
    
    const handleForceSync = () => {
      console.log('🔄 Sincronização forçada');
      loadConversations();
      if (selectedConversation?._id) {
        loadMessages(selectedConversation._id);
      }
    };
    
    // Registrar listeners
    window.addEventListener('force-sync', handleForceSync);
    socketService.on('new-message', handleNewMessage);
    socketService.on('new-conversation', handleNewConversation);
    socketService.on('conversation-updated', handleConversationUpdated);
    socketService.on('queue-updated', handleQueueUpdated);
    
    return () => {
      window.removeEventListener('force-sync', handleForceSync);
      socketService.off('new-message', handleNewMessage);
      socketService.off('new-conversation', handleNewConversation);
      socketService.off('conversation-updated', handleConversationUpdated);
      socketService.off('queue-updated', handleQueueUpdated);
    };
  }, [selectedConversation?._id, user?._id]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      let endpoint = '/chat/conversations';
      
      // Aplicar filtro
      if (activeFilter !== 'all') {
        endpoint += `?status=${activeFilter}`;
      }
      
      const { data } = await api.get(endpoint);
      setConversations(data);
      
      // Contar conversas na fila
      const waitingCount = data.filter(c => c.status === 'waiting').length;
      setQueueCount(waitingCount);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const { data } = await api.get(`/chat/conversations/${conversationId}/messages`);
      setMessages(data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar mensagens');
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/chat/agent/stats');
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleSelectConversation = async (conversation) => {
    // Se é uma conversa em espera, aceitar primeiro
    if (conversation.status === 'waiting') {
      try {
        console.log('🔵 Aceitando conversa:', conversation._id);
        // Usar /accept em vez de /assign - agentes podem aceitar
        const { data } = await api.patch(`/chat/conversations/${conversation._id}/accept`);
        conversation = data;
        toast.success('Conversa aceita!');
        console.log('✅ Conversa aceita com sucesso:', data);
      } catch (error) {
        console.error('❌ Erro ao aceitar conversa:', error);
        console.error('❌ Response:', error.response?.data);
        
        if (error.response?.status === 403) {
          toast.error('Você não tem permissão para aceitar conversas');
        } else if (error.response?.status === 404) {
          toast.error('Conversa não encontrada');
        } else {
          toast.error(error.response?.data?.error || 'Erro ao aceitar conversa');
        }
        return;
      }
    }
    
    setSelectedConversation(conversation);
    
    // Limpar contador de não lidas
    setConversations(prev => prev.map(conv => {
      if (conv._id === conversation._id) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    }));
    
    // Entrar na sala da conversa
    if (selectedConversation?._id && selectedConversation._id !== conversation._id) {
      socketService.leaveConversation(selectedConversation._id);
    }
    socketService.joinConversation(conversation._id);
    
    // Carregar mensagens
    await loadMessages(conversation._id);
    
    // Atualizar atividade
    socketService.updateActivity();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    // Prevenir envio se conversa estiver fechada
    if (selectedConversation.status === 'closed') {
      toast.warning('Esta conversa está encerrada. Reabra-a para continuar.');
      return;
    }
    
    try {
      setSendingMessage(true);
      
      // Enviar via socket
      socketService.sendMessage(selectedConversation._id, newMessage, 'text');
      
      // Limpar campo
      setNewMessage('');
      
      // Atualizar atividade
      socketService.updateActivity();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedConversation) return;
    
    // Verificar se já está fechada
    if (selectedConversation.status === 'closed') {
      toast.warning('Esta conversa já está encerrada');
      return;
    }
    
    try {
      await api.patch(`/chat/conversations/${selectedConversation._id}/close`);
      
      toast.success('Conversa encerrada');
      
      // Atualizar conversa selecionada
      setSelectedConversation(prev => ({ ...prev, status: 'closed' }));
      
      // Recarregar conversas
      await loadConversations();
    } catch (error) {
      console.error('Erro ao encerrar conversa:', error);
      if (error.response?.status === 400) {
        toast.error('Esta conversa já está encerrada');
      } else {
        toast.error('Erro ao encerrar conversa');
      }
    }
  };
  
  const handleReopenConversation = async () => {
    if (!selectedConversation) return;
    
    try {
      const { data } = await api.patch(`/chat/conversations/${selectedConversation._id}/reopen`);
      
      toast.success('Conversa reaberta');
      
      // Atualizar conversa selecionada
      setSelectedConversation(prev => ({ ...prev, status: 'active' }));
      
      // Recarregar conversas
      await loadConversations();
    } catch (error) {
      console.error('Erro ao reabrir conversa:', error);
      toast.error('Erro ao reabrir conversa');
    }
  };

  const handleStatusChange = (newStatus) => {
    setAgentStatus(newStatus);
    socketService.setAgentStatus(newStatus === 'online' ? 'available' : 'busy');
    toast.success(`Status alterado para ${newStatus}`);
  };

  const handleFilesUploaded = (files) => {
    // Enviar mensagem com arquivos anexados
    if (files && files.length > 0) {
      // Criar mensagem com todos os arquivos
      const fileNames = files.map(f => f.originalName).join(', ');
      const fileMessage = `📎 ${fileNames}`;
      
      // Enviar mensagem com array de arquivos
      socketService.sendMessage(selectedConversation._id, fileMessage, 'file', files);
    }
    
    setShowFileUpload(false);
    toast.success(`${files.length} arquivo(s) enviado(s) com sucesso!`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting': return <Clock className="h-4 w-4" />;
      case 'active': return <MessageSquare className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Lista de Conversas */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* Header do Agente */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">{user?.name}</h3>
                <p className="text-sm opacity-90">Agente de Suporte</p>
              </div>
            </div>
            <select 
              value={agentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-white/20 border border-white/30 rounded px-2 py-1 text-sm"
            >
              <option value="online" className="text-gray-800">Online</option>
              <option value="busy" className="text-gray-800">Ocupado</option>
              <option value="away" className="text-gray-800">Ausente</option>
            </select>
          </div>
          
          {/* Estatísticas Rápidas */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white/10 rounded p-2">
              <div className="flex items-center justify-between">
                <span className="opacity-75">Fila</span>
                <span className="font-bold">{queueCount}</span>
              </div>
            </div>
            <div className="bg-white/10 rounded p-2">
              <div className="flex items-center justify-between">
                <span className="opacity-75">Resolvidas</span>
                <span className="font-bold">{stats.resolved}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-wrap gap-1">
            {['all', 'waiting', 'active', 'closed'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' ? 'Todas' : 
                 filter === 'waiting' ? 'Aguardando' :
                 filter === 'active' ? 'Ativas' : 'Fechadas'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-gray-500 p-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            conversations.map(conversation => (
              <div
                key={conversation._id}
                onClick={() => handleSelectConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?._id === conversation._id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">
                        {conversation.client?.name || 'Cliente'}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {conversation.client?.email || 'Sem email'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getStatusColor(conversation.status)}`}>
                    {getStatusIcon(conversation.status)}
                    <span>
                      {conversation.status === 'waiting' ? 'Aguardando' :
                       conversation.status === 'active' ? 'Ativa' : 'Fechada'}
                    </span>
                  </div>
                </div>
                
                {conversation.lastMessage && (
                  <p className="text-sm text-gray-600 truncate mb-1">
                    {conversation.lastMessage.content}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {conversation.updatedAt && 
                      formatDistanceToNow(new Date(conversation.updatedAt), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })
                    }
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="bg-red-500 text-white px-2 py-0.5 rounded-full">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header da Conversa */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {selectedConversation.client?.name || 'Cliente'}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {selectedConversation.client?.email && (
                        <span className="flex items-center space-x-1">
                          <Mail className="h-3 w-3" />
                          <span>{selectedConversation.client.email}</span>
                        </span>
                      )}
                      {selectedConversation.client?.phone && (
                        <span className="flex items-center space-x-1">
                          <Phone className="h-3 w-3" />
                          <span>{selectedConversation.client.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {selectedConversation.status !== 'closed' ? (
                    <button
                      onClick={handleCloseConversation}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Encerrar</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleReopenConversation}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Reabrir</span>
                    </button>
                  )}
                  <button className="p-2 hover:bg-gray-100 rounded">
                    <MoreVertical className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {messages.map((message, index) => {
                const isAgentMessage = message.senderType === 'agent';
                const hasFiles = (message.files && message.files.length > 0) || 
                               (message.attachments && message.attachments.length > 0) ||
                               (message.metadata?.files && message.metadata.files.length > 0);
                const files = message.files || message.attachments || message.metadata?.files || [];
                
                return (
                  <div
                    key={message._id || index}
                    className={`mb-4 flex ${
                      isAgentMessage ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div className={`max-w-lg px-4 py-2 rounded-lg ${
                      isAgentMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}>
                      {/* Renderizar arquivos se houver */}
                      {hasFiles && (
                        <div className="space-y-2 mb-2">
                          {files.map((file, idx) => {
                            const fileName = file.originalName || file.name || 'Arquivo';
                            const fileType = file.fileType || file.type || 'file';
                            const fileMimetype = file.mimetype || file.type;
                            // Construir URL completa para o arquivo
                            const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
                            const fileUrl = file.url?.startsWith('http') 
                              ? file.url 
                              : `${baseUrl}${file.url}`;
                            
                            if (fileType === 'image' || fileMimetype?.startsWith('image/')) {
                              return (
                                <div key={idx} className="block">
                                  <img 
                                    src={fileUrl} 
                                    alt={fileName}
                                    className="max-w-full rounded cursor-pointer hover:opacity-90"
                                    style={{ maxHeight: '200px' }}
                                    onClick={() => window.open(fileUrl, '_blank')}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div 
                                    className="hidden items-center space-x-2 p-2 bg-white/10 rounded cursor-pointer"
                                    onClick={() => window.open(fileUrl, '_blank')}
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span className="text-xs">{fileName}</span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <a
                                  key={idx}
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center space-x-2 p-2 rounded transition-colors ${
                                    isAgentMessage 
                                      ? 'bg-white/20 hover:bg-white/30' 
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  }`}
                                >
                                  <FileIcon className="w-4 h-4 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">
                                      {fileName}
                                    </p>
                                    {file.size && (
                                      <p className="text-xs opacity-75">
                                        {(file.size / 1024).toFixed(1)} KB
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-xs opacity-75">Baixar</span>
                                </a>
                              );
                            }
                          })}
                        </div>
                      )}
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        isAgentMessage ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {format(new Date(message.createdAt), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal de Upload de Arquivos */}
            {showFileUpload && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Enviar Arquivos</h3>
                    <button
                      onClick={() => setShowFileUpload(false)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <FileUpload
                    conversationId={selectedConversation._id}
                    onFilesUploaded={handleFilesUploaded}
                    maxFiles={5}
                  />
                </div>
              </div>
            )}

            {/* Input de Mensagem */}
            {selectedConversation.status !== 'closed' ? (
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setShowFileUpload(true)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Anexar arquivo"
                  >
                    <Paperclip className="h-5 w-5 text-gray-600" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-t border-gray-200 p-4">
                <p className="text-center text-gray-500">
                  Esta conversa foi encerrada. Clique em "Reabrir" para continuar o atendimento.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-gray-500">
                {queueCount > 0 
                  ? `Você tem ${queueCount} conversas aguardando atendimento`
                  : 'Nenhuma conversa pendente no momento'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentChatContainer;
