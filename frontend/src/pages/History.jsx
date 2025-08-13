import React from 'react';
import { History as HistoryIcon, Search } from 'lucide-react';

const History = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Histórico</h1>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <HistoryIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Histórico de Conversas
          </h2>
          <p className="text-gray-600 mb-6">
            O histórico completo de todas as suas conversas será exibido aqui.
            Esta funcionalidade será implementada nas próximas sprints.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">
              <strong>Em desenvolvimento:</strong> Histórico detalhado, filtros avançados, 
              exportação de dados e busca por conteúdo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
