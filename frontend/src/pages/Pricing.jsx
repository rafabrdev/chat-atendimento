import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Check, Sparkles, Users, MessageSquare, Zap, Shield, Headphones, BarChart3, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';

// Inicializar Stripe com a chave pública
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51S04jIPw0PDAKBHm4loCq3TveIstLfHkQvc2YlA7s5BgZZectPvcegtiRQ2lfFPpDad0jVVaNOBYUnXk7IBdWTFm00M3esl5qF');

const plans = [
  {
    id: 'starter',
    name: 'Gratuito',
    description: 'Inteligência para as tarefas do quotidiano',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'USD',
    features: [
      { text: 'Acesso ao ChatGPT básico', icon: MessageSquare, included: true },
      { text: 'Carregamentos de ficheiros limitados', icon: Users, included: true },
      { text: 'Criação de imagens limitada e mais lenta', icon: Sparkles, included: true },
      { text: 'Memória e contexto limitados', icon: Shield, included: true },
      { text: 'Investigação a fundo limitada', icon: BarChart3, included: true },
      { text: 'Criação de vídeos', icon: Globe, included: false },
      { text: 'Agente Codex', icon: Zap, included: false },
      { text: 'Projetos e GPTs personalizados', icon: Headphones, included: false }
    ],
    buttonText: 'O seu plano atual',
    buttonDisabled: true,
    highlighted: false
  },
  {
    id: 'professional',
    name: 'Plus',
    description: 'Mais acesso a inteligência avançada',
    monthlyPrice: 20,
    yearlyPrice: 200,
    currency: 'USD',
    features: [
      { text: 'GPT-5 com raciocínio avançado', icon: MessageSquare, included: true },
      { text: 'Mensagens e carregamentos expandidos', icon: Users, included: true },
      { text: 'Criação de imagens expandida e mais rápida', icon: Sparkles, included: true },
      { text: 'Memória e contexto expandidos', icon: Shield, included: true },
      { text: 'Investigação a fundo e modo de agente', icon: BarChart3, included: true },
      { text: 'Projetos, tarefas, GPTs personalizados', icon: Headphones, included: true },
      { text: 'Criação de vídeos Sora', icon: Globe, included: true },
      { text: 'Agente Codex', icon: Zap, included: true }
    ],
    buttonText: 'Obter Plus',
    buttonDisabled: false,
    highlighted: true,
    badge: 'POPULAR'
  },
  {
    id: 'enterprise',
    name: 'Pro',
    description: 'Acesso completo ao melhor do ChatGPT',
    monthlyPrice: 200,
    yearlyPrice: 2000,
    currency: 'USD',
    features: [
      { text: 'GPT-5 com raciocínio pro', icon: MessageSquare, included: true },
      { text: 'Mensagens e carregamentos ilimitados', icon: Users, included: true },
      { text: 'Criação de imagens ilimitada e mais rápida', icon: Sparkles, included: true },
      { text: 'Máxima memória e contexto', icon: Shield, included: true },
      { text: 'Máxima investigação a fundo e modo de agente', icon: BarChart3, included: true },
      { text: 'Projetos, tarefas e GPTs personalizados expandidos', icon: Headphones, included: true },
      { text: 'Criação de vídeos Sora expandida', icon: Globe, included: true },
      { text: 'Agente Codex expandido', icon: Zap, included: true },
      { text: 'Antevisão das novas funcionalidades', icon: Sparkles, included: true }
    ],
    buttonText: 'Obter Pro',
    buttonDisabled: false,
    highlighted: false,
    comingSoon: 'Acesso limitado sujeito às proteções contra abusos. Saiba mais'
  }
];

function Pricing() {
  const [billingCycle, setBillingCycle] = useState('pessoal');
  const [loadingPlan, setLoadingPlan] = useState(null);

  const handleCheckout = async (planId) => {
    if (planId === 'starter') return; // Plano gratuito não precisa de checkout
    
    try {
      setLoadingPlan(planId);
      
      // Mapear o billing cycle para o formato esperado pelo backend
      const billingType = billingCycle === 'pessoal' ? 'monthly' : 'yearly';
      
      // Criar sessão de checkout
      const response = await api.post('/stripe/create-checkout', {
        plan: planId,
        billingCycle: billingType
      });

      if (response.data.success && response.data.data.url) {
        // Redirecionar para Stripe Checkout
        window.location.href = response.data.data.url;
      } else {
        throw new Error('URL de checkout não recebida');
      }
    } catch (error) {
      console.error('Erro ao criar checkout:', error);
      toast.error(error.response?.data?.message || 'Erro ao processar pagamento');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-8">
            Atualize o seu plano
          </h1>
          
          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-100 p-1 rounded-lg inline-flex">
              <button
                onClick={() => setBillingCycle('pessoal')}
                className={`px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
                  billingCycle === 'pessoal'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pessoal
              </button>
              <button
                onClick={() => setBillingCycle('business')}
                className={`px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
                  billingCycle === 'business'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Business
              </button>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 transition-all duration-200 ${
                plan.highlighted
                  ? 'bg-indigo-50 border-2 border-indigo-600'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 right-6">
                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-xs align-top text-gray-900 mt-1">$</span>
                  <span className="text-4xl font-semibold text-gray-900">
                    {billingCycle === 'pessoal' ? plan.monthlyPrice : Math.floor(plan.yearlyPrice/12)}
                  </span>
                  <span className="ml-2 text-sm text-gray-600">
                    USD / <br/>mês
                  </span>
                </div>
                {plan.id === 'starter' && (
                  <div className="mt-4 text-sm text-gray-600">
                    O seu plano atual
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={plan.buttonDisabled || loadingPlan === plan.id}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 mb-6 ${
                  plan.buttonDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : plan.highlighted
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'
                } ${
                  loadingPlan === plan.id
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {loadingPlan === plan.id ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processando...
                  </span>
                ) : (
                  plan.buttonText
                )}
              </button>

              {/* Features */}
              <div className="space-y-3">
                {plan.features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-start">
                      <Icon className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
                        feature.included ? 'text-gray-700' : 'text-gray-300'
                      }`} />
                      <span className={`text-sm ${
                        feature.included ? 'text-gray-700' : 'text-gray-400 line-through'
                      }`}>
                        {feature.text}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Coming Soon Notice */}
              {plan.comingSoon && (
                <div className="mt-4 text-xs text-gray-500 text-center">
                  {plan.comingSoon}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-600">
            Já tem um plano? <a href="#" className="text-indigo-600 hover:text-indigo-500 underline">Consulte a ajuda de faturação</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Pricing;
