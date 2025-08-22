import React from 'react';
import ChatContainer from '../components/Chat/ChatContainer';
import AgentChatContainer from '../components/Chat/AgentChatContainer';
import { useAuth } from '../context/AuthContext';

const Conversations = () => {
  const { user } = useAuth();
  const isAgent = user?.role === 'agent' || user?.role === 'admin';
  
  // Renderizar componente baseado no papel do usuário
  return isAgent ? <AgentChatContainer /> : <ChatContainer />;
};

export default Conversations;
