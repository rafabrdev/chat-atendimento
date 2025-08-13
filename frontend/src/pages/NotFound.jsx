import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary-500">404</h1>
          <h2 className="text-3xl font-bold text-gray-900 mt-4">
            Página não encontrada
          </h2>
          <p className="text-gray-600 mt-4 max-w-md mx-auto">
            A página que você está procurando não existe ou foi movida para outro local.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dashboard"
            className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center space-x-2"
          >
            <Home size={20} />
            <span>Ir para Dashboard</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="bg-white text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-300 flex items-center justify-center space-x-2"
          >
            <ArrowLeft size={20} />
            <span>Voltar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
