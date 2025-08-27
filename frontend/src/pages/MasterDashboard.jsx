import React, { useState, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';
import './MasterDashboard.css';

const MasterDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalRevenue: 0,
    totalUsers: 0
  });

  // Modal states
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [formData, setFormData] = useState({
    // Tenant form
    companyName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    plan: 'trial',
    
    // Admin form
    name: '',
    email: '',
    password: '',
    tenantId: ''
  });

  // Fetch tenants
  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master/tenants');
      const tenantsData = response.data.data || [];
      setTenants(tenantsData);
      
      // Calculate stats
      const active = tenantsData.filter(t => t.subscription?.status === 'active').length;
      const revenue = tenantsData.reduce((sum, t) => {
        if (t.subscription?.pricePerMonth) {
          return sum + t.subscription.pricePerMonth;
        }
        return sum;
      }, 0);
      
      setStats({
        totalTenants: tenantsData.length,
        activeTenants: active,
        totalRevenue: revenue,
        totalUsers: response.data.totalUsers || 0
      });
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Create new tenant
  const handleCreateTenant = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        companyName: formData.companyName,
        contactEmail: formData.ownerEmail,
        ownerData: {
          name: formData.ownerName,
          email: formData.ownerEmail,
          password: formData.ownerPassword
        },
        plan: formData.plan || 'trial'
      };

      await api.post('/master/tenants', payload);
      toast.success('Empresa criada com sucesso!');
      setShowTenantModal(false);
      resetForm();
      fetchTenants();
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error(error.response?.data?.error || 'Erro ao criar empresa');
    }
  };

  // Add admin to tenant
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password
      };

      await api.post(`/master/tenants/${formData.tenantId}/admins`, payload);
      toast.success('Admin adicionado com sucesso!');
      setShowAdminModal(false);
      resetForm();
      fetchTenants();
    } catch (error) {
      console.error('Error adding admin:', error);
      toast.error(error.response?.data?.error || 'Erro ao adicionar admin');
    }
  };

  // Toggle tenant status
  const toggleTenantStatus = async (tenantId, currentStatus) => {
    try {
      await api.patch(`/master/tenants/${tenantId}/status`, {
        isActive: !currentStatus
      });
      toast.success(`Empresa ${currentStatus ? 'desativada' : 'ativada'} com sucesso!`);
      fetchTenants();
    } catch (error) {
      console.error('Error toggling tenant status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  // Delete tenant
  const deleteTenant = async (tenantId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await api.delete(`/master/tenants/${tenantId}`);
      toast.success('Empresa excluída com sucesso!');
      fetchTenants();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Erro ao excluir empresa');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      companyName: '',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
      plan: 'trial',
      name: '',
      email: '',
      password: '',
      tenantId: ''
    });
    setSelectedTenant(null);
  };

  // Open dialog to add admin
  const openAddAdminModal = (tenant) => {
    setFormData(prev => ({ ...prev, tenantId: tenant._id }));
    setSelectedTenant(tenant);
    setShowAdminModal(true);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="master-dashboard">
      <div className="dashboard-header">
        <h1>Dashboard Master</h1>
        <p>Gerencie todas as empresas e administradores do sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div className="stat-content">
            <span className="stat-label">Total de Empresas</span>
            <span className="stat-value">{stats.totalTenants}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <span className="stat-label">Empresas Ativas</span>
            <span className="stat-value">{stats.activeTenants}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <span className="stat-label">Receita Mensal</span>
            <span className="stat-value">{formatCurrency(stats.totalRevenue)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <span className="stat-label">Total de Usuários</span>
            <span className="stat-value">{stats.totalUsers}</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-section">
        <div className="table-header">
          <h2>Empresas</h2>
          <button className="btn btn-primary" onClick={() => setShowTenantModal(true)}>
            + Nova Empresa
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Slug</th>
                <th>Plano</th>
                <th>Owner</th>
                <th>Admins</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant._id}>
                  <td>
                    <div className="company-info">
                      <div className="company-avatar">
                        {tenant.companyName.charAt(0).toUpperCase()}
                      </div>
                      {tenant.companyName}
                    </div>
                  </td>
                  <td>{tenant.slug}</td>
                  <td>
                    <span className={`badge badge-${tenant.subscription?.plan || 'free'}`}>
                      {tenant.subscription?.plan || 'Free'}
                    </span>
                  </td>
                  <td>
                    <div className="owner-info">
                      <span>{tenant.owner?.name || '-'}</span>
                      <small>{tenant.owner?.email}</small>
                    </div>
                  </td>
                  <td>{tenant.admins?.length || 0}</td>
                  <td>
                    <span className={`status-badge ${tenant.isActive ? 'active' : 'inactive'}`}>
                      {tenant.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-icon" 
                        title="Adicionar Admin"
                        onClick={() => openAddAdminModal(tenant)}
                      >
                        👤
                      </button>
                      <button 
                        className="btn-icon" 
                        title={tenant.isActive ? 'Desativar' : 'Ativar'}
                        onClick={() => toggleTenantStatus(tenant._id, tenant.isActive)}
                      >
                        {tenant.isActive ? '⏸️' : '▶️'}
                      </button>
                      <button 
                        className="btn-icon delete" 
                        title="Excluir"
                        onClick={() => deleteTenant(tenant._id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Tenant Modal */}
      {showTenantModal && (
        <div className="modal-overlay" onClick={() => setShowTenantModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nova Empresa</h2>
              <button className="close-btn" onClick={() => setShowTenantModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateTenant}>
              <div className="form-group">
                <label>Nome da Empresa</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Plano</label>
                <select
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                >
                  <option value="trial">Trial (14 dias)</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              
              <h3>Dados do Administrador Principal</h3>
              
              <div className="form-group">
                <label>Nome do Admin</label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email do Admin</label>
                <input
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  value={formData.ownerPassword}
                  onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                  required
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowTenantModal(false);
                  resetForm();
                }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adicionar Admin para {selectedTenant?.companyName}</h2>
              <button className="close-btn" onClick={() => setShowAdminModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddAdmin}>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowAdminModal(false);
                  resetForm();
                }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Adicionar Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterDashboard;
