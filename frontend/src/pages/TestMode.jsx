import React, { useState } from 'react';
import { Users, UserCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import toast from 'react-hot-toast';

const TestMode = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [createdUsers, setCreatedUsers] = useState({
    client: null,
    agent: null
  });

  // Criar usuários de teste
  const createTestUsers = async () => {
    setLoading(true);
    try {
      // Criar cliente de teste
      const clientData = {
        name: 'João Silva - Cliente Teste',
        email: `cliente_${Date.now()}@teste.com`,
        password: 'teste123',
        role: 'client',
        companyName: 'Empresa ABC Ltda',
        companyId: '507f1f77bcf86cd799439011' // ID temporário
      };

      const { data: clientResponse } = await api.post('/auth/register', clientData);
      
      // Criar agente de teste
      const agentData = {
        name: 'Maria Santos - Agente Teste',
        email: `agente_${Date.now()}@teste.com`,
        password: 'teste123',
        role: 'agent',
        companyName: 'Suporte TechCo',
        companyId: '507f1f77bcf86cd799439011' // ID temporário
      };

      const { data: agentResponse } = await api.post('/auth/register', agentData);

      setCreatedUsers({
        client: {
          email: clientData.email,
          password: clientData.password,
          name: clientData.name
        },
        agent: {
          email: agentData.email,
          password: agentData.password,
          name: agentData.name
        }
      });

      toast.success('Usuários de teste criados com sucesso!');
    } catch (error) {
      console.error('Erro ao criar usuários:', error);
      toast.error('Erro ao criar usuários de teste');
    } finally {
      setLoading(false);
    }
  };

  // Abrir janela como cliente
  const openAsClient = () => {
    if (!createdUsers.client) {
      toast.error('Crie os usuários de teste primeiro!');
      return;
    }

    // Salvar credenciais no sessionStorage para auto-login
    sessionStorage.setItem('testMode', 'client');
    sessionStorage.setItem('testCredentials', JSON.stringify(createdUsers.client));
    
    // Abrir em nova janela
    const clientWindow = window.open('/login', 'ClientWindow', 'width=1200,height=800,left=0,top=0');
  };

  // Abrir janela como agente
  const openAsAgent = () => {
    if (!createdUsers.agent) {
      toast.error('Crie os usuários de teste primeiro!');
      return;
    }

    // Salvar credenciais no sessionStorage para auto-login
    sessionStorage.setItem('testMode', 'agent');
    sessionStorage.setItem('testCredentials', JSON.stringify(createdUsers.agent));
    
    // Abrir em nova janela
    const agentWindow = window.open('/login', 'AgentWindow', 'width=1200,height=800,left=1200,top=0');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl shadow-lg mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Modo de Teste do Sistema de Chat
            </h1>
            <p className="text-gray-600">
              Teste o sistema simultaneamente como cliente e agente
            </p>
          </div>

          {/* Passo 1: Criar usuários */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-primary-600 text-white rounded-full text-sm font-bold">
                  1
                </span>
                Criar Usuários de Teste
              </h2>
              
              <p className="text-gray-600 mb-4">
                Primeiro, vamos criar dois usuários de teste: um cliente e um agente.
              </p>

              <button
                onClick={createTestUsers}
                disabled={loading || createdUsers.client}
                className={`w-full py-3 px-6 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                  createdUsers.client
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Criando usuários...
                  </>
                ) : createdUsers.client ? (
                  <>
                    <UserCheck className="w-5 h-5" />
                    Usuários criados com sucesso!
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5" />
                    Criar Usuários de Teste
                  </>
                )}
              </button>

              {createdUsers.client && (
                <div className="mt-4 space-y-2 p-4 bg-white rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium text-gray-900">{createdUsers.client.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Agente:</span>
                    <span className="font-medium text-gray-900">{createdUsers.agent.email}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Senha para ambos: <code className="bg-gray-100 px-2 py-1 rounded">teste123</code>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Passo 2: Abrir janelas */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 bg-primary-600 text-white rounded-full text-sm font-bold">
                2
              </span>
              Abrir Janelas de Teste
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Janela do Cliente */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    🙋 Janela do Cliente
                  </h3>
                  <p className="text-sm text-gray-600">
                    Abra uma janela como cliente para iniciar conversas e solicitar atendimento.
                  </p>
                </div>
                
                <button
                  onClick={openAsClient}
                  disabled={!createdUsers.client}
                  className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Abrir como Cliente
                </button>
              </div>

              {/* Janela do Agente */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    🎧 Janela do Agente
                  </h3>
                  <p className="text-sm text-gray-600">
                    Abra uma janela como agente para visualizar a fila e aceitar conversas.
                  </p>
                </div>
                
                <button
                  onClick={openAsAgent}
                  disabled={!createdUsers.agent}
                  className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Abrir como Agente
                </button>
              </div>
            </div>
          </div>

          {/* Instruções */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">📝 Como testar:</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li>1. Clique em "Criar Usuários de Teste" para gerar um cliente e um agente</li>
              <li>2. Abra a janela do Cliente e crie uma nova conversa</li>
              <li>3. Abra a janela do Agente para ver a conversa na fila</li>
              <li>4. Como agente, aceite a conversa para iniciar o atendimento</li>
              <li>5. Teste o envio de mensagens em tempo real entre as janelas</li>
            </ol>
          </div>

          {/* Botão para voltar */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              ← Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestMode;
