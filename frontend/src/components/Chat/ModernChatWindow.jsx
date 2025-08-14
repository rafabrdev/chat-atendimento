import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Plus,
  Menu,
  X,
  Sparkles,
  User,
  Bot,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { socketService } from '../../lib/socket';

const ModernChatWindow = ({ 
  conversation, 
  messages, 
  onSendMessage, 
  onCloseConversation,
  onReopenConversation,
  onNewConversation,
  sendingMessage,
  onToggleSidebar,
  showWelcomeMessage = false,
  isClient = false,
  isAgent = false
}) => {
  const { user } = useAuth();
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Detectar scroll para mostrar botão
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTyping = (value) => {
    setMessageInput(value);
    
    if (!conversation) return;

    // Notificar que está digitando
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      socketService.startTyping(conversation._id);
    }

    // Limpar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Parar de digitar após 1 segundo sem digitar
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socketService.stopTyping(conversation._id);
      }
    }, 1000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!messageInput.trim() || sendingMessage) return;

    onSendMessage(messageInput);
    setMessageInput('');
    
    // Parar indicador de digitação
    if (isTyping) {
      setIsTyping(false);
      socketService.stopTyping(conversation._id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const formatMessageTime = (date) => {
    if (!date) return '';
    
    try {
      return format(new Date(date), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  // Se não houver conversa selecionada - Tela inicial
  if (!conversation && !isClient) {
    // Interface para agentes/admin
    return (
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-gray-800">Chat Atendimento</span>
          </div>
          
          <button
            onClick={onNewConversation}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full text-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl shadow-lg">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              
              <h1 className="text-4xl font-bold text-gray-900">
                Como posso ajudar você hoje?
              </h1>
              
              <p className="text-lg text-gray-600">
                Inicie uma nova conversa ou selecione uma existente para continuar
              </p>
            </div>

            {/* Sugestões */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              {[
                { icon: '💬', title: 'Iniciar conversa', desc: 'Comece um novo atendimento' },
                { icon: '📋', title: 'Ver histórico', desc: 'Acesse conversas anteriores' },
                { icon: '❓', title: 'Tirar dúvidas', desc: 'Pergunte o que precisar' },
                { icon: '🚀', title: 'Suporte rápido', desc: 'Atendimento em tempo real' },
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={onNewConversation}
                  className="p-6 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all hover:shadow-md text-left group"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* CTA Button */}
            <button
              onClick={onNewConversation}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Nova Conversa
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 text-center text-xs text-gray-500 border-t border-gray-100">
          Sistema de atendimento em tempo real • Versão 2.0
        </div>
      </div>
    );
  }

  // Interface para cliente sem conversa - Chat direto
  if (!conversation && isClient) {
    return (
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-gray-800">Atendimento Online</span>
          </div>
        </div>

        {/* Área de boas-vindas */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white relative">
          <div className="max-w-4xl w-full px-4">
            <div className="text-center mb-24">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl shadow-lg mb-6">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo ao Atendimento!</h1>
              <p className="text-lg text-gray-600 mb-8">Como posso ajudá-lo hoje?</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8">
                <div className="p-4 bg-blue-50 rounded-lg text-left">
                  <span className="text-2xl mb-2 block">🚀</span>
                  <p className="text-sm text-gray-700">Atendimento rápido</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-left">
                  <span className="text-2xl mb-2 block">✅</span>
                  <p className="text-sm text-gray-700">Respostas instantâneas</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-500">
                Digite sua mensagem abaixo para iniciar o atendimento
              </p>
            </div>
            
            {/* Input de mensagem centralizado */}
            <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem para iniciar o atendimento..."
                  rows="1"
                  className="w-full px-6 py-4 pr-14 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-lg bg-white"
                  style={{ minHeight: '56px', maxHeight: '120px' }}
                  disabled={sendingMessage}
                  autoFocus
                />
                
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendingMessage}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${
                    messageInput.trim() && !sendingMessage
                      ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-3 text-center">
                Pressione Enter para enviar sua mensagem e iniciar o atendimento
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Com conversa selecionada
  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header da conversa */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 text-sm">
              {/* Mostrar nome correto baseado no papel do usuário */}
              {user?.role === 'client' || user?.role === undefined
                ? (conversation.assignedAgent?.name || 'Aguardando atendente')
                : (conversation.client?.name || 'Cliente')}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                {conversation.status === 'active' ? '🟢 Ativo' : 
                 conversation.status === 'waiting' ? '⏳ Aguardando' : 
                 '⚫ Encerrado'}
              </span>
              {conversation.status === 'active' && conversation.assignedAgent && (
                <>
                  <span>•</span>
                  <span>
                    {user?.role === 'client' 
                      ? `Atendente: ${conversation.assignedAgent.name}`
                      : `Cliente: ${conversation.client?.name || 'Anônimo'}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Nova conversa"
            >
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
          )}
          
          {/* Botões de encerrar/reabrir conversa */}
          {conversation.status !== 'closed' && onCloseConversation && (
            <button 
              onClick={() => onCloseConversation(conversation._id)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
              title="Encerrar conversa"
            >
              <X className="w-4 h-4" />
              <span>Encerrar</span>
            </button>
          )}
          
          {/* Botão de reabrir - apenas para agentes em conversas fechadas */}
          {conversation.status === 'closed' && isAgent && onReopenConversation && (
            <button 
              onClick={() => onReopenConversation(conversation._id)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
              title="Reabrir conversa"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reabrir</span>
            </button>
          )}
        </div>
      </div>

      {/* Área de mensagens */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white"
      >
        <div className="max-w-4xl mx-auto px-4 py-8">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">Inicie a conversa enviando uma mensagem</p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => {
                const isOwnMessage = message.sender?._id === (user?._id || user?.id);
                const isSystem = message.senderType === 'system';

                return (
                  <div
                    key={message._id}
                    className={`flex gap-3 animate-fade-in ${
                      isOwnMessage ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {/* Avatar */}
                    {!isOwnMessage && (
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isSystem 
                            ? 'bg-gradient-to-br from-purple-400 to-purple-600' 
                            : 'bg-gradient-to-br from-gray-400 to-gray-600'
                        }`}>
                          {isSystem ? (
                            <Bot className="w-4 h-4 text-white" />
                          ) : (
                            <User className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Message Content */}
                    <div className={`flex-1 ${isOwnMessage ? 'flex justify-end' : ''}`}>
                      <div className={`inline-block max-w-[70%] ${
                        isOwnMessage ? 'text-right' : ''
                      }`}>
                        {!isOwnMessage && message.sender && (
                          <p className="text-xs text-gray-600 mb-1 font-medium">
                            {message.sender.name}
                          </p>
                        )}
                        
                        <div className={`rounded-2xl px-4 py-2 ${
                          isSystem
                            ? 'bg-purple-50 text-purple-900 border border-purple-200'
                            : isOwnMessage
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                        
                        <p className={`text-xs text-gray-400 mt-1 ${
                          isOwnMessage ? 'text-right' : ''
                        }`}>
                          {formatMessageTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-24 right-8 p-3 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <ArrowDown className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {/* Input de mensagem */}
      {conversation.status !== 'closed' ? (
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  rows="1"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  disabled={sendingMessage}
                />
                
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendingMessage}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg transition-all ${
                    messageInput.trim() && !sendingMessage
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2 text-center">
              Pressione Enter para enviar • Shift + Enter para nova linha
            </p>
          </form>
        </div>
      ) : (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <p className="text-center text-gray-500">
            Esta conversa foi encerrada
          </p>
        </div>
      )}
    </div>
  );
};

export default ModernChatWindow;
