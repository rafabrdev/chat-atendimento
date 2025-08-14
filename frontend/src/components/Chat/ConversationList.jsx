import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ConversationList = ({ 
  conversations, 
  selectedConversation, 
  onSelectConversation, 
  onCreateConversation,
  loading 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filtrar conversas
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = 
      conv.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.contactId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv._id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'active':
        return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'closed':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'waiting':
        return 'Aguardando';
      case 'active':
        return 'Ativo';
      case 'closed':
        return 'Encerrado';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastMessage = (message) => {
    if (!message) return 'Sem mensagens';
    
    const maxLength = 50;
    const content = message.content || '';
    
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '...';
    }
    
    return content;
  };

  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      return format(new Date(date), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Conversas</h2>
          <button
            onClick={onCreateConversation}
            className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            title="Nova conversa"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              statusFilter === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setStatusFilter('waiting')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              statusFilter === 'waiting'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Aguardando
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              statusFilter === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Ativas
          </button>
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation._id}
              onClick={() => onSelectConversation(conversation)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                selectedConversation?._id === conversation._id ? 'bg-primary-50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {conversation.client?.name || conversation.contactId?.name || 'Cliente'}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusIcon(conversation.status)}
                      <span className="text-xs text-gray-500">
                        {getStatusLabel(conversation.status)}
                      </span>
                      {conversation.priority && conversation.priority !== 'normal' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(conversation.priority)}`}>
                          {conversation.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(conversation.lastActivity)}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 truncate">
                {formatLastMessage(conversation.lastMessage)}
              </div>

              {conversation.assignedAgent && (
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <span>Atendente: {conversation.assignedAgent.name}</span>
                  <span className={`ml-2 w-2 h-2 rounded-full ${
                    conversation.assignedAgent.status === 'online' ? 'bg-green-400' :
                    conversation.assignedAgent.status === 'busy' ? 'bg-yellow-400' :
                    'bg-gray-400'
                  }`}></span>
                </div>
              )}

              {conversation.messageCount > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  {conversation.messageCount} mensagens
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;
