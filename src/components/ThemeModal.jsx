import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check, Moon, Sun } from 'lucide-react';
import './ThemeModal.css';

export const FACULTY_PALETTES = [
  { id: 'default', name: 'UniPlanner Classic', color: '#3b82f6', icon: '🌌', desc: 'Blu Spaziale Moderno' },
  { id: 'engineering', name: 'Ingegneria / Architettura / Tech', color: '#0284c7', icon: '⚙️', desc: 'Ciano Tech & Cobalto' },
  { id: 'medicine', name: 'Medicina / Sanità / Farmacia', color: '#e11d48', icon: '🩺', desc: 'Rosso Rubino & Carmesino' },
  { id: 'economics', name: 'Economia / Finanza / Management', color: '#d97706', icon: '📈', desc: 'Giallo Oro & Ambra' },
  { id: 'law', name: 'Giurisprudenza / Diritto / Legge', color: '#6366f1', icon: '⚖️', desc: 'Indaco Istituzionale & Zaffiro' },
  { id: 'humanities', name: 'Lettere / Filosofia / Lingue', color: '#8b5cf6', icon: '🏛️', desc: 'Viola Ametista Regale' },
  { id: 'science', name: 'Scienze MFN / Biologia / Agraria', color: '#059669', icon: '🔬', desc: 'Verde Smeraldo & Menta' },
  { id: 'politics', name: 'Scienze Politiche / Sociologia', color: '#ea580c', icon: '🌍', desc: 'Arancione Corallo' },
  { id: 'psychology', name: 'Psicologia / Scienze Formazione', color: '#db2777', icon: '🧠', desc: 'Rosa & Fucsia' },
  { id: 'amoled', name: 'AMOLED Pure Black (OLED Eco)', color: '#38bdf8', icon: '🖤', desc: 'Nero Assoluto Batteria' },
];

const ThemeModal = ({ isOpen, onClose, currentPalette, onSelectPalette, theme, onToggleTheme }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
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
                <h3>Colori & Temi Facoltà</h3>
                <p className="theme-header-sub">Scegli la palette della tua facoltà o il tema AMOLED</p>
              </div>
            </div>
            <button className="theme-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Quick Dark/Light Toggle */}
          <div className="theme-mode-row">
            <span className="theme-mode-label">Modalità Aspetto:</span>
            <div className="theme-mode-toggle">
              <button 
                type="button" 
                className={`theme-pill ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme !== 'dark' && onToggleTheme()}
              >
                <Moon size={14} />
                <span>Scura</span>
              </button>
              <button 
                type="button" 
                className={`theme-pill ${theme === 'light' ? 'active' : ''}`}
                onClick={() => theme !== 'light' && onToggleTheme()}
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
              return (
                <button
                  key={pal.id}
                  type="button"
                  className={`faculty-theme-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectPalette(pal.id)}
                >
                  <div 
                    className="faculty-color-circle" 
                    style={{ backgroundColor: pal.color }}
                  >
                    <span>{pal.icon}</span>
                  </div>
                  <div className="faculty-theme-info">
                    <strong className="faculty-name">{pal.name}</strong>
                    <span className="faculty-desc">{pal.desc}</span>
                  </div>
                  {isSelected && (
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
              Salva & Applica
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ThemeModal;
