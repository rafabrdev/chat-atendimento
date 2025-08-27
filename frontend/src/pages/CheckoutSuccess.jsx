import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, Globe, CheckCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    phone: '',
    website: '',
    industry: 'technology',
    companySize: '1-10'
  });
  const [errors, setErrors] = useState({});

  // Verificar sessão do Stripe
  useEffect(() => {
    if (!sessionId) {
      toast.error('Sessão inválida');
      navigate('/pricing');
      return;
    }

    verifyCheckoutSession();
  }, [sessionId]);

  const verifyCheckoutSession = async () => {
    try {
      const response = await api.get(`/stripe/verify-session/${sessionId}`);
      
      if (response.data.success) {
        setSessionData(response.data.data);
        // Pre-preencher email se disponível
        if (response.data.data.customerEmail) {
          setFormData(prev => ({
            ...prev,
            adminEmail: response.data.data.customerEmail
          }));
        }
      } else {
        throw new Error('Sessão inválida');
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      toast.error('Sessão de pagamento inválida ou expirada');
      navigate('/pricing');
    } finally {
      setVerifying(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Nome da empresa é obrigatório';
    }

    if (!formData.adminName.trim()) {
      newErrors.adminName = 'Nome do administrador é obrigatório';
    }

    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.adminEmail)) {
      newErrors.adminEmail = 'Email inválido';
    }

    if (!formData.adminPassword) {
      newErrors.adminPassword = 'Senha é obrigatória';
    } else if (formData.adminPassword.length < 8) {
      newErrors.adminPassword = 'Senha deve ter pelo menos 8 caracteres';
    }

    if (formData.adminPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/stripe/complete-setup', {
        sessionId,
        ...formData
      });

      if (response.data.success) {
        toast.success('Empresa cadastrada com sucesso!');
        
        // Guardar credenciais temporariamente
        sessionStorage.setItem('newCompanySetup', JSON.stringify({
          email: formData.adminEmail,
          password: formData.adminPassword,
          companyName: formData.companyName,
          tenantSlug: response.data.data.tenantSlug
        }));

        // Mostrar credenciais ao usuário
        toast.success('Agora você pode acessar o sistema!');
        
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Erro ao completar cadastro:', error);
      toast.error(error.response?.data?.message || 'Erro ao criar empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpar erro do campo
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Verificando sua sessão de pagamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header de Sucesso */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pagamento Confirmado!
          </h1>
          <p className="text-gray-600">
            Agora vamos configurar sua empresa para começar a usar o sistema
          </p>
          {sessionData && (
            <div className="mt-4 inline-flex items-center bg-indigo-50 px-4 py-2 rounded-lg">
              <span className="text-sm text-indigo-700">
                Plano {sessionData.plan} • {sessionData.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
              </span>
            </div>
          )}
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados da Empresa */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Dados da Empresa
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Empresa *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        errors.companyName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Minha Empresa Ltda"
                    />
                  </div>
                  {errors.companyName && (
                    <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                          errors.phone ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="(11) 98765-4321"
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://minhaempresa.com.br"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Setor
                    </label>
                    <select
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="technology">Tecnologia</option>
                      <option value="retail">Varejo</option>
                      <option value="services">Serviços</option>
                      <option value="education">Educação</option>
                      <option value="healthcare">Saúde</option>
                      <option value="finance">Finanças</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tamanho da Empresa
                    </label>
                    <select
                      name="companySize"
                      value={formData.companySize}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="1-10">1-10 funcionários</option>
                      <option value="11-50">11-50 funcionários</option>
                      <option value="51-200">51-200 funcionários</option>
                      <option value="201-500">201-500 funcionários</option>
                      <option value="500+">500+ funcionários</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Dados do Administrador */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Dados do Administrador
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="adminName"
                      value={formData.adminName}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        errors.adminName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="João Silva"
                    />
                  </div>
                  {errors.adminName && (
                    <p className="mt-1 text-sm text-red-600">{errors.adminName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="adminEmail"
                      value={formData.adminEmail}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        errors.adminEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="admin@minhaempresa.com.br"
                    />
                  </div>
                  {errors.adminEmail && (
                    <p className="mt-1 text-sm text-red-600">{errors.adminEmail}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Senha *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        name="adminPassword"
                        value={formData.adminPassword}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                          errors.adminPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>
                    {errors.adminPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.adminPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmar Senha *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                          errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Repita a senha"
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Botão de Submit */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader className="animate-spin h-5 w-5 mr-2" />
                    Criando sua empresa...
                  </span>
                ) : (
                  'Finalizar Cadastro'
                )}
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              Ao continuar, você concorda com nossos{' '}
              <a href="#" className="text-indigo-600 hover:text-indigo-500">
                Termos de Serviço
              </a>{' '}
              e{' '}
              <a href="#" className="text-indigo-600 hover:text-indigo-500">
                Política de Privacidade
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CheckoutSuccess;
