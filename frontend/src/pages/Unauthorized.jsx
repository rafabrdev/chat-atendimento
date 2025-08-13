import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, Home } from 'lucide-react';

const Unauthorized = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <ShieldX className="w-24 h-24 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">
            Acesso Negado
          </h1>
          <p className="text-gray-600 mt-4 max-w-md mx-auto">
            Você não tem permissão para acessar esta página. 
            Verifique suas credenciais ou entre em contato com o administrador.
          </p>
        </div>
        
        <Link
          to="/dashboard"
          className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors inline-flex items-center space-x-2"
        >
          <Home size={20} />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;
