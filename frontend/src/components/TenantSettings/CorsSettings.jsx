import React, { useState } from 'react';
import { Globe, Plus, Trash2, Save } from 'lucide-react';

const isValidOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    // Allow wildcard pattern like * or *.domain.com
    if (origin === '*' || origin.startsWith('*.')) return true;
    return false;
  }
};

const CorsSettings = ({ origins = [], onSave, saving }) => {
  const [originList, setOriginList] = useState(origins);
  const [newOrigin, setNewOrigin] = useState('');
  const [error, setError] = useState('');

  const addOrigin = () => {
    setError('');
    const value = newOrigin.trim();
    if (!value) return;

    if (!isValidOrigin(value)) {
      setError('Origem inválida. Use http(s)://dominio.com, * ou *.dominio.com');
      return;
    }

    if (originList.includes(value)) {
      setError('Origem já adicionada');
      return;
    }

    setOriginList([...originList, value]);
    setNewOrigin('');
  };

  const removeOrigin = (origin) => {
    setOriginList(originList.filter(o => o !== origin));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(originList);
  };

  return (
    <div className="cors-settings">
      <div className="settings-section">
        <h2>Configurações de CORS</h2>
        <p className="section-description">
          Defina quais origens (domínios) podem acessar sua API
        </p>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label>Adicionar Origem</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                placeholder="https://app.seudominio.com ou *.seudominio.com"
                className="flex-1"
              />
              <button type="button" onClick={addOrigin} className="btn btn-secondary">
                <Plus size={16} /> Adicionar
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          </div>

          <div className="origin-list">
            {originList.length === 0 ? (
              <div className="empty-state">
                <Globe size={18} /> Nenhuma origem configurada
              </div>
            ) : (
              <ul className="divide-y">
                {originList.map((origin) => (
                  <li key={origin} className="flex items-center justify-between py-2">
                    <span className="font-mono text-sm">{origin}</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeOrigin(origin)}
                    >
                      <Trash2 size={16} /> Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : (<><Save size={18} /> Salvar CORS</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CorsSettings;

