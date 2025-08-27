import React, { useState, useRef } from 'react';
import { 
  Building, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  FileText,
  Upload,
  X,
  Save,
  Image
} from 'lucide-react';

const GeneralSettings = ({ data, onSave, onLogoUpload, onLogoRemove, saving }) => {
  const [formData, setFormData] = useState({
    name: data.name || '',
    contactEmail: data.contactEmail || '',
    phone: data.phone || '',
    website: data.website || '',
    address: data.address || '',
    description: data.description || ''
  });
  const [errors, setErrors] = useState({});
  const [logoPreview, setLogoPreview] = useState(data.logo);
  const fileInputRef = useRef();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Nome da empresa deve ter pelo menos 2 caracteres';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.contactEmail || !emailRegex.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Email de contato inválido';
    }
    
    if (formData.phone) {
      const phoneRegex = /^[\d\s()+-]+$/;
      if (!phoneRegex.test(formData.phone)) {
        newErrors.phone = 'Telefone inválido';
      }
    }
    
    if (formData.website) {
      try {
        new URL(formData.website);
      } catch {
        newErrors.website = 'Website deve ser uma URL válida (ex: https://exemplo.com)';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione uma imagem');
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Imagem deve ter no máximo 2MB');
        return;
      }
      
      // Preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      // Upload
      onLogoUpload(file);
    }
  };

  const handleRemoveLogo = () => {
    if (confirm('Tem certeza que deseja remover o logo?')) {
      setLogoPreview(null);
      onLogoRemove();
    }
  };

  return (
    <div className="general-settings">
      <div className="settings-section">
        <h2>Informações da Empresa</h2>
        <p className="section-description">
          Configure as informações básicas da sua empresa
        </p>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">
                <Building size={16} />
                Nome da Empresa *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? 'error' : ''}
                placeholder="Digite o nome da empresa"
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="contactEmail">
                <Mail size={16} />
                Email de Contato *
              </label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
                className={errors.contactEmail ? 'error' : ''}
                placeholder="contato@empresa.com"
              />
              {errors.contactEmail && <span className="error-message">{errors.contactEmail}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">
                <Phone size={16} />
                Telefone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={errors.phone ? 'error' : ''}
                placeholder="(11) 98765-4321"
              />
              {errors.phone && <span className="error-message">{errors.phone}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="website">
                <Globe size={16} />
                Website
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className={errors.website ? 'error' : ''}
                placeholder="https://www.empresa.com"
              />
              {errors.website && <span className="error-message">{errors.website}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address">
              <MapPin size={16} />
              Endereço
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Rua Exemplo, 123 - Cidade/UF"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">
              <FileText size={16} />
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Breve descrição sobre a empresa..."
            />
          </div>

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
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="settings-section">
        <h2>Logo da Empresa</h2>
        <p className="section-description">
          Faça upload do logo da sua empresa (máximo 2MB)
        </p>

        <div className="logo-upload-area">
          {logoPreview ? (
            <div className="logo-preview">
              <img src={logoPreview} alt="Logo" />
              <button 
                className="btn-remove-logo"
                onClick={handleRemoveLogo}
                title="Remover logo"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="logo-placeholder">
              <Image size={48} />
              <p>Nenhum logo configurado</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} />
            {logoPreview ? 'Alterar Logo' : 'Enviar Logo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;
