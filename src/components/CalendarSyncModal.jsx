import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  Smartphone, 
  Globe, 
  Layers, 
  HelpCircle, 
  ShieldCheck, 
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  BookOpen
} from 'lucide-react';
import { getLiveCalendarUrls, downloadIcsFile } from '../utils/calendarGenerator';
import { useAuth } from '../context/AuthContext';
import './CalendarSyncModal.css';

export default function CalendarSyncModal({ 
  isOpen, 
  onClose, 
  schedule = [], 
  exams = [], 
  deadlines = [] 
}) {
  const { currentUser } = useAuth();
  const friendCode = currentUser?.friendCode || 'DEMO123';

  const [copied, setCopied] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState(null); // 'ios' | 'android' | 'mac'
  const [syncOptions, setSyncOptions] = useState({
    includeSchedule: true,
    includeExams: true,
    includeDeadlines: true
  });

  if (!isOpen) return null;

  const { httpsUrl, webcalUrl, googleCalendarUrl } = getLiveCalendarUrls(friendCode);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(httpsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadIcs = () => {
    downloadIcsFile({
      schedule,
      exams,
      deadlines,
      options: syncOptions
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div 
        className="cal-sync-modal glass-panel"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cal-sync-header">
          <div className="cal-icon-halo">
            <CalendarIcon size={24} />
          </div>
          <div>
            <div className="cal-badge-row">
              <span className="cal-badge-live">
                <Sparkles size={12} />
                <span>Live Sync in Tempo Reale</span>
              </span>
              <span className="cal-badge-sub">Zero esportazioni manuali</span>
            </div>
            <h2>Sincronizza con il tuo Calendario</h2>
            <p>
              Le lezioni, gli esami e i cambi d'aula si aggiornano in automatico sull'app Calendario del tuo smartphone e computer.
            </p>
          </div>
          <button type="button" className="cal-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 1-Click Platform Integrations */}
        <div className="cal-platforms-grid">
          {/* Apple Calendar */}
          <a 
            href={webcalUrl} 
            className="cal-platform-card apple-card"
            title="Iscriviti su Apple Calendar"
          >
            <div className="platform-icon-wrap apple">
              <Smartphone size={22} />
            </div>
            <div className="platform-info">
              <strong>Apple Calendar</strong>
              <span>iPhone, iPad & Mac (1-Click)</span>
            </div>
            <ExternalLink size={16} className="platform-arrow" />
          </a>

          {/* Google Calendar */}
          <a 
            href={googleCalendarUrl} 
            target="_blank" 
            rel="noreferrer"
            className="cal-platform-card google-card"
            title="Aggiungi a Google Calendar"
          >
            <div className="platform-icon-wrap google">
              <Globe size={22} />
            </div>
            <div className="platform-info">
              <strong>Google Calendar</strong>
              <span>Android & Browser Web</span>
            </div>
            <ExternalLink size={16} className="platform-arrow" />
          </a>

          {/* Outlook / Windows */}
          <a 
            href={webcalUrl} 
            className="cal-platform-card outlook-card"
            title="Iscriviti su Outlook"
          >
            <div className="platform-icon-wrap outlook">
              <Layers size={22} />
            </div>
            <div className="platform-info">
              <strong>Outlook / PC</strong>
              <span>Windows & Microsoft 365</span>
            </div>
            <ExternalLink size={16} className="platform-arrow" />
          </a>

          {/* Download Offline .ics */}
          <button 
            type="button" 
            className="cal-platform-card download-card"
            onClick={handleDownloadIcs}
            title="Scarica file .ics statico"
          >
            <div className="platform-icon-wrap download">
              <Download size={22} />
            </div>
            <div className="platform-info">
              <strong>Scarica File .ics</strong>
              <span>Esportazione offline singola</span>
            </div>
            <Download size={16} className="platform-arrow" />
          </button>
        </div>

        {/* Live Feed URL Copy Box */}
        <div className="cal-feed-copy-section">
          <label>Il tuo Link di Sottoscrizione Privato (iCalendar):</label>
          <div className="feed-input-group">
            <input 
              type="text" 
              readOnly 
              value={httpsUrl} 
              className="feed-url-input"
            />
            <button 
              type="button" 
              className={`feed-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copiato!' : 'Copia Link'}</span>
            </button>
          </div>
        </div>

        {/* What to include options */}
        <div className="cal-options-row">
          <span className="options-label">Includi nella sincronizzazione:</span>
          <div className="options-checkboxes">
            <label className="checkbox-item">
              <input 
                type="checkbox" 
                checked={syncOptions.includeSchedule}
                onChange={(e) => setSyncOptions(p => ({ ...p, includeSchedule: e.target.checked }))}
              />
              <span>Lezioni Settimanali</span>
            </label>
            <label className="checkbox-item">
              <input 
                type="checkbox" 
                checked={syncOptions.includeExams}
                onChange={(e) => setSyncOptions(p => ({ ...p, includeExams: e.target.checked }))}
              />
              <span>Appelli d'Esame</span>
            </label>
            <label className="checkbox-item">
              <input 
                type="checkbox" 
                checked={syncOptions.includeDeadlines}
                onChange={(e) => setSyncOptions(p => ({ ...p, includeDeadlines: e.target.checked }))}
              />
              <span>Scadenze & Consegne</span>
            </label>
          </div>
        </div>

        {/* Quick Step-by-Step Guides Accordion */}
        <div className="cal-guides-accordion">
          <div className="guide-acc-header" onClick={() => setActiveGuideTab(activeGuideTab === 'ios' ? null : 'ios')}>
            <div className="guide-title-left">
              <Smartphone size={16} />
              <span>Come collegare su iPhone & iPad (iOS)</span>
            </div>
            {activeGuideTab === 'ios' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {activeGuideTab === 'ios' && (
            <div className="guide-acc-content">
              <ol>
                <li>Clicca sul pulsante <strong>"Apple Calendar"</strong> qui sopra dal tuo iPhone, oppure:</li>
                <li>Vai su <em>Impostazioni &gt; Calendario &gt; Account &gt; Aggiungi account &gt; Altro &gt; Aggiungi calendario con sottoscrizione</em>.</li>
                <li>Incolla il tuo link e tocca <strong>Avanti &gt; Salva</strong>.</li>
              </ol>
            </div>
          )}

          <div className="guide-acc-header" onClick={() => setActiveGuideTab(activeGuideTab === 'android' ? null : 'android')}>
            <div className="guide-title-left">
              <Globe size={16} />
              <span>Come collegare su Android / Google Calendar</span>
            </div>
            {activeGuideTab === 'android' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {activeGuideTab === 'android' && (
            <div className="guide-acc-content">
              <ol>
                <li>Clicca sul pulsante <strong>"Google Calendar"</strong> qui sopra, oppure:</li>
                <li>Apri <strong>calendar.google.com</strong> dal browser del computer.</li>
                <li>Nella barra laterale sinistra clicca su <strong>"+"</strong> accanto ad <em>Altri calendari</em> &gt; <strong>Da URL</strong>.</li>
                <li>Incolla il link e tocca <strong>Aggiungi calendario</strong>. Comparirà subito nell'app Google Calendar sul tuo smartphone!</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cal-modal-footer">
          <div className="cal-privacy-badge">
            <ShieldCheck size={14} />
            <span>Feed privato cifrato associato al tuo profilo UniPlanner.</span>
          </div>
          <button type="button" className="primary-btn" onClick={onClose}>
            Fatto
          </button>
        </div>
      </motion.div>
    </div>
  );
}
