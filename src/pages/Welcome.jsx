import React from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  TrendingUp, 
  CalendarDays, 
  Calendar, 
  Clock, 
  Users, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Download, 
  Monitor, 
  Award, 
  CheckCircle2, 
  Layers, 
  Zap,
  GraduationCap,
  Scale,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Welcome.css';

const Welcome = ({ onNavigate, onOpenDownload, onOpenLegal }) => {
  const { currentUser, setIsAuthModalOpen, setAuthModalTab } = useAuth();
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  const features = [
    {
      id: 'esami',
      icon: BookOpen,
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.15))',
      borderColor: 'rgba(139, 92, 246, 0.35)',
      title: 'Piano di Studi & CFU',
      desc: 'Organizza i tuoi esami per anno e semestre. Tieni traccia dei CFU acquisiti e monitora il tuo avanzamento accademico in tempo reale.'
    },
    {
      id: 'voti',
      icon: TrendingUp,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(14, 165, 233, 0.15))',
      borderColor: 'rgba(59, 130, 246, 0.35)',
      title: 'Statistiche & Medie',
      desc: 'Calcola all\'istante media ponderata e aritmetica, proietta il tuo voto di laurea e visualizza grafici dettagliati sull\'andamento.'
    },
    {
      id: 'orario',
      icon: CalendarDays,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      title: 'Orario & Calendario Settimanale',
      desc: 'Griglia settimanale dinamica con indicatore ora attuale in tempo reale, aule e docenti. Importa gli orari universitari da file XLS o ICS.'
    },
    {
      id: 'pomodoro',
      icon: Clock,
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(244, 63, 94, 0.15))',
      borderColor: 'rgba(236, 72, 153, 0.35)',
      title: 'Timer Focus Pomodoro',
      desc: 'Massimizza la produttività con cicli studio/pausa personalizzabili, audio binaurale rilassante e statistiche sulle sessioni completate.'
    },
    {
      id: 'scadenze',
      icon: Calendar,
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))',
      borderColor: 'rgba(245, 158, 11, 0.35)',
      title: 'Scadenze & Appelli',
      desc: 'Non perdere mai una consegna o un\'iscrizione all\'appello. Ricevi promemoria ordinati per urgenza e priorità visiva.'
    },
    {
      id: 'amici',
      title: 'Social & Orari Compagni di Corso',
      desc: 'Connettiti con i tuoi amici con un link di invito diretto: confronta i piani di studio e scopri quando siete liberi per studiare insieme.',
      icon: Users,
      color: '#ec4899'
    }
  ];

  const highlights = [
    { text: 'Conforme GDPR UE 2016/679', icon: ShieldCheck },
    { text: 'Funzionamento anche Offline', icon: Zap },
    { text: 'Zero Pubblicità o Tracciamento', icon: CheckCircle2 },
    { text: 'Disponibile per Android (.apk) & Windows', icon: Smartphone },
  ];

  const handleStart = () => {
    localStorage.setItem('uniplanner_welcome_seen', 'true');
    if (onNavigate) {
      onNavigate('esami');
    }
  };

  const handleCardClick = (id) => {
    localStorage.setItem('uniplanner_welcome_seen', 'true');
    if (onNavigate) {
      onNavigate(id);
    }
  };

  const handleAccountClick = () => {
    setAuthModalTab('register');
    setIsAuthModalOpen(true);
  };

  return (
    <div className="welcome-page">
      {/* Top Bar with Skip/Dismiss */}
      <div className="welcome-top-nav">
        <div className="welcome-top-left">
          <div className="welcome-mini-logo">UP</div>
          <span className="welcome-brand">UniPlanner</span>
        </div>
        <button 
          className="welcome-skip-btn"
          onClick={handleStart}
          title="Chiudi guida ed entra nell'app"
        >
          <span>Vai all'App</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* HERO SECTION */}
      <section className="welcome-hero">
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />

        <motion.div 
          className="welcome-hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated Logo Container */}
          <div className="animated-logo-wrapper">
            <motion.div 
              className="logo-pulse-ring"
              animate={{ 
                scale: [1, 1.15, 1],
                opacity: [0.35, 0.7, 0.35]
              }}
              transition={{ 
                duration: 3.5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            />
            <motion.div 
              className="logo-pulse-ring-inner"
              animate={{ 
                scale: [1.1, 0.95, 1.1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ 
                duration: 2.5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            />
            <motion.div 
              className="welcome-main-logo"
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="logo-letters">UP</span>
              <div className="logo-shine-effect" />
            </motion.div>
          </div>

          {/* Hero Badge */}
          <motion.div 
            className="welcome-badge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <Sparkles size={15} className="sparkle-icon" />
            <span>La piattaforma all-in-one per universitari</span>
          </motion.div>

          {/* Hero Title & Subtitle */}
          <motion.h1 
            className="welcome-title"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
          >
            Organizza il tuo percorso accademico con <span className="title-gradient">stile e precisione</span>.
          </motion.h1>

          <motion.p 
            className="welcome-subtitle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.45 }}
          >
            Tieni traccia di esami, calcola la media, importa gli orari delle lezioni, sincronizzati con gli amici e massimizza la tua concentrazione con il timer integrato.
          </motion.p>

          {/* Action CTAs */}
          <motion.div 
            className="welcome-actions"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.45 }}
          >
            <button className="primary-btn hero-main-btn" onClick={handleStart}>
              <span>Inizia Ora</span>
              <ArrowRight size={18} />
            </button>

            {!currentUser && (
              <button className="secondary-btn hero-sec-btn" onClick={handleAccountClick}>
                <GraduationCap size={18} />
                <span>Crea Account Studente</span>
              </button>
            )}

            {!isElectron && onOpenDownload && (
              <button className="ghost-btn hero-download-btn" onClick={onOpenDownload}>
                <Download size={17} />
                <span>Scarica App (Android / PC)</span>
              </button>
            )}
          </motion.div>

          {/* Highlights row */}
          <motion.div 
            className="welcome-highlights-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
          >
            {highlights.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="highlight-pill">
                  <Icon size={14} className="highlight-icon" />
                  <span>{item.text}</span>
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* FEATURES GRID SECTION */}
      <section className="welcome-features-section">
        <div className="section-header">
          <h2>Tutto ciò di cui hai bisogno in un unico posto</h2>
          <p>Seleziona uno strumento per scoprirlo subito</p>
        </div>

        <div className="features-grid">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div 
                key={item.id} 
                className="feature-card glass-panel"
                style={{ 
                  '--card-accent': item.color 
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08, duration: 0.4 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => handleCardClick(item.id)}
              >
                <div className="feature-icon-box" style={{ background: item.color }}>
                  <Icon size={22} color="white" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <div className="feature-card-arrow" style={{ color: item.color }}>
                  <span>Apri sezione</span>
                  <ArrowRight size={14} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Floating Interactive Preview Strip */}
      <motion.section 
        className="welcome-preview-strip glass-panel"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.65, duration: 0.4 }}
      >
        <div className="preview-content">
          <div className="preview-icon">
            <Award size={28} />
          </div>
          <div>
            <h3>Pronto a raggiungere il massimo dei voti?</h3>
            <p>Carica il tuo piano di studi, segna i primi appelli e sincronizza l’orario con i compagni di corso.</p>
          </div>
        </div>
        <button className="primary-btn preview-cta-btn" onClick={handleStart}>
          <span>Vai al Piano di Studi</span>
          <ArrowRight size={17} />
        </button>
      </motion.section>

      {/* LEGAL & COMPLIANCE FOOTER */}
      <footer className="welcome-legal-footer">
        <div className="legal-footer-inner">
          <div className="legal-footer-brand">
            <span className="footer-badge">100% Indipendente & Gratuito</span>
            <p className="footer-disclaimer-text">
              UniPlanner è un progetto autonomo per studenti universitari e non è affiliato ufficialmente con gli atenei citati. Conforme al GDPR (UE 2016/679).
            </p>
          </div>

          {onOpenLegal && (
            <div className="legal-footer-links">
              <button type="button" className="legal-footer-link" onClick={() => onOpenLegal('privacy')}>
                <ShieldCheck size={13} />
                <span>Informativa Privacy</span>
              </button>
              <button type="button" className="legal-footer-link" onClick={() => onOpenLegal('terms')}>
                <Scale size={13} />
                <span>Termini & Disclaimer</span>
              </button>
              <button type="button" className="legal-footer-link" onClick={() => onOpenLegal('cookies')}>
                <span>Cookie & Storage</span>
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default Welcome;
