import React, { useState, useEffect } from 'react';
import ModernConversationList from './ModernConversationList';
import ModernChatWindow from './ModernChatWindow';
import AgentDashboard from './AgentDashboard';
import RatingModal from './RatingModal';
import ConfirmModal from './ConfirmModal';
import { socketService } from '../../lib/socket';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';

const ChatContainer = () => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const socket = useSocket(token, user); // Inicializar socket
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAgentDashboard, setShowAgentDashboard] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [conversationToRate, setConversationToRate] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [conversationToClose, setConversationToClose] = useState(null);
  
  // Detectar se é agente
  const isAgent = user?.role === 'agent' || user?.role === 'admin';

  // Carregar conversas
  useEffect(() => {
    loadConversations();
  }, []);

  // Configurar listeners do socket
  useEffect(() => {
    const handleNewMessage = (message) => {
      console.log('📩 New message received:', message);
      
      // Atualizar mensagens se for da conversa atual
      if (selectedConversation?._id === message.conversationId) {
        setMessages(prev => {
          // Verificar se a mensagem já existe para evitar duplicatas
          const exists = prev.some(m => m._id === message._id);
          if (exists) return prev;
          
          // Remover mensagem otimista se for do mesmo remetente
          const filtered = prev.filter(m => {
            // Remover mensagem otimista se for do mesmo usuário e tem conteúdo similar
            if (m.isOptimistic && 
                message.sender?._id === (user._id || user.id) &&
                m.content === message.content) {
              return false;
            }
            return true;
          });
          
          return [...filtered, message];
        });
      }
      
      // Atualizar última mensagem e status na lista de conversas
      setConversations(prev => prev.map(conv => {
        if (conv._id === message.conversationId) {
          // Se a conversa estava waiting e recebeu mensagem de um agente, mudar para active
          const updatedConv = { 
            ...conv, 
            lastMessage: message,
            lastActivity: new Date()
          };
          
          // Se era uma conversa em espera e agora tem agente, atualizar status
          if (conv.status === 'waiting' && message.senderType === 'agent') {
            updatedConv.status = 'active';
          }
          
          return updatedConv;
        }
        return conv;
      }));
      
      // Notificar usuário se não for mensagem própria
      if (message.sender?._id !== user?._id && message.sender?._id !== user?.id) {
        // Som de notificação (opcional)
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGO0fPTgjMGHm7A7+OZURE');
        audio.volume = 0.3;
        audio.play().catch(() => {});
        
      // Toast notification
      toast(message.content?.substring(0, 50) || 'Nova mensagem', {
        icon: '💬',
        duration: 3000
      });
    }
    
    // Atualizar atividade do socket
    socketService.updateActivity();
  };

    const handleUserStatusChanged = ({ userId, status }) => {
      setConversations(prev => prev.map(conv => {
        if (conv.assignedAgent?._id === userId) {
          return {
            ...conv,
            assignedAgent: { ...conv.assignedAgent, status }
          };
        }
        return conv;
      }));
    };

    const handleQueueUpdated = () => {
      console.log('🔄 Queue updated - reloading conversations');
      loadConversations();
    };
    
    const handleConversationAccepted = (data) => {
      console.log('✅ Conversation accepted:', data);
      // Atualizar a conversa específica na lista
      setConversations(prev => prev.map(conv => {
        if (conv._id === data.conversationId) {
          return {
            ...conv,
            status: 'active',
            assignedAgent: {
              _id: data.agentId,
              name: data.agentName
            }
          };
        }
        return conv;
      }));
      
      // Se for a conversa atual, atualizar também
      if (selectedConversation?._id === data.conversationId) {
        setSelectedConversation(prev => ({
          ...prev,
          status: 'active',
          assignedAgent: {
            _id: data.agentId,
            name: data.agentName
          }
        }));
      }
      
      // Toast notification
      toast.success(`Agente ${data.agentName} aceitou o atendimento`, {
        icon: '👤',
        duration: 4000
      });
    };
    
    // Listener para quando uma conversa é atribuída a um agente
    const handleConversationAssigned = (data) => {
      console.log('📋 Conversation assigned:', data);
      // Atualizar a conversa na lista
      setConversations(prev => prev.map(conv => {
        if (conv._id === data.conversationId) {
          return {
            ...conv,
            status: 'active',
            assignedAgent: data.agent
          };
        }
        return conv;
      }));
      
      // Se for a conversa atual, atualizar também
      if (selectedConversation?._id === data.conversationId) {
        setSelectedConversation(prev => ({
          ...prev,
          status: 'active',
          assignedAgent: data.agent
        }));
      }
    };
    
    const handleConversationStatusChanged = (data) => {
      console.log('🔄 Conversation status changed:', data);
      // Atualizar o status da conversa na lista
      setConversations(prev => prev.map(conv => {
        if (conv._id === data.conversationId) {
          return {
            ...conv,
            status: data.status,
            assignedAgent: data.assignedAgent
          };
        }
        return conv;
      }));
      
      // Se for a conversa atual, atualizar também
      if (selectedConversation?._id === data.conversationId) {
        setSelectedConversation(prev => ({
          ...prev,
          status: data.status,
          assignedAgent: data.assignedAgent
        }));
      }
    };
    
    const handleConversationClosed = (data) => {
      console.log('🔒 Conversation closed:', data);
      // Atualizar o status da conversa para fechada
      setConversations(prev => prev.map(conv => {
        if (conv._id === data.conversationId) {
          return { ...conv, status: 'closed' };
        }
        return conv;
      }));
      
      // Se for a conversa atual
      if (selectedConversation?._id === data.conversationId) {
        // Se for cliente, mostrar modal de avaliação obrigatório
        if (!isAgent) {
          // Verificar se já foi avaliada
          const conversation = conversations.find(c => c._id === data.conversationId);
          if (!conversation?.rating) {
            setConversationToRate(data.conversationId);
            setShowRatingModal(true);
            toast.info('Por favor, avalie o atendimento');
          } else {
            toast.info('Conversa foi encerrada');
          }
        } else {
          toast.info('Conversa foi encerrada');
        }
        
        setSelectedConversation(null);
        setMessages([]);
      }
    };

    // Listener para atualização de conversa (para quem não está na conversa)
    const handleConversationUpdated = (data) => {
      console.log('🔄 Conversation updated:', data);
      // Atualizar conversa na lista mesmo se não estiver nela
      setConversations(prev => prev.map(conv => {
        if (conv._id === data.conversationId) {
          return {
            ...conv,
            lastMessage: data.lastMessage,
            lastActivity: new Date()
          };
        }
        return conv;
      }));
    };

    // Listener para sincronização forçada
    const handleForceSync = () => {
      console.log('🔄 Forcing data sync...');
      loadConversations();
      if (selectedConversation?._id) {
        loadMessages(selectedConversation._id);
      }
    };
    
    window.addEventListener('force-sync', handleForceSync);
    socketService.on('new-message', handleNewMessage);
    socketService.on('conversation-updated', handleConversationUpdated);
    socketService.on('user-status-changed', handleUserStatusChanged);
    socketService.on('queue-updated', handleQueueUpdated);
    socketService.on('conversation-accepted', handleConversationAccepted);
    socketService.on('conversation-assigned', handleConversationAssigned);
    socketService.on('conversation-status-changed', handleConversationStatusChanged);
    socketService.on('conversation-closed', handleConversationClosed);

    return () => {
      window.removeEventListener('force-sync', handleForceSync);
      socketService.off('new-message', handleNewMessage);
      socketService.off('conversation-updated', handleConversationUpdated);
      socketService.off('user-status-changed', handleUserStatusChanged);
      socketService.off('queue-updated', handleQueueUpdated);
      socketService.off('conversation-accepted', handleConversationAccepted);
      socketService.off('conversation-assigned', handleConversationAssigned);
      socketService.off('conversation-status-changed', handleConversationStatusChanged);
      socketService.off('conversation-closed', handleConversationClosed);
    };
  }, [selectedConversation?._id, user?._id, user?.id]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/chat/conversations');
      setConversations(data);
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

  const handleSelectConversation = async (conversation) => {
    // Se for agente/admin e a conversa está em espera, aceitar automaticamente
    if (isAgent && conversation.status === 'waiting') {
      try {
        console.log('🔵 Agente aceitando conversa em espera:', conversation._id);
        console.log('🔵 User role:', user?.role);
        console.log('🔵 Conversation status:', conversation.status);
        
        const { data } = await api.patch(`/chat/conversations/${conversation._id}/accept`);
        
        console.log('✅ Conversa aceita, resposta:', data);
        
        // Atualizar a conversa com os dados retornados
        conversation = data;
        
        // Atualizar na lista de conversas
        setConversations(prev => prev.map(conv => {
          if (conv._id === conversation._id) {
            return data;
          }
          return conv;
        }));
        
        toast.success('Conversa aceita com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao aceitar conversa:', error);
        console.error('❌ Response data:', error.response?.data);
        console.error('❌ Response status:', error.response?.status);
        console.error('❌ Response headers:', error.response?.headers);
        
        if (error.response?.status === 401) {
          toast.error('Erro de autenticação. Faça login novamente.');
        } else if (error.response?.status === 403) {
          toast.error('Você não tem permissão para aceitar esta conversa');
        } else if (error.response?.status === 404) {
          toast.error('Conversa não encontrada');
        } else {
          toast.error(error.response?.data?.error || 'Erro ao aceitar conversa');
        }
        return; // Não continuar se falhar
      }
    }
    
    setSelectedConversation(conversation);
    
    // Atualizar atividade ao selecionar conversa
    socketService.updateActivity();
    
    // Sair da conversa anterior
    if (selectedConversation) {
      socketService.leaveConversation(selectedConversation._id);
    }
    
    // Entrar na nova conversa
    socketService.joinConversation(conversation._id);
    
    // Carregar mensagens
    await loadMessages(conversation._id);
  };

  const handleSendMessage = async (content, type = 'text') => {
    if (!content.trim()) return;
    
    try {
      setSendingMessage(true);
      
      // Se cliente não tem conversa selecionada, criar uma nova
      if (!isAgent && !selectedConversation) {
        const { data: newConversation } = await api.post('/chat/conversations', {
          priority: 'normal',
          tags: ['novo'],
          initialMessage: content // Enviar primeira mensagem junto
        });
        
        // Atualizar lista de conversas
        setConversations(prev => [newConversation, ...prev]);
        setSelectedConversation(newConversation);
        
        // Entrar na nova conversa via socket
        socketService.joinConversation(newConversation._id);
        
        // A mensagem inicial já foi criada no backend
        // Carregar as mensagens da nova conversa
        await loadMessages(newConversation._id);
        
        toast.success('Conversa iniciada!');
        setTimeout(() => setSendingMessage(false), 500);
        return;
      }
      
      // Se já tem conversa selecionada
      if (!selectedConversation) {
        toast.error('Selecione uma conversa primeiro');
        setSendingMessage(false);
        return;
      }
      
      // Verificar e reconectar socket se necessário
      if (!socketService.socket) {
        console.log('Socket não inicializado, conectando...');
        const token = localStorage.getItem('token');
        socketService.connect(token);
        // Aguardar um momento para a conexão
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Verificar se socket está conectado
      if (!socketService.socket?.connected) {
        console.error('Socket não conectado! Tentando reconectar...');
        const token = localStorage.getItem('token');
        socketService.connect(token);
        
        // Aguardar reconexão
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar novamente
        if (!socketService.socket?.connected) {
          toast.error('Erro de conexão. Tente novamente.');
          setSendingMessage(false);
          return;
        }
      }
      
      console.log('Enviando mensagem:', { conversationId: selectedConversation._id, content, type });
      
      // Atualizar atividade ao enviar mensagem
      socketService.updateActivity();
      
      // Enviar mensagem via socket
      const sent = socketService.sendMessage(selectedConversation._id, content, type);
      
      if (!sent) {
        console.error('Failed to send message - socket not connected');
        toast.error('Erro de conexão. Tentando reconectar...');
        
        // Tentar reconectar
        const token = localStorage.getItem('token');
        socketService.connect(token);
        
        // Tentar enviar novamente após reconexão
        setTimeout(() => {
          socketService.joinConversation(selectedConversation._id);
          socketService.sendMessage(selectedConversation._id, content, type);
        }, 1000);
        
        setSendingMessage(false);
        return;
      }
      
      // Adicionar mensagem otimista localmente (será substituída pela mensagem real do servidor)
      const optimisticMessage = {
        _id: `temp-${Date.now()}`,
        conversationId: selectedConversation._id,
        sender: { _id: user._id || user.id, name: user.name },
        senderType: (user?.role === 'agent' || user?.role === 'admin') ? 'agent' : 'client',
        content,
        type,
        createdAt: new Date().toISOString(),
        isOptimistic: true
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Atualizar conversa na lista
      setConversations(prev => prev.map(conv => {
        if (conv._id === selectedConversation._id) {
          return {
            ...conv,
            lastMessage: optimisticMessage,
            lastActivity: new Date()
          };
        }
        return conv;
      }));
      
      setTimeout(() => setSendingMessage(false), 500);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
      setSendingMessage(false);
    }
  };

  const handleCreateConversation = async () => {
    try {
      // Para clientes, criar conversa em status waiting
      const conversationData = {
        priority: 'normal',
        tags: ['novo']
      };
      
      const { data } = await api.post('/chat/conversations', conversationData);
      
      // Adicionar a nova conversa à lista
      setConversations(prev => [data, ...prev]);
      setSelectedConversation(data);
      
      // Entrar na conversa via socket
      socketService.joinConversation(data._id);
      
      // Carregar mensagens (provavelmente vazia)
      setMessages([]);
      
      toast.success('Nova conversa iniciada! Digite sua mensagem.');
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      toast.error('Erro ao criar conversa');
    }
  };

  const handleConfirmCloseConversation = async (conversationId) => {
    try {
      // Verificar se a conversa já está fechada
      const conversation = conversations.find(c => c._id === conversationId);
      if (conversation?.status === 'closed') {
        toast.warning('Esta conversa já está encerrada');
        return;
      }
      
      await api.patch(`/chat/conversations/${conversationId}/close`);
      await loadConversations();
      
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(prev => ({ ...prev, status: 'closed' }));
      }
      
      toast.success('Conversa encerrada');
      
      // Mostrar modal de avaliação para cliente
      setConversationToRate(conversationId);
      setShowRatingModal(true);
    } catch (error) {
      console.error('Erro ao fechar conversa:', error);
      if (error.response?.status === 400) {
        toast.error('Esta conversa já está encerrada');
      } else {
        toast.error('Erro ao fechar conversa');
      }
    }
  };

  const handleCloseConversation = async (conversationId) => {
    // Se for cliente, mostrar modal de confirmação
    if (!isAgent) {
      setConversationToClose(conversationId);
      setShowConfirmModal(true);
      return;
    }
    
    try {
      // Verificar se a conversa já está fechada
      const conversation = conversations.find(c => c._id === conversationId);
      if (conversation?.status === 'closed') {
        toast.warning('Esta conversa já está encerrada');
        return;
      }
      
      await api.patch(`/chat/conversations/${conversationId}/close`);
      await loadConversations();
      
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(prev => ({ ...prev, status: 'closed' }));
      }
      
      toast.success('Conversa encerrada');
      
      // Se for cliente, mostrar modal de avaliação
      if (!isAgent) {
        setConversationToRate(conversationId);
        setShowRatingModal(true);
      }
    } catch (error) {
      console.error('Erro ao fechar conversa:', error);
      if (error.response?.status === 400) {
        toast.error('Esta conversa já está encerrada');
      } else {
        toast.error('Erro ao fechar conversa');
      }
    }
  };
  
  const handleReopenConversation = async (conversationId) => {
    try {
      const { data } = await api.patch(`/chat/conversations/${conversationId}/reopen`);
      
      // Atualizar lista de conversas
      setConversations(prev => prev.map(conv => {
        if (conv._id === conversationId) {
          return { ...conv, status: 'active' };
        }
        return conv;
      }));
      
      // Atualizar conversa selecionada se for a mesma
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(prev => ({ ...prev, status: 'active' }));
      }
      
      toast.success('Conversa reaberta');
    } catch (error) {
      console.error('Erro ao reabrir conversa:', error);
      toast.error('Erro ao reabrir conversa');
    }
  };

  const handleAcceptConversation = async (conversation) => {
    setShowAgentDashboard(false);
    await handleSelectConversation(conversation);
  };

  // Interface para AGENTES
  if (isAgent) {
    // Se o agente ainda não aceitou uma conversa, mostrar dashboard
    if (showAgentDashboard && !selectedConversation) {
      return (
        <AgentDashboard 
          onAcceptConversation={handleAcceptConversation}
        />
      );
    }
    
    // Se o agente aceitou uma conversa, mostrar chat
    return (
      <div className="flex h-screen">
        <ModernConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={() => {
            setShowAgentDashboard(true);
            setSelectedConversation(null);
          }}
          loading={loading}
          isOpen={showSidebar}
          onClose={() => setShowSidebar(false)}
        />
        
        <ModernChatWindow
          conversation={selectedConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onCloseConversation={handleCloseConversation}
          onReopenConversation={isAgent ? handleReopenConversation : null}
          onNewConversation={() => {
            setShowAgentDashboard(true);
            setSelectedConversation(null);
          }}
          sendingMessage={sendingMessage}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          isAgent={isAgent}
        />
      </div>
    );
  }

  // Interface para CLIENTES
  return (
    <>
      <div className="flex h-screen">
        {/* Sempre mostrar sidebar para clientes poderem criar nova conversa */}
        <ModernConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={null} // Cliente NÃO cria conversa vazia; inicia ao enviar a primeira mensagem
          loading={loading}
          isOpen={showSidebar}
          onClose={() => setShowSidebar(false)}
        />
        
        <ModernChatWindow
          conversation={selectedConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onCloseConversation={handleCloseConversation} // Cliente também pode encerrar
          onNewConversation={null} // Cliente não tem botão de nova conversa
          sendingMessage={sendingMessage}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          showWelcomeMessage={!selectedConversation && conversations.length === 0}
          isClient={!isAgent}
        />
      </div>
      
      {/* Modal de Confirmação */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setConversationToClose(null);
        }}
        onConfirm={async () => {
          if (conversationToClose) {
            await handleConfirmCloseConversation(conversationToClose);
          }
        }}
        title="Encerrar Conversa"
        message="Tem certeza que deseja encerrar esta conversa? Após encerrar, você poderá avaliar o atendimento."
        confirmText="Encerrar"
        cancelText="Cancelar"
        type="warning"
      />
      
      {/* Modal de Avaliação */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          setConversationToRate(null);
        }}
        conversationId={conversationToRate}
        onRatingSubmitted={(data) => {
          console.log('Avaliação enviada:', data);
          // Atualizar a conversa com a avaliação
          setConversations(prev => prev.map(conv => {
            if (conv._id === conversationToRate) {
              return { ...conv, rating: data.rating };
            }
            return conv;
          }));
        }}
      />
    </>
  );
};

export default ChatContainer;
