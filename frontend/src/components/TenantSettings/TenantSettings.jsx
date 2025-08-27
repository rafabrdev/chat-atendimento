import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Building, 
  Palette, 
  Shield, 
  Globe, 
  Users, 
  Database,
  Save,
  Upload,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import tenantService from '../../services/tenantService';
import GeneralSettings from './GeneralSettings';
import ThemeSettings from './ThemeSettings';
import LimitsSettings from './LimitsSettings';
import CorsSettings from './CorsSettings';
import './TenantSettings.css';

const TenantSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [tenantData, setTenantData] = useState({
    name: '',
    contactEmail: '',
    phone: '',
    website: '',
    address: '',
    description: '',
    logo: null,
    theme: {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      accentColor: '#28a745',
      backgroundColor: '#ffffff',
      textColor: '#333333',
      darkMode: false,
      fontFamily: 'Inter'
    },
    limits: {
      maxUsers: 50,
      maxAgents: 10,
      maxConversations: 1000,
      maxStorage: 5120, // MB
      maxFileSize: 10 // MB
    },
    allowedOrigins: []
  });

  const tabs = [
    { id: 'general', label: 'Geral', icon: Building },
    { id: 'theme', label: 'Aparência', icon: Palette },
    { id: 'limits', label: 'Limites', icon: Database },
    { id: 'cors', label: 'CORS/Segurança', icon: Shield }
  ];

  useEffect(() => {
    fetchTenantData();
  }, []);

  const fetchTenantData = async () => {
    try {
      setLoading(true);
      const response = await tenantService.getCurrentTenant();
      
      if (response.success) {
        const tenantInfo = response.tenant;
        setTenant(tenantInfo);
        setTenantData({
          name: tenantInfo.name || '',
          contactEmail: tenantInfo.contactEmail || '',
          phone: tenantInfo.phone || '',
          website: tenantInfo.website || '',
          address: tenantInfo.address || '',
          description: tenantInfo.description || '',
          logo: tenantInfo.logo || null,
          theme: tenantInfo.theme || tenantData.theme,
          limits: tenantInfo.limits || tenantData.limits,
          allowedOrigins: tenantInfo.allowedOrigins || []
        });
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneral = async (data) => {
    try {
      setSaving(true);
      const response = await tenantService.updateTenantProfile(tenant._id, {
        name: data.name,
        contactEmail: data.contactEmail,
        phone: data.phone,
        website: data.website,
        address: data.address,
        description: data.description
      });
      
      if (response.success) {
        toast.success('Configurações gerais salvas com sucesso');
        setTenantData(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Error saving general settings:', error);
      toast.error('Erro ao salvar configurações gerais');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTheme = async (theme) => {
    try {
      setSaving(true);
      const response = await tenantService.updateTheme(tenant._id, theme);
      
      if (response.success) {
        toast.success('Tema salvo com sucesso');
        setTenantData(prev => ({ ...prev, theme }));
        
        // Apply theme immediately
        applyTheme(theme);
      }
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Erro ao salvar tema');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLimits = async (limits) => {
    try {
      setSaving(true);
      const response = await tenantService.updateTenantLimits(tenant._id, limits);
      
      if (response.success) {
        toast.success('Limites salvos com sucesso');
        setTenantData(prev => ({ ...prev, limits }));
      }
    } catch (error) {
      console.error('Error saving limits:', error);
      toast.error('Erro ao salvar limites');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCors = async (origins) => {
    try {
      setSaving(true);
      // Update all origins at once
      const response = await tenantService.updateTenantSettings(tenant._id, {
        allowedOrigins: origins
      });
      
      if (response.success) {
        toast.success('Configurações de CORS salvas com sucesso');
        setTenantData(prev => ({ ...prev, allowedOrigins: origins }));
      }
    } catch (error) {
      console.error('Error saving CORS settings:', error);
      toast.error('Erro ao salvar configurações de CORS');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file) => {
    try {
      const response = await tenantService.uploadLogo(tenant._id, file);
      
      if (response.success) {
        toast.success('Logo enviado com sucesso');
        setTenantData(prev => ({ ...prev, logo: response.logoUrl }));
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao enviar logo');
    }
  };

  const handleLogoRemove = async () => {
    try {
      const response = await tenantService.removeLogo(tenant._id);
      
      if (response.success) {
        toast.success('Logo removido com sucesso');
        setTenantData(prev => ({ ...prev, logo: null }));
      }
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Erro ao remover logo');
    }
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--bg-color', theme.backgroundColor);
    root.style.setProperty('--text-color', theme.textColor);
    root.style.setProperty('--font-family', theme.fontFamily);
    
    if (theme.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  if (loading) {
    return (
      <div className="tenant-settings-loading">
        <div className="loading-spinner"></div>
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="tenant-settings">
      <div className="settings-header">
        <h1>
          <Settings className="header-icon" />
          Configurações do Tenant
        </h1>
        <p>Gerencie todas as configurações da sua empresa</p>
      </div>

      <div className="settings-container">
        <div className="settings-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <GeneralSettings
              data={tenantData}
              onSave={handleSaveGeneral}
              onLogoUpload={handleLogoUpload}
              onLogoRemove={handleLogoRemove}
              saving={saving}
            />
          )}

          {activeTab === 'theme' && (
            <ThemeSettings
              theme={tenantData.theme}
              onSave={handleSaveTheme}
              saving={saving}
            />
          )}

          {activeTab === 'limits' && (
            <LimitsSettings
              limits={tenantData.limits}
              onSave={handleSaveLimits}
              saving={saving}
              isAdmin={tenant?.role === 'master'}
            />
          )}

          {activeTab === 'cors' && (
            <CorsSettings
              origins={tenantData.allowedOrigins}
              onSave={handleSaveCors}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantSettings;
