import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  X,
  Info,
  Clock,
  User,
  Bot,
  File as FileIcon,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { socketService } from '../../lib/socket';
import FileUpload from './FileUpload';
import toast from 'react-hot-toast';

const ChatWindow = ({ 
  conversation, 
  messages, 
  onSendMessage, 
  onCloseConversation,
  sendingMessage 
}) => {
  const { user } = useAuth();
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Configurar listeners de typing
  useEffect(() => {
    if (!conversation) return;

    const handleUserTyping = ({ userId, isTyping }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    };

    socketService.on('user-typing', handleUserTyping);

    return () => {
      socketService.off('user-typing', handleUserTyping);
    };
  }, [conversation]);

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

  const handleFilesUploaded = (files) => {
    // Enviar mensagem com arquivos anexados
    files.forEach(file => {
      // Criar mensagem especial para arquivos
      const fileMessage = {
        content: `📎 ${file.originalName}`,
        type: file.fileType || 'file',
        files: [{
          _id: file._id,
          originalName: file.originalName,
          url: file.url,
          fileType: file.fileType,
          size: file.size,
          mimetype: file.mimetype
        }]
      };
      
      // Enviar mensagem com arquivo
      if (onSendMessage.length > 1) {
        onSendMessage(fileMessage.content, fileMessage);
      } else {
        // Para compatibilidade se onSendMessage só aceita um parâmetro
        onSendMessage(fileMessage.content);
      }
    });
    
    setShowFileUpload(false);
    toast.success(`${files.length} arquivo(s) enviado(s) com sucesso!`);
  };

  const formatMessageTime = (date) => {
    if (!date) return '';
    
    try {
      return format(new Date(date), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    
    try {
      return format(new Date(date), "dd 'de' MMMM", { locale: ptBR });
    } catch {
      return '';
    }
  };

  const renderMessageSender = (message) => {
    if (message.senderType === 'system') {
      return (
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <Bot className="w-3 h-3" />
          <span>Sistema</span>
        </div>
      );
    }
    
    if (message.sender) {
      return (
        <div className="flex items-center space-x-1 text-xs text-gray-600">
          <User className="w-3 h-3" />
          <span>{message.sender.name}</span>
        </div>
      );
    }
    
    return null;
  };

  // Se não houver conversa selecionada
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Selecione uma conversa
          </h3>
          <p className="text-gray-500">
            Escolha uma conversa na lista ao lado para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header da conversa */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">
              {conversation.client?.name || conversation.contactId?.name || 'Cliente'}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>{conversation.status === 'active' ? 'Online' : 'Offline'}</span>
              {conversation.assignedAgent && (
                <>
                  <span>•</span>
                  <span>Atendente: {conversation.assignedAgent.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Info className="w-5 h-5 text-gray-500" />
          </button>
          {conversation.status !== 'closed' && (
            <button 
              onClick={() => onCloseConversation(conversation._id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Encerrar conversa"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhuma mensagem ainda. Comece a conversa!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = message.sender?._id === user?.id;
              const showDate = index === 0 || 
                formatDate(message.createdAt) !== formatDate(messages[index - 1]?.createdAt);

              return (
                <React.Fragment key={message._id}>
                  {showDate && (
                    <div className="text-center my-4">
                      <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                  )}
                  
                  <div className={`flex mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                      {!isOwnMessage && renderMessageSender(message)}
                      
                      <div className={`rounded-lg px-4 py-2 ${
                        message.senderType === 'system'
                          ? 'bg-gray-100 text-gray-600 text-center text-sm italic'
                          : isOwnMessage
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        {/* Renderizar arquivo se houver */}
                        {message.files && message.files.length > 0 && (
                          <div className="space-y-2">
                            {message.files.map((file, idx) => {
                              const fileUrl = file.url?.startsWith('http') 
                                ? file.url 
                                : `${window.location.origin}${file.url}`;
                              
                              if (file.fileType === 'image' || file.mimetype?.startsWith('image/')) {
                                return (
                                  <div key={idx} className="block">
                                    <img 
                                      src={fileUrl} 
                                      alt={file.originalName || 'Imagem'}
                                      className="max-w-full rounded cursor-pointer hover:opacity-90 mb-2"
                                      style={{ maxHeight: '300px' }}
                                      onClick={() => window.open(fileUrl, '_blank')}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                    <div 
                                      className="hidden items-center space-x-2 p-2 bg-white/10 rounded"
                                      onClick={() => window.open(fileUrl, '_blank')}
                                    >
                                      <ImageIcon className="w-5 h-5" />
                                      <span className="text-sm">{file.originalName || 'Imagem'}</span>
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
                                      isOwnMessage 
                                        ? 'bg-white/20 hover:bg-white/30' 
                                        : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                                  >
                                    <FileIcon className="w-5 h-5 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">
                                        {file.originalName || 'Arquivo'}
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
                        <p className="break-words">{message.content}</p>
                      </div>
                      
                      <div className={`text-xs text-gray-400 mt-1 ${
                        isOwnMessage ? 'text-right' : 'text-left'
                      }`}>
                        {formatMessageTime(message.createdAt)}
                        {isOwnMessage && message.isRead && (
                          <span className="ml-2">✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            
            {typingUsers.size > 0 && (
              <div className="flex items-center space-x-2 text-gray-500 mb-4">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm">Digitando...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
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
              conversationId={conversation._id}
              onFilesUploaded={handleFilesUploaded}
              maxFiles={5}
            />
          </div>
        </div>
      )}

      {/* Input de mensagem */}
      {conversation.status !== 'closed' ? (
        <form onSubmit={handleSendMessage} className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowFileUpload(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Anexar arquivo"
            >
              <Paperclip className="w-5 h-5 text-gray-500" />
            </button>
            
            <input
              ref={inputRef}
              type="text"
              value={messageInput}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={sendingMessage}
            />
            
            <button
              type="button"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Emojis"
            >
              <Smile className="w-5 h-5 text-gray-500" />
            </button>
            
            <button
              type="submit"
              disabled={!messageInput.trim() || sendingMessage}
              className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      ) : (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-center text-gray-500">
            Esta conversa foi encerrada
          </p>
        </div>
      )}
    </div>
  );
};

// Adicionar import faltante
const MessageCircle = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

export default ChatWindow;
