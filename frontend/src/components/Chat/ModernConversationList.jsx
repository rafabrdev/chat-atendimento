import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  MessageCircle, 
  Clock, 
  XCircle,
  Filter,
  ChevronDown,
  User,
  Sparkles
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';

const ModernConversationList = ({ 
  conversations, 
  selectedConversation, 
  onSelectConversation, 
  onCreateConversation,
  loading,
  isOpen,
  onClose 
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filtrar conversas
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = 
      conv.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.contactId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv._id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Agrupar conversas por data
  const groupConversationsByDate = (convs) => {
    const groups = {
      today: [],
      yesterday: [],
      older: []
    };

    convs.forEach(conv => {
      const date = new Date(conv.lastActivity || conv.createdAt);
      if (isToday(date)) {
        groups.today.push(conv);
      } else if (isYesterday(date)) {
        groups.yesterday.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  };

  const groupedConversations = groupConversationsByDate(filteredConversations);

  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      if (isToday(d)) {
        return format(d, 'HH:mm', { locale: ptBR });
      } else if (isYesterday(d)) {
        return 'Ontem';
      } else {
        return format(d, 'dd/MM', { locale: ptBR });
      }
    } catch {
      return '';
    }
  };

  const formatLastMessage = (message) => {
    if (!message) return 'Clique para iniciar a conversa';
    
    const maxLength = 60;
    const content = message.content || '';
    
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '...';
    }
    
    return content;
  };

  const ConversationItem = ({ conversation }) => {
    const isSelected = selectedConversation?._id === conversation._id;
    const hasUnread = conversation.unreadCount > 0;
    const isClient = user?.role === 'client';
    
    // Determinar o nome a ser exibido
    let displayName = '';
    if (isClient) {
      // Para clientes, mostrar o nome do agente ou status
      if (conversation.assignedAgent?.name) {
        displayName = conversation.assignedAgent.name;
      } else if (conversation.status === 'waiting') {
        displayName = 'Aguardando Atendimento';
      } else if (conversation.status === 'closed') {
        displayName = 'Conversa Encerrada';
      } else {
        displayName = 'Suporte';
      }
    } else {
      // Para agentes, mostrar o nome do cliente
      displayName = conversation.client?.name || 'Cliente';
    }
    
    return (
      <button
        onClick={() => onSelectConversation(conversation)}
        className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 transition-all rounded-lg ${
          isSelected ? 'bg-primary-50 hover:bg-primary-50' : ''
        }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isSelected 
              ? 'bg-gradient-to-br from-primary-400 to-primary-600' 
              : 'bg-gradient-to-br from-gray-300 to-gray-400'
          }`}>
            <User className="w-5 h-5 text-white" />
          </div>
          {conversation.status === 'active' && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-medium truncate ${
              isSelected ? 'text-primary-700' : 'text-gray-900'
            }`}>
              {displayName}
            </h4>
            <span className={`text-xs flex-shrink-0 ml-2 ${
              hasUnread ? 'text-primary-600 font-semibold' : 'text-gray-400'
            }`}>
              {formatTime(conversation.lastActivity)}
            </span>
          </div>
          
          <p className={`text-sm truncate ${
            hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'
          }`}>
            {formatLastMessage(conversation.lastMessage)}
          </p>

          {/* Tags e status */}
          <div className="flex items-center gap-2 mt-2">
            {conversation.status === 'waiting' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                <Clock className="w-3 h-3" />
                Aguardando
              </span>
            )}
            {conversation.status === 'active' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                <MessageCircle className="w-3 h-3" />
                Em atendimento
              </span>
            )}
            {conversation.status === 'closed' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                <XCircle className="w-3 h-3" />
                Encerrada
              </span>
            )}
            {hasUnread && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-xs bg-primary-600 text-white font-semibold">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const ConversationGroup = ({ title, conversations }) => {
    if (conversations.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
          {title}
        </h3>
        <div className="space-y-1">
          {conversations.map(conv => (
            <ConversationItem key={conv._id} conversation={conv} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`w-80 bg-white border-r border-gray-200 flex flex-col h-full ${
      isOpen ? 'block' : 'hidden lg:block'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Conversas</h2>
          </div>
          <button
            onClick={onCreateConversation}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            title="Nova conversa"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filtros */}
        <div className="mt-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtros
            <ChevronDown className={`w-3 h-3 transition-transform ${
              showFilters ? 'rotate-180' : ''
            }`} />
          </button>
          
          {showFilters && (
            <div className="flex flex-wrap gap-2 mt-3 relative z-20">
              {['all', 'waiting', 'active', 'closed'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' && 'Todas'}
                  {status === 'waiting' && 'Aguardando'}
                  {status === 'active' && 'Ativas'}
                  {status === 'closed' && 'Encerradas'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma conversa encontrada</p>
            <button
              onClick={onCreateConversation}
              className="mt-4 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Iniciar nova conversa
            </button>
          </div>
        ) : (
          <>
            <ConversationGroup title="Hoje" conversations={groupedConversations.today} />
            <ConversationGroup title="Ontem" conversations={groupedConversations.yesterday} />
            <ConversationGroup title="Anteriores" conversations={groupedConversations.older} />
          </>
        )}
      </div>
    </div>
  );
};

export default ModernConversationList;
