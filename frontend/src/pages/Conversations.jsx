import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';

const Conversations = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Conversas</h1>
        <button className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2">
          <Plus size={20} />
          <span>Nova Conversa</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Sistema de Chat em Desenvolvimento
          </h2>
          <p className="text-gray-600 mb-6">
            O sistema de conversas será implementado na próxima sprint.
            Por enquanto, você pode navegar pelas outras funcionalidades do sistema.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Próximas funcionalidades:</strong> Chat em tempo real, upload de arquivos, 
              histórico de conversas e muito mais!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversations;
