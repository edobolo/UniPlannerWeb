import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check, Moon, Sun, Crown, Lock } from 'lucide-react';
import './ThemeModal.css';

export const FACULTY_PALETTES = [
  { id: 'default', name: 'UniPlanner Classic', color: '#3b82f6', icon: '🌌', desc: 'Blu Spaziale Moderno', isFree: true },
  { id: 'amoled', name: 'AMOLED Pure Black (OLED Eco)', color: '#000000', icon: '🖤', desc: 'Nero Assoluto (Solo Scura)', isFree: true },
  { id: 'humanities_white', name: 'Lettere e Filosofia / Teologia', color: '#e2e8f0', icon: '📜', desc: 'Bianco Accademico & Perla' },
  { id: 'law_blue', name: 'Giurisprudenza / Diritto', color: '#1d4ed8', icon: '⚖️', desc: 'Blu Notte Istituzionale' },
  { id: 'engineering_black', name: 'Ingegneria e Architettura', color: '#27272a', icon: '⚙️', desc: 'Nero & Grafite Titanio' },
  { id: 'medicine_red', name: 'Medicina e Chirurgia', color: '#dc2626', icon: '🩺', desc: 'Rosso Scarlatto' },
  { id: 'pharmacy_garnet', name: 'Farmacia e Veterinaria', color: '#991b1b', icon: '💊', desc: 'Rosso Granata & Amaranto' },
  { id: 'science_green', name: 'Scienze MM.FF.NN. e Matematica', color: '#16a34a', icon: '🔬', desc: 'Verde Brillante' },
  { id: 'agriculture_darkgreen', name: 'Agraria', color: '#14532d', icon: '🌿', desc: 'Verde Cupo Foresta' },
  { id: 'economics_yellow', name: 'Economia e Commercio', color: '#eab308', icon: '📈', desc: 'Giallo Oro' },
  { id: 'psychology_grey', name: 'Psicologia e Pedagogia', color: '#64748b', icon: '🧠', desc: 'Grigio Ardesia & Rosa' },
  { id: 'politics_purple', name: 'Scienze Politiche', color: '#7e22ce', icon: '🏛️', desc: 'Viola Tradizionale' },
  { id: 'statistics_bluette', name: 'Statistica & Scienze Bancarie', color: '#2563eb', icon: '📊', desc: 'Bluette & Azzurro' },
  { id: 'communication_vinaccia', name: 'Scienze della Comunicazione', color: '#9d174d', icon: '📣', desc: 'Vinaccia & Corallo' },
  { id: 'languages_bordeaux', name: 'Lingue e Letterature', color: '#831843', icon: '🌍', desc: 'Rosso Bordeaux' },
  { id: 'sociology_orange', name: 'Sociologia', color: '#ea580c', icon: '👥', desc: 'Arancione' },
  { id: 'arts_celeste', name: 'Accademia Belle Arti', color: '#38bdf8', icon: '🎨', desc: 'Celeste Carta da Zucchero' }
];

const ThemeModal = ({ isOpen, onClose, currentPalette, onSelectPalette, theme, onToggleTheme, isPro, onOpenProModal }) => {
  if (!isOpen) return null;

  const isAmoled = currentPalette === 'amoled';

  return (
    <AnimatePresence>
      <div className="modal-overlay theme-modal-overlay" onClick={onClose}>
        <motion.div 
          className="theme-modal glass-panel"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="theme-modal-header">
            <div className="theme-header-left">
              <div className="theme-icon-badge">
                <Sparkles size={20} />
              </div>
              <div>
                <h3>Colori & Temi Ufficiali Facoltà</h3>
                <p className="theme-header-sub">Colori tradizionali dell'ordinamento accademico italiano</p>
              </div>
            </div>
            <button className="theme-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Luxury PRO Status Banner */}
          {isPro ? (
            <div className="theme-pro-unlocked-banner">
              <Crown size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div>
                <strong>Membro PRO 👑 — Tutti i 17 Temi di Facoltà Sbloccati</strong>
                <p>Include l'effetto esclusivo Ambient Glow coordinato al colore del tuo ateneo.</p>
              </div>
            </div>
          ) : (
            <div className="theme-pro-locked-banner" onClick={onOpenProModal}>
              <Crown size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div>
                <strong>Sblocca tutti i Temi con UniPlanner PRO ⚡</strong>
                <p>Tocca per attivare tutti i colori di facoltà e le funzioni esclusive.</p>
              </div>
            </div>
          )}

          {/* Quick Dark/Light Toggle */}
          <div className="theme-mode-row">
            <span className="theme-mode-label">
              Modalità Aspetto {isAmoled && <span style={{ fontSize: '11px', color: 'var(--accent-primary)', marginLeft: '6px' }}>(Disattivata per AMOLED)</span>}
            </span>
            <div className="theme-mode-toggle">
              <button 
                type="button" 
                className={`theme-pill ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme !== 'dark' && onToggleTheme()}
                disabled={isAmoled}
                title={isAmoled ? 'La modalità AMOLED supporta esclusivamente il tema scuro' : 'Modalità Scura'}
              >
                <Moon size={14} />
                <span>Scura</span>
              </button>
              <button 
                type="button" 
                className={`theme-pill ${theme === 'light' && !isAmoled ? 'active' : ''}`}
                onClick={() => {
                  if (isAmoled) return;
                  theme !== 'light' && onToggleTheme();
                }}
                disabled={isAmoled}
                style={{ opacity: isAmoled ? 0.35 : 1, cursor: isAmoled ? 'not-allowed' : 'pointer' }}
                title={isAmoled ? 'La modalità AMOLED è concepita esclusivamente per sfondi neri su display OLED' : 'Modalità Chiara'}
              >
                <Sun size={14} />
                <span>Chiara</span>
              </button>
            </div>
          </div>

          {/* Palette Grid */}
          <div className="theme-palettes-grid">
            {FACULTY_PALETTES.map((pal) => {
              const isSelected = currentPalette === pal.id;
              const isLocked = !pal.isFree && !isPro;

              return (
                <button
                  key={pal.id}
                  type="button"
                  className={`faculty-theme-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked-theme' : 'unlocked-theme'}`}
                  style={{
                    '--pal-color': pal.color,
                    '--pal-glow': `${pal.color}40`
                  }}
                  onClick={() => {
                    if (isLocked) {
                      if (onOpenProModal) onOpenProModal();
                      return;
                    }
                    onSelectPalette(pal.id);
                  }}
                  title={isLocked ? 'Disponibile solo con UniPlanner PRO' : `${pal.name} - ${pal.desc}`}
                >
                  <div 
                    className="faculty-color-circle" 
                    style={{ 
                      backgroundColor: pal.color,
                      border: pal.id === 'humanities_white' ? '1.5px solid rgba(255,255,255,0.4)' : pal.id === 'amoled' ? '1.5px solid rgba(255,255,255,0.2)' : 'none',
                      boxShadow: isSelected ? `0 0 14px ${pal.color}` : 'none'
                    }}
                  >
                    <span>{pal.icon}</span>
                  </div>
                  <div className="faculty-theme-info">
                    <strong className="faculty-name">{pal.name}</strong>
                    <span className="faculty-desc">{pal.desc}</span>
                  </div>
                  {isLocked ? (
                    <div className="faculty-pro-lock-badge">
                      <Crown size={12} />
                      <span>PRO</span>
                    </div>
                  ) : !pal.isFree && isPro ? (
                    <div className="faculty-pro-active-badge" title="Sbloccato con PRO">
                      <Crown size={11} />
                    </div>
                  ) : null}
                  {isSelected && !isLocked && (
                    <div className="faculty-check-badge">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="theme-modal-footer">
            <button className="primary-btn theme-done-btn" onClick={onClose}>
              Salva & Applica Tema
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ThemeModal;
