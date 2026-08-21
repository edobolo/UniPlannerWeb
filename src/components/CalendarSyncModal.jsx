import React, { useState, useEffect } from 'react';
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
  BookOpen,
  RefreshCw,
  Info
} from 'lucide-react';
import { getLiveCalendarUrls, downloadIcsFile } from '../utils/calendarGenerator';
import { publishUserProfile } from '../utils/cloudSync';
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
  
  // Ottieni o genera codice amico sicuro
  const [friendCode] = useState(() => {
    if (currentUser?.friendCode) return currentUser.friendCode;
    let saved = localStorage.getItem('uniplanner_guest_sync_code');
    if (!saved) {
      saved = 'UP_' + Math.random().toString(36).substring(2, 7).toUpperCase();
      localStorage.setItem('uniplanner_guest_sync_code', saved);
    }
    return saved;
  });

  const [copied, setCopied] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState(null); // 'ios' | 'android'
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncOptions, setSyncOptions] = useState({
    includeSchedule: true,
    includeExams: true,
    includeDeadlines: true
  });

  // Pubblica in automatico le lezioni e gli esami sul cloud non appena si apre il modal
  const syncToCloud = async () => {
    if (!friendCode) return;
    setIsCloudSyncing(true);
    const userToSync = currentUser || {
      friendCode: friendCode,
      username: 'Studente',
      fullName: 'Studente UniPlanner'
    };

    try {
      const ok = await publishUserProfile(userToSync, schedule, exams, deadlines);
      if (ok) setSyncSuccess(true);
    } catch (e) {
      console.warn('Errore sync cloud:', e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      syncToCloud();
    }
  }, [isOpen, friendCode, schedule, exams, deadlines]);

  if (!isOpen) return null;

  const { httpsUrl, webcalUrl, googleCalendarUrl } = getLiveCalendarUrls(friendCode);

  const handleCopyLink = async () => {
    await syncToCloud();
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

  const handleOpenGoogleCalendar = async (e) => {
    e.preventDefault();
    await syncToCloud();
    window.open(googleCalendarUrl, '_blank');
  };

  const handleOpenAppleCalendar = async (e) => {
    e.preventDefault();
    await syncToCloud();
    window.location.href = webcalUrl;
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
              <span className="cal-badge-sub">
                {isCloudSyncing ? 'Sincronizzazione orario in corso...' : `${schedule.length} lezioni collegate (${friendCode})`}
              </span>
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
          <div 
            className="cal-platform-card apple-card"
            onClick={handleOpenAppleCalendar}
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
          </div>

          {/* Google Calendar */}
          <div 
            className="cal-platform-card google-card"
            onClick={handleOpenGoogleCalendar}
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
          </div>

          {/* Outlook / Windows */}
          <div 
            className="cal-platform-card outlook-card"
            onClick={handleOpenAppleCalendar}
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
          </div>

          {/* Download Offline .ics */}
          <button 
            type="button" 
            className="cal-platform-card download-card"
            onClick={handleDownloadIcs}
            title="Scarica file .ics statico con tutte le lezioni"
          >
            <div className="platform-icon-wrap download">
              <Download size={22} />
            </div>
            <div className="platform-info">
              <strong>Scarica File .ics</strong>
              <span>Importazione istantanea senza link</span>
            </div>
            <Download size={16} className="platform-arrow" />
          </button>
        </div>

        {/* Live Feed URL Copy Box */}
        <div className="cal-feed-copy-section">
          <div className="feed-header-row">
            <label>Il tuo Link di Sottoscrizione (.ics):</label>
            <button 
              type="button" 
              className="refresh-feed-btn"
              onClick={syncToCloud}
              disabled={isCloudSyncing}
              title="Forza aggiornamento dati sul cloud"
            >
              <RefreshCw size={12} className={isCloudSyncing ? 'spinner-icon' : ''} />
              <span>{isCloudSyncing ? 'Aggiornamento...' : 'Ricarica Dati Cloud'}</span>
            </button>
          </div>
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
              <span>Lezioni Settimanali ({schedule.length})</span>
            </label>
            <label className="checkbox-item">
              <input 
                type="checkbox" 
                checked={syncOptions.includeExams}
                onChange={(e) => setSyncOptions(p => ({ ...p, includeExams: e.target.checked }))}
              />
              <span>Appelli d'Esame ({exams.length})</span>
            </label>
            <label className="checkbox-item">
              <input 
                type="checkbox" 
                checked={syncOptions.includeDeadlines}
                onChange={(e) => setSyncOptions(p => ({ ...p, includeDeadlines: e.target.checked }))}
              />
              <span>Scadenze & Consegne ({deadlines.length})</span>
            </label>
          </div>
        </div>

        {/* Quick Step-by-Step Guides Accordion (Formattazione Pulita e Chiara) */}
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
                <li>Clicca sul riquadro <strong>"Apple Calendar"</strong> qui sopra dal tuo iPhone (apre direttamente l'app Calendario con la richiesta di iscrizione).</li>
                <li>Oppure apri l'app <em>Impostazioni &gt; Calendario &gt; Account &gt; Aggiungi account &gt; Altro &gt; Aggiungi calendario con sottoscrizione</em> e incolla il link.</li>
                <li>Tocca <strong>Salva</strong>: il calendario rimarrà sincronizzato in tempo reale con i cambi d'aula e orari!</li>
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
                <li>Clicca sul riquadro <strong>"Google Calendar"</strong> qui sopra e premi su <strong>"Aggiungi"</strong>.</li>
                <li>In alternativa, dal computer: apri <em>calendar.google.com</em> &gt; nella barra laterale sinistra clicca su <strong>"+"</strong> (accanto ad <em>Altri calendari</em>) &gt; <strong>Da URL</strong> &gt; incolla il link copiato.</li>
                <li>Tutte le tue lezioni settimanali compariranno sia su computer che nell'app Google Calendar sul tuo smartphone Android!</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cal-modal-footer">
          <div className="cal-privacy-badge">
            <ShieldCheck size={14} />
            <span>Feed privato cifrato associato al tuo profilo ({friendCode}).</span>
          </div>
          <button type="button" className="primary-btn" onClick={onClose}>
            Fatto
          </button>
        </div>
      </motion.div>
    </div>
  );
}
