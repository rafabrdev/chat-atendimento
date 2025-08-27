import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Building, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../config/api';
import toast from 'react-hot-toast';

const Register = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'client',
    phone: '',
    company: '',
    inviteToken: inviteToken || ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [inviteData, setInviteData] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  // Verificar convite se houver token
  useEffect(() => {
    if (inviteToken) {
      validateInvite();
    }
  }, [inviteToken]);

  const validateInvite = async () => {
    setLoadingInvite(true);
    setInviteError(null);
    
    try {
      const response = await api.get(`/invitations/validate/${inviteToken}`);
      const invitation = response.data.data;
      
      if (invitation) {
        setInviteData(invitation);
        // Preencher campos com dados do convite
        setFormData(prev => ({
          ...prev,
          name: invitation.name || '',
          email: invitation.email || '',
          role: invitation.role || 'client',
          inviteToken: inviteToken
        }));
        toast.success('Convite válido! Complete seu registro.');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Convite inválido ou expirado';
      setInviteError(message);
      toast.error(message);
    } finally {
      setLoadingInvite(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpar erro do campo quando usuário digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.company.trim()) {
      newErrors.company = 'Empresa é obrigatória';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const userData = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      company: formData.company,
      role: formData.role,
      profile: {
        phone: formData.phone
      },
      inviteToken: formData.inviteToken || undefined
    };

    const result = await register(userData);
    
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {inviteData ? 'Registro por Convite' : 'Criar conta'}
            </h1>
            <p className="text-gray-600 mt-2">
              {inviteData ? 'Complete seu cadastro para aceitar o convite' : 'Preencha os dados para começar'}
            </p>
          </div>

          {/* Invite Status */}
          {loadingInvite && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-blue-700">Verificando convite...</span>
            </div>
          )}

          {inviteData && !inviteError && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <p className="text-green-800 font-medium">Convite Válido!</p>
                <p className="text-green-700 text-sm">
                  Você foi convidado como {inviteData.role === 'client' ? 'Cliente' : inviteData.role === 'agent' ? 'Agente' : 'Administrador'}
                </p>
              </div>
            </div>
          )}

          {inviteError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <p className="text-red-800 font-medium">Erro no Convite</p>
                <p className="text-red-700 text-sm">{inviteError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome completo
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.name 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="Seu nome completo"
                />
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              {errors.name && (
                <p className="text-red-600 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={inviteData?.email} // Desabilitar se vier do convite
                  className={`w-full px-4 py-3 pl-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.email 
                      ? 'border-red-300 bg-red-50' 
                      : inviteData?.email
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="seu@email.com"
                />
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Role - Ocultar se vier do convite */}
            {!inviteData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de conta
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                >
                  <option value="client">Cliente</option>
                  <option value="agent">Agente</option>
                </select>
              </div>
            )}

            {/* Phone (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone (opcional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* Company (required) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empresa <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.company 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="Nome da empresa"
                />
                <Building className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              {errors.company && (
                <p className="text-red-600 text-sm mt-1">{errors.company}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.password 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.confirmPassword 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-500 text-white py-3 px-4 rounded-lg hover:bg-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Criando conta...
                </div>
              ) : (
                'Criar conta'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Já tem uma conta?{' '}
              <Link 
                to="/login" 
                className="text-primary-500 hover:text-primary-600 font-medium"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
