import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  School, 
  Calendar, 
  Sparkles, 
  Check, 
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './ProfileOnboardingModal.css';

const ITALIAN_UNIVERSITIES = [
  'Università degli Studi di Padova (UniPD)',
  'Politecnico di Milano (PoliMi)',
  'Sapienza Università di Roma',
  'Alma Mater Studiorum - Università di Bologna (UniBo)',
  'Università degli Studi di Milano (UniMi)',
  'Politecnico di Torino (PoliTo)',
  'Università di Napoli Federico II',
  'Università degli Studi di Firenze (UniFi)',
  'Università di Pisa',
  'Università degli Studi di Torino (UniTo)',
  'Università Cattolica del Sacro Cuore',
  'Università Bocconi',
  'Libera Università di Bolzano',
  'Università degli Studi di Trento',
  'Università degli Studi di Genova',
  'Università degli Studi di Verona',
  'Università di Parma',
  'Università di Catania',
  'Università degli Studi di Palermo',
  'Università Ca\' Foscari Venezia'
];

const DEGREE_SUGGESTIONS = [
  'Ingegneria Informatica',
  'Economia e Commercio (Management)',
  'Medicina e Chirurgia',
  'Scienze e Tecnologie Informatiche',
  'Ingegneria Gestionale',
  'Giurisprudenza',
  'Psicologia Cognitiva e Applicata',
  'Scienze Biologiche / Biotecnologie',
  'Fisica e Astrofisica',
  'Matematica',
  'Architettura e Design',
  'Farmacia e CTF',
  'Scienze della Comunicazione',
  'Scienze Politiche e Relazioni Internazionali',
  'Lettere Moderne e Filosofia'
];

const YEARS_OF_STUDY = [
  '1° Anno (Triennale / Ciclo Unico)',
  '2° Anno (Triennale / Ciclo Unico)',
  '3° Anno (Triennale)',
  '1° Anno Magistrale / Specialistica',
  '2° Anno Magistrale / Specialistica',
  '4° Anno (Ciclo Unico)',
  '5° Anno (Ciclo Unico)',
  '6° Anno (Medicina)',
  'Fuori Corso'
];

export const ProfileOnboardingModal = ({ isOpen, onClose, onComplete }) => {
  const { currentUser, updateProfile } = useAuth();
  
  const [university, setUniversity] = useState(
    currentUser?.university && currentUser.university !== 'Università' 
      ? currentUser.university 
      : ''
  );
  const [degreeCourse, setDegreeCourse] = useState(
    currentUser?.degreeCourse && currentUser.degreeCourse !== 'Corso di Studi' 
      ? currentUser.degreeCourse 
      : ''
  );
  const [studyYear, setStudyYear] = useState('1° Anno (Triennale / Ciclo Unico)');
  const [shareGrades, setShareGrades] = useState(currentUser?.shareGrades !== false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!university.trim()) {
      setErrorMsg('Inserisci la tua università o selezionala dall\'elenco.');
      return;
    }
    if (!degreeCourse.trim()) {
      setErrorMsg('Inserisci il tuo corso di laurea.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const updatedStatus = `Studente ${studyYear.split(' ')[0]} 🎓`;
      await updateProfile({
        university: university.trim(),
        degreeCourse: degreeCourse.trim(),
        status: currentUser?.status && currentUser.status !== 'In sessione 🎯' ? currentUser.status : updatedStatus,
        shareGrades: Boolean(shareGrades)
      });

      localStorage.setItem('uniplanner_onboarding_completed', 'true');
      if (onComplete) onComplete();
      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Errore salvataggio profilo accademico.');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('uniplanner_onboarding_dismissed', 'true');
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      <div className="onboarding-modal-overlay">
        <motion.div 
          className="onboarding-modal-container glass-panel"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="onboarding-header">
            <div className="onboarding-badge">
              <Sparkles size={14} />
              <span>Configurazione Rapida Accademica</span>
            </div>
            <button 
              type="button" 
              className="onboarding-close-btn" 
              onClick={handleDismiss}
              title="Completa più tardi"
            >
              <X size={18} />
            </button>
          </div>

          <div className="onboarding-title-group">
            <h2>Benvenuto su UniPlanner{currentUser?.fullName ? `, ${currentUser.fullName.split(' ')[0]}` : ''}! 🎓</h2>
            <p>
              Hai effettuato l'accesso con Google. Inserisci il tuo ateneo e corso di laurea per configurare al meglio il calcolo della media ponderata, i crediti CFU e l'orario delle lezioni.
            </p>
          </div>

          {errorMsg && (
            <div className="onboarding-error-banner">
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="onboarding-form">
            {/* Università */}
            <div className="onboarding-form-group">
              <label htmlFor="uni-input">
                <School size={16} />
                <span>Università o Ateneo di Appartenenza</span>
              </label>
              <input 
                id="uni-input"
                type="text" 
                list="uni-list"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="Es. Università degli Studi di Padova"
                required
                autoFocus
              />
              <datalist id="uni-list">
                {ITALIAN_UNIVERSITIES.map((u, i) => (
                  <option key={i} value={u} />
                ))}
              </datalist>
            </div>

            {/* Corso di Laurea */}
            <div className="onboarding-form-group">
              <label htmlFor="course-input">
                <GraduationCap size={16} />
                <span>Corso di Laurea</span>
              </label>
              <input 
                id="course-input"
                type="text" 
                list="course-list"
                value={degreeCourse}
                onChange={(e) => setDegreeCourse(e.target.value)}
                placeholder="Es. Ingegneria Informatica, Economia..."
                required
              />
              <datalist id="course-list">
                {DEGREE_SUGGESTIONS.map((d, i) => (
                  <option key={i} value={d} />
                ))}
              </datalist>
            </div>

            {/* Anno di Corso */}
            <div className="onboarding-form-group">
              <label htmlFor="year-select">
                <Calendar size={16} />
                <span>Anno di Corso Attuale</span>
              </label>
              <select 
                id="year-select"
                value={studyYear}
                onChange={(e) => setStudyYear(e.target.value)}
              >
                {YEARS_OF_STUDY.map((y, i) => (
                  <option key={i} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Privacy Voti */}
            <div className="onboarding-privacy-toggle" onClick={() => setShareGrades(!shareGrades)}>
              <div className="toggle-checkbox-custom">
                <input 
                  type="checkbox" 
                  checked={shareGrades} 
                  onChange={(e) => setShareGrades(e.target.checked)} 
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="toggle-text">
                <strong>Condividi voti e media con gli compagni di corso</strong>
                <span>Potrai visualizzare i voti dei tuoi amici e loro potranno vedere i tuoi (puoi modificarlo in ogni momento dal profilo).</span>
              </div>
            </div>

            <div className="onboarding-actions">
              <button 
                type="button" 
                className="onboarding-skip-btn ghost-btn" 
                onClick={handleDismiss}
                disabled={saving}
              >
                <span>Completa più tardi</span>
              </button>
              <button 
                type="submit" 
                className="onboarding-submit-btn primary-btn" 
                disabled={saving}
              >
                {saving ? (
                  <span>Salvataggio...</span>
                ) : (
                  <>
                    <span>Salva e Inizia</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="onboarding-footer-note">
            <ShieldCheck size={14} />
            <span>I tuoi dati accademici sono crittografati e conformi al GDPR. Nessuna condivisione con terze parti.</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
