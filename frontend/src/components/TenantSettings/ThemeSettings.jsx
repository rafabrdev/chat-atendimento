import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Type,
  Save,
  RotateCcw,
  Eye
} from 'lucide-react';

const ThemeSettings = ({ theme, onSave, saving }) => {
  const [themeData, setThemeData] = useState({
    primaryColor: theme.primaryColor || '#007bff',
    secondaryColor: theme.secondaryColor || '#6c757d',
    accentColor: theme.accentColor || '#28a745',
    backgroundColor: theme.backgroundColor || '#ffffff',
    textColor: theme.textColor || '#333333',
    darkMode: theme.darkMode || false,
    fontFamily: theme.fontFamily || 'Inter'
  });

  const [previewMode, setPreviewMode] = useState(false);

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Raleway', label: 'Raleway' },
    { value: 'system-ui', label: 'System Default' }
  ];

  const defaultThemes = {
    light: {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      accentColor: '#28a745',
      backgroundColor: '#ffffff',
      textColor: '#333333',
      darkMode: false
    },
    dark: {
      primaryColor: '#0d6efd',
      secondaryColor: '#6c757d',
      accentColor: '#20c997',
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      darkMode: true
    },
    professional: {
      primaryColor: '#2c3e50',
      secondaryColor: '#34495e',
      accentColor: '#3498db',
      backgroundColor: '#ecf0f1',
      textColor: '#2c3e50',
      darkMode: false
    },
    modern: {
      primaryColor: '#6366f1',
      secondaryColor: '#8b5cf6',
      accentColor: '#ec4899',
      backgroundColor: '#fafafa',
      textColor: '#1f2937',
      darkMode: false
    }
  };

  useEffect(() => {
    if (previewMode) {
      applyThemePreview(themeData);
    } else {
      resetThemePreview();
    }
  }, [themeData, previewMode]);

  const handleColorChange = (field, value) => {
    setThemeData(prev => ({ ...prev, [field]: value }));
  };

  const handleFontChange = (e) => {
    setThemeData(prev => ({ ...prev, fontFamily: e.target.value }));
  };

  const toggleDarkMode = () => {
    setThemeData(prev => ({ ...prev, darkMode: !prev.darkMode }));
  };

  const applyPresetTheme = (presetName) => {
    const preset = defaultThemes[presetName];
    if (preset) {
      setThemeData(prev => ({ ...prev, ...preset }));
    }
  };

  const resetToDefaults = () => {
    const defaultTheme = defaultThemes.light;
    setThemeData({ ...defaultTheme, fontFamily: 'Inter' });
  };

  const applyThemePreview = (themeToApply) => {
    const root = document.documentElement;
    root.style.setProperty('--preview-primary', themeToApply.primaryColor);
    root.style.setProperty('--preview-secondary', themeToApply.secondaryColor);
    root.style.setProperty('--preview-accent', themeToApply.accentColor);
    root.style.setProperty('--preview-bg', themeToApply.backgroundColor);
    root.style.setProperty('--preview-text', themeToApply.textColor);
    root.style.setProperty('--preview-font', themeToApply.fontFamily);
    
    document.body.classList.add('theme-preview');
    if (themeToApply.darkMode) {
      document.body.classList.add('dark-preview');
    } else {
      document.body.classList.remove('dark-preview');
    }
  };

  const resetThemePreview = () => {
    document.body.classList.remove('theme-preview', 'dark-preview');
    const root = document.documentElement;
    ['primary', 'secondary', 'accent', 'bg', 'text', 'font'].forEach(prop => {
      root.style.removeProperty(`--preview-${prop}`);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPreviewMode(false);
    onSave(themeData);
  };

  return (
    <div className="theme-settings">
      <div className="settings-section">
        <h2>Personalização do Tema</h2>
        <p className="section-description">
          Customize as cores e aparência da sua aplicação
        </p>

        <div className="theme-presets">
          <h3>Temas Predefinidos</h3>
          <div className="preset-buttons">
            <button 
              type="button"
              className="preset-btn"
              onClick={() => applyPresetTheme('light')}
            >
              <Sun size={16} />
              Claro
            </button>
            <button 
              type="button"
              className="preset-btn"
              onClick={() => applyPresetTheme('dark')}
            >
              <Moon size={16} />
              Escuro
            </button>
            <button 
              type="button"
              className="preset-btn"
              onClick={() => applyPresetTheme('professional')}
            >
              Profissional
            </button>
            <button 
              type="button"
              className="preset-btn"
              onClick={() => applyPresetTheme('modern')}
            >
              Moderno
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="color-settings">
            <h3>Cores do Tema</h3>
            
            <div className="form-row">
              <div className="form-group color-group">
                <label htmlFor="primaryColor">
                  Cor Primária
                </label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="primaryColor"
                    value={themeData.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                  />
                  <input
                    type="text"
                    value={themeData.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="form-group color-group">
                <label htmlFor="secondaryColor">
                  Cor Secundária
                </label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={themeData.secondaryColor}
                    onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                  />
                  <input
                    type="text"
                    value={themeData.secondaryColor}
                    onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group color-group">
                <label htmlFor="accentColor">
                  Cor de Destaque
                </label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="accentColor"
                    value={themeData.accentColor}
                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                  />
                  <input
                    type="text"
                    value={themeData.accentColor}
                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="form-group color-group">
                <label htmlFor="backgroundColor">
                  Cor de Fundo
                </label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="backgroundColor"
                    value={themeData.backgroundColor}
                    onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                  />
                  <input
                    type="text"
                    value={themeData.backgroundColor}
                    onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group color-group">
                <label htmlFor="textColor">
                  Cor do Texto
                </label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="textColor"
                    value={themeData.textColor}
                    onChange={(e) => handleColorChange('textColor', e.target.value)}
                  />
                  <input
                    type="text"
                    value={themeData.textColor}
                    onChange={(e) => handleColorChange('textColor', e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fontFamily">
                  <Type size={16} />
                  Fonte
                </label>
                <select
                  id="fontFamily"
                  value={themeData.fontFamily}
                  onChange={handleFontChange}
                >
                  {fontOptions.map(font => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="theme-options">
            <div className="form-group">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={themeData.darkMode}
                  onChange={toggleDarkMode}
                />
                <span className="switch-slider"></span>
                <span className="switch-text">
                  {themeData.darkMode ? (
                    <>
                      <Moon size={16} />
                      Modo Escuro Ativado
                    </>
                  ) : (
                    <>
                      <Sun size={16} />
                      Modo Claro Ativado
                    </>
                  )}
                </span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye size={18} />
              {previewMode ? 'Parar Preview' : 'Preview'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetToDefaults}
            >
              <RotateCcw size={18} />
              Restaurar Padrão
            </button>

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
                  Salvar Tema
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="theme-preview-section">
        <h3>Preview do Tema</h3>
        <div className="preview-container">
          <div 
            className="preview-box"
            style={{
              backgroundColor: themeData.backgroundColor,
              color: themeData.textColor,
              fontFamily: themeData.fontFamily
            }}
          >
            <div 
              className="preview-header"
              style={{ backgroundColor: themeData.primaryColor }}
            >
              <h4>Cabeçalho</h4>
            </div>
            <div className="preview-content">
              <button 
                style={{ 
                  backgroundColor: themeData.primaryColor,
                  color: '#fff'
                }}
              >
                Botão Primário
              </button>
              <button 
                style={{ 
                  backgroundColor: themeData.secondaryColor,
                  color: '#fff'
                }}
              >
                Botão Secundário
              </button>
              <button 
                style={{ 
                  backgroundColor: themeData.accentColor,
                  color: '#fff'
                }}
              >
                Botão Destaque
              </button>
              <p style={{ marginTop: '1rem' }}>
                Este é um exemplo de texto com a fonte {themeData.fontFamily}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
