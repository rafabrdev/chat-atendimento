import React, { useState } from 'react';
import { 
  Database, 
  Users, 
  MessageSquare, 
  HardDrive,
  FileUp,
  Save,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import tenantService from '../../services/tenantService';

const LimitsSettings = ({ limits, onSave, saving, isAdmin }) => {
  const [limitsData, setLimitsData] = useState({
    maxUsers: limits.maxUsers || 50,
    maxAgents: limits.maxAgents || 10,
    maxConversations: limits.maxConversations || 1000,
    maxStorage: limits.maxStorage || 5120, // MB
    maxFileSize: limits.maxFileSize || 10 // MB
  });

  const [currentUsage] = useState({
    users: 23,
    agents: 5,
    conversations: 342,
    storage: 1024, // MB
  });

  const handleChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    setLimitsData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(limitsData);
  };

  const calculatePercentage = (used, limit) => {
    if (!limit || limit === 0) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return '#dc3545'; // danger
    if (percentage >= 70) return '#ffc107'; // warning
    return '#28a745'; // success
  };

  const formatStorage = (mb) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  return (
    <div className="limits-settings">
      <div className="settings-section">
        <h2>Limites de Recursos</h2>
        <p className="section-description">
          Configure os limites de uso para sua empresa
        </p>

        {!isAdmin && (
          <div className="info-message">
            <AlertCircle size={20} />
            <p>
              Apenas administradores master podem alterar os limites. 
              Entre em contato com o suporte para ajustes.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="limits-grid">
            {/* Users Limit */}
            <div className="limit-card">
              <div className="limit-header">
                <Users size={24} />
                <h3>Usuários</h3>
              </div>
              
              <div className="limit-usage">
                <div className="usage-info">
                  <span className="usage-current">{currentUsage.users}</span>
                  <span className="usage-separator">/</span>
                  <span className="usage-limit">{limitsData.maxUsers}</span>
                </div>
                
                <div className="usage-bar">
                  <div 
                    className="usage-progress"
                    style={{
                      width: `${calculatePercentage(currentUsage.users, limitsData.maxUsers)}%`,
                      backgroundColor: getUsageColor(calculatePercentage(currentUsage.users, limitsData.maxUsers))
                    }}
                  />
                </div>
                
                <span className="usage-percentage">
                  {calculatePercentage(currentUsage.users, limitsData.maxUsers).toFixed(0)}% usado
                </span>
              </div>

              <div className="limit-control">
                <label htmlFor="maxUsers">Limite Máximo</label>
                <input
                  type="number"
                  id="maxUsers"
                  value={limitsData.maxUsers}
                  onChange={(e) => handleChange('maxUsers', e.target.value)}
                  min="1"
                  disabled={!isAdmin}
                />
              </div>
            </div>

            {/* Agents Limit */}
            <div className="limit-card">
              <div className="limit-header">
                <Users size={24} />
                <h3>Agentes</h3>
              </div>
              
              <div className="limit-usage">
                <div className="usage-info">
                  <span className="usage-current">{currentUsage.agents}</span>
                  <span className="usage-separator">/</span>
                  <span className="usage-limit">{limitsData.maxAgents}</span>
                </div>
                
                <div className="usage-bar">
                  <div 
                    className="usage-progress"
                    style={{
                      width: `${calculatePercentage(currentUsage.agents, limitsData.maxAgents)}%`,
                      backgroundColor: getUsageColor(calculatePercentage(currentUsage.agents, limitsData.maxAgents))
                    }}
                  />
                </div>
                
                <span className="usage-percentage">
                  {calculatePercentage(currentUsage.agents, limitsData.maxAgents).toFixed(0)}% usado
                </span>
              </div>

              <div className="limit-control">
                <label htmlFor="maxAgents">Limite Máximo</label>
                <input
                  type="number"
                  id="maxAgents"
                  value={limitsData.maxAgents}
                  onChange={(e) => handleChange('maxAgents', e.target.value)}
                  min="1"
                  disabled={!isAdmin}
                />
              </div>
            </div>

            {/* Conversations Limit */}
            <div className="limit-card">
              <div className="limit-header">
                <MessageSquare size={24} />
                <h3>Conversas</h3>
              </div>
              
              <div className="limit-usage">
                <div className="usage-info">
                  <span className="usage-current">{currentUsage.conversations}</span>
                  <span className="usage-separator">/</span>
                  <span className="usage-limit">{limitsData.maxConversations}</span>
                </div>
                
                <div className="usage-bar">
                  <div 
                    className="usage-progress"
                    style={{
                      width: `${calculatePercentage(currentUsage.conversations, limitsData.maxConversations)}%`,
                      backgroundColor: getUsageColor(calculatePercentage(currentUsage.conversations, limitsData.maxConversations))
                    }}
                  />
                </div>
                
                <span className="usage-percentage">
                  {calculatePercentage(currentUsage.conversations, limitsData.maxConversations).toFixed(0)}% usado
                </span>
              </div>

              <div className="limit-control">
                <label htmlFor="maxConversations">Limite Máximo</label>
                <input
                  type="number"
                  id="maxConversations"
                  value={limitsData.maxConversations}
                  onChange={(e) => handleChange('maxConversations', e.target.value)}
                  min="1"
                  disabled={!isAdmin}
                />
              </div>
            </div>

            {/* Storage Limit */}
            <div className="limit-card">
              <div className="limit-header">
                <HardDrive size={24} />
                <h3>Armazenamento</h3>
              </div>
              
              <div className="limit-usage">
                <div className="usage-info">
                  <span className="usage-current">{formatStorage(currentUsage.storage)}</span>
                  <span className="usage-separator">/</span>
                  <span className="usage-limit">{formatStorage(limitsData.maxStorage)}</span>
                </div>
                
                <div className="usage-bar">
                  <div 
                    className="usage-progress"
                    style={{
                      width: `${calculatePercentage(currentUsage.storage, limitsData.maxStorage)}%`,
                      backgroundColor: getUsageColor(calculatePercentage(currentUsage.storage, limitsData.maxStorage))
                    }}
                  />
                </div>
                
                <span className="usage-percentage">
                  {calculatePercentage(currentUsage.storage, limitsData.maxStorage).toFixed(0)}% usado
                </span>
              </div>

              <div className="limit-control">
                <label htmlFor="maxStorage">Limite Máximo (MB)</label>
                <input
                  type="number"
                  id="maxStorage"
                  value={limitsData.maxStorage}
                  onChange={(e) => handleChange('maxStorage', e.target.value)}
                  min="100"
                  step="100"
                  disabled={!isAdmin}
                />
              </div>
            </div>

            {/* File Size Limit */}
            <div className="limit-card">
              <div className="limit-header">
                <FileUp size={24} />
                <h3>Tamanho de Arquivo</h3>
              </div>
              
              <div className="limit-info">
                <p>Tamanho máximo por arquivo</p>
                <div className="current-limit">
                  <span className="limit-value">{limitsData.maxFileSize}</span>
                  <span className="limit-unit">MB</span>
                </div>
              </div>

              <div className="limit-control">
                <label htmlFor="maxFileSize">Limite Máximo (MB)</label>
                <input
                  type="number"
                  id="maxFileSize"
                  value={limitsData.maxFileSize}
                  onChange={(e) => handleChange('maxFileSize', e.target.value)}
                  min="1"
                  max="100"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save size={18} />
                    Salvar Limites
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="settings-section">
        <h3>
          <TrendingUp size={20} />
          Dicas de Otimização
        </h3>
        <div className="tips-list">
          <div className="tip-item">
            <strong>Usuários:</strong> Remova usuários inativos regularmente para liberar espaço.
          </div>
          <div className="tip-item">
            <strong>Conversas:</strong> Archive conversas antigas para manter o sistema rápido.
          </div>
          <div className="tip-item">
            <strong>Armazenamento:</strong> Delete arquivos não utilizados e configure limpeza automática.
          </div>
          <div className="tip-item">
            <strong>Performance:</strong> Monitore o uso regularmente para evitar atingir os limites.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LimitsSettings;
