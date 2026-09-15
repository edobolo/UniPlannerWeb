import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Award, 
  CheckCircle2, 
  Zap, 
  GraduationCap, 
  Scale, 
  Smartphone, 
  Check, 
  Bot, 
  Crown, 
  ChevronRight, 
  User, 
  LogIn, 
  Lock,
  Layers,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Welcome.css';

const Welcome = ({ onNavigate, onOpenDownload, onOpenLegal, onOpenPro }) => {
  const { currentUser, setIsAuthModalOpen, setAuthModalTab, loginWithGoogle } = useAuth();
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  const [activePreviewTab, setActivePreviewTab] = useState('esami');

  const features = [
    {
      id: 'esami',
      icon: BookOpen,
      color: '#8b5cf6',
      title: 'Piano di Studi & CFU',
      desc: 'Organizza i tuoi esami per anno e semestre. Tieni traccia dei crediti acquisiti rispetto all\'obiettivo e gestisci pesi e propedeuticità.'
    },
    {
      id: 'voti',
      icon: TrendingUp,
      color: '#3b82f6',
      title: 'Statistiche & Medie',
      desc: 'Calcola all\'istante media ponderata e aritmetica, proietta il tuo voto di laurea e visualizza grafici dettagliati sull\'andamento temporale.'
    },
    {
      id: 'orario',
      icon: CalendarDays,
      color: '#10b981',
      title: 'Orario & Calendario Lezioni',
      desc: 'Griglia oraria dinamica con indicatore in tempo reale della lezione in corso, aule e docenti. Import rapido da file XLS o ICS del tuo ateneo.'
    },
    {
      id: 'ai-assistant',
      icon: Bot,
      color: '#06b6d4',
      title: 'AI Study Assistant',
      desc: 'Tutor accademico potenziato da Google Gemini Flash: richiedi riassunti di concetti complessi, genera quiz di verifica e flashcard per preparare gli esami.'
    },
    {
      id: 'pomodoro',
      icon: Clock,
      color: '#ec4899',
      title: 'Timer Focus Pomodoro',
      desc: 'Massimizza la concentrazione con cicli studio/pausa personalizzabili, rumori di fondo e audio binaurale rilassante per sessioni senza distrazioni.'
    },
    {
      id: 'scadenze',
      icon: Calendar,
      color: '#f59e0b',
      title: 'Scadenze & Appelli',
      desc: 'Non perdere mai una consegna o un\'iscrizione all\'appello. Promemoria ordinati per urgenza, scadenziario visuale e countdown ai giorni d\'esame.'
    },
    {
      id: 'amici',
      icon: Users,
      color: '#6366f1',
      title: 'Social & Compagni di Corso',
      desc: 'Connettiti con i colleghi tramite link d\'invito: confronta piani di studio, visualizza orari compatibili e organizza sessioni di studio condivise.'
    }
  ];

  const pricingPlans = [
    {
      id: 'free',
      name: 'Base',
      badge: 'Gratuito',
      price: '0 €',
      period: 'per sempre',
      description: 'Tutto il necessario per organizzare il tuo percorso accademico.',
      features: [
        'Gestione completa Piano di Studi & CFU',
        'Calcolo Media Ponderata e Aritmetica',
        'Orario Settimanale & Calendario',
        'Timer Focus Pomodoro con suoni ambientali',
        'Accesso completo Web & PWA Mobile',
        'Zero annunci o tracciamento commerciale'
      ],
      isPopular: false,
      ctaText: 'Inizia Gratis',
      isPro: false
    },
    {
      id: 'monthly',
      priceId: 'price_1U9AixGfd5kpnWkPoYGqB8p2',
      name: 'Mensile ✨',
      badge: 'Flessibile',
      price: '1,99 €',
      period: '/ mese',
      subtext: 'Disdici in 1 clic senza vincoli',
      description: 'Il piano ideale per superare la sessione d\'esami con la massima flessibilità.',
      features: [
        'Tutte le funzionalità del piano Base',
        'AI Study Assistant Illimitato (Groq & Gemini Flash)',
        'Simulatore Avanzato Laurea & Calcolo Scarto CFU (110L)',
        'Statistiche Accademiche & Grafici Illimitati',
        'Temi & Palette Accademiche Esclusive per Facoltà',
        'Sincronizzazione Cloud Crittografata Prioritaria'
      ],
      isPopular: false,
      ctaText: 'Scegli Mensile',
      isPro: true
    },
    {
      id: 'yearly',
      priceId: 'price_1U9AixGfd5kpnWkPleI7MBq9',
      name: 'Annuale 🎓',
      badge: 'Più Scelto • Risparmi il 58%',
      price: '9,99 €',
      period: '/ anno',
      subtext: 'Solo ~0,83 € al mese • Prezzo Bloccato',
      description: 'Tutto il tuo anno accademico al massimo livello con oltre il 58% di risparmio.',
      features: [
        'Tutto ciò che è incluso nel piano Mensile',
        '365 giorni di accesso completo a prezzo bloccato',
        'Generazione kit d\'esame, riassunti e quiz con IA',
        'Badge dorato PRO verificato nel profilo e amici',
        'Import avanzato orari da file atenei (XLS, CSV, ICS)',
        'Archivio appunti e note con backup orario continuo',
        'Supporto accademico prioritario per tutto l\'anno'
      ],
      isPopular: true,
      ctaText: 'Scegli Annuale',
      isPro: true
    },
    {
      id: 'founder',
      priceId: 'price_1U9Aj2Gfd5kpnWkPU7bgOY6o',
      name: "Founder's Edition 🚀",
      badge: 'Best Value • Accesso a Vita',
      price: '19,99 €',
      period: 'una tantum',
      subtext: 'Un solo pagamento, nessun abbonamento mai più',
      description: 'Accesso illimitato per sempre per tutta la tua carriera universitaria (Triennale, Magistrale e Master).',
      features: [
        'Accesso Illimitato a VITA (Triennale, Magistrale, Master)',
        'Zero canoni ricorrenti: paghi una volta sola per sempre',
        'Badge esclusivo dorato "Founder" permanente sul profilo',
        'Accesso anticipato (Early Access) ai nuovi modelli AI',
        'Cloud RLS prioritario illimitato con zero perdita dati',
        'Canale prioritario VIP diretto con gli sviluppatori',
        'Tutti i futuri aggiornamenti PRO inclusi automaticamente'
      ],
      isPopular: false,
      ctaText: "Ottieni Founder's Edition",
      isPro: true
    }
  ];

  const highlights = [
    { text: 'Conforme GDPR (UE 2016/679)', icon: ShieldCheck },
    { text: 'Funzionamento anche Offline', icon: Zap },
    { text: 'Zero Pubblicità o Tracciamento', icon: CheckCircle2 },
    { text: 'Sincronizzazione Cloud Sicura', icon: Lock },
    { text: 'Web & Android APK', icon: Smartphone }
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

  const handleLoginClick = () => {
    setAuthModalTab('login');
    setIsAuthModalOpen(true);
  };

  const handleRegisterClick = () => {
    setAuthModalTab('register');
    setIsAuthModalOpen(true);
  };

  const handleGoogleSignIn = () => {
    setAuthModalTab('google');
    setIsAuthModalOpen(true);
  };

  const handlePlanAction = (plan) => {
    if (plan.isPro) {
      if (onOpenPro) {
        onOpenPro(plan.priceId);
      } else {
        handleRegisterClick();
      }
    } else {
      handleStart();
    }
  };

  return (
    <div className="welcome-page">
      {/* 1. TOP NAVBAR */}
      <header className="welcome-top-nav">
        <div className="welcome-top-left">
          <div className="welcome-mini-logo">UP</div>
          <span className="welcome-brand">UniPlanner</span>
          <span className="welcome-ai-badge">
            <Sparkles size={11} />
            <span>Powered by AI</span>
          </span>
        </div>

        <nav className="welcome-nav-links">
          <a href="#features" className="nav-anchor-link">Funzionalità</a>
          <a href="#preview" className="nav-anchor-link">Anteprima</a>
          <a href="#prezzi" className="nav-anchor-link">Piani & Prezzi</a>
          <a href="#sicurezza" className="nav-anchor-link">Sicurezza</a>
        </nav>

        <div className="welcome-top-right">
          {currentUser ? (
            <button 
              className="welcome-user-btn"
              onClick={() => setIsAuthModalOpen(true)}
              title="Apri impostazioni profilo"
            >
              <User size={15} />
              <span>{currentUser.fullName || currentUser.username}</span>
            </button>
          ) : (
            <div className="welcome-auth-group">
              <button 
                type="button" 
                className="welcome-text-btn"
                onClick={handleLoginClick}
              >
                <LogIn size={15} />
                <span>Accedi</span>
              </button>
              <button 
                type="button" 
                className="welcome-primary-pill-btn"
                onClick={handleRegisterClick}
              >
                <span>Registrati Gratis</span>
              </button>
            </div>
          )}

          <button 
            type="button"
            className="welcome-skip-btn"
            onClick={handleStart}
            title="Accedi all'applicazione"
          >
            <span>Vai all'App</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="welcome-hero">
        <motion.div 
          className="welcome-hero-content"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Eyebrow Badge */}
          <div className="welcome-badge">
            <Sparkles size={14} className="sparkle-icon" />
            <span>L'Hub Accademico Definitivo • Powered by AI</span>
          </div>

          {/* Headline */}
          <h1 className="welcome-title">
            Organizza i tuoi esami, orari e medie con <span className="title-gradient">eccellenza e precisione</span>.
          </h1>

          {/* Subtitle */}
          <p className="welcome-subtitle">
            UniPlanner è la piattaforma unificata per affrontare la sessione d'esami senza stress: 
            piano di studi, calcolo media ponderata e proiezione di laurea, calendario lezioni dinamico, 
            timer pomodoro e tutor AI integrato.
          </p>

          {/* Primary Action Buttons */}
          <div className="welcome-hero-actions">
            <button className="primary-btn hero-main-btn" onClick={handleStart}>
              <span>Inizia Subito Gratis</span>
              <ArrowRight size={17} />
            </button>

            {!currentUser && (
              <button 
                type="button" 
                className="google-hero-btn"
                onClick={handleGoogleSignIn}
                title="Accedi o registrati subito con Google"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" className="google-icon">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Continua con Google</span>
              </button>
            )}

            {!isElectron && onOpenDownload && (
              <button className="ghost-btn hero-download-btn" onClick={onOpenDownload}>
                <Download size={16} />
                <span>Scarica App (Android / PC)</span>
              </button>
            )}
          </div>

          {/* Floating Live Badges row */}
          <div className="hero-floating-badges">
            <div className="floating-stat-pill">
              <Award size={14} style={{ color: '#8b5cf6' }} />
              <span>180 CFU • Tracciamento Obiettivi</span>
            </div>
            <div className="floating-stat-pill">
              <TrendingUp size={14} style={{ color: '#10b981' }} />
              <span>Media Ponderata 28.5 / 30</span>
            </div>
            <div className="floating-stat-pill">
              <Calendar size={14} style={{ color: '#f59e0b' }} />
              <span>Prossimo Appello: 18 Luglio</span>
            </div>
            <div className="floating-stat-pill">
              <Clock size={14} style={{ color: '#ec4899' }} />
              <span>Focus Pomodoro: 45 min</span>
            </div>
          </div>
        </motion.div>

        {/* 3. INTERACTIVE LIVE DEMO PREVIEW (uniplanner.ai style) */}
        <div id="preview" className="hero-interactive-showcase">
          <div className="showcase-window glass-panel">
            <div className="showcase-header">
              <div className="window-dots">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>
              <div className="showcase-tabs-switch">
                <button 
                  className={`showcase-tab-btn ${activePreviewTab === 'esami' ? 'active' : ''}`}
                  onClick={() => setActivePreviewTab('esami')}
                >
                  <BookOpen size={14} />
                  <span>Piano di Studi & Medie</span>
                </button>
                <button 
                  className={`showcase-tab-btn ${activePreviewTab === 'orario' ? 'active' : ''}`}
                  onClick={() => setActivePreviewTab('orario')}
                >
                  <CalendarDays size={14} />
                  <span>Orario Dinamico</span>
                </button>
                <button 
                  className={`showcase-tab-btn ${activePreviewTab === 'ai' ? 'active' : ''}`}
                  onClick={() => setActivePreviewTab('ai')}
                >
                  <Bot size={14} />
                  <span>AI Tutor Studio</span>
                </button>
              </div>
            </div>

            <div className="showcase-body">
              <AnimatePresence mode="wait">
                {activePreviewTab === 'esami' && (
                  <motion.div 
                    key="tab-esami"
                    className="preview-tab-content"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="preview-stat-cards-grid">
                      <div className="preview-stat-card">
                        <span className="card-label">CFU Conseguiti</span>
                        <div className="card-big-value">132 <small>/ 180</small></div>
                        <div className="preview-progress-track">
                          <div className="preview-progress-fill" style={{ width: '73.3%' }}></div>
                        </div>
                        <span className="card-subtext">73.3% del percorso completato</span>
                      </div>

                      <div className="preview-stat-card">
                        <span className="card-label">Media Ponderata</span>
                        <div className="card-big-value" style={{ color: 'var(--success)' }}>28.54 <small>/ 30</small></div>
                        <span className="card-subtext">Voto di Laurea stimato: <strong>104.6 / 110</strong></span>
                      </div>

                      <div className="preview-stat-card">
                        <span className="card-label">Sessione Estiva</span>
                        <div className="card-big-value" style={{ color: 'var(--accent-primary)' }}>3 Esami</div>
                        <span className="card-subtext">Prossimo tra 8 giorni</span>
                      </div>
                    </div>

                    <div className="preview-exams-list">
                      <div className="preview-exam-item">
                        <div className="exam-info">
                          <strong>Analisi Matematica 2</strong>
                          <span>Anno II • Semestre 1 • 9 CFU</span>
                        </div>
                        <span className="exam-badge-grade badge-excellent">30 e Lode</span>
                      </div>
                      <div className="preview-exam-item">
                        <div className="exam-info">
                          <strong>Sistemi Operativi</strong>
                          <span>Anno II • Semestre 2 • 9 CFU</span>
                        </div>
                        <span className="exam-badge-grade badge-great">29 / 30</span>
                      </div>
                      <div className="preview-exam-item pending">
                        <div className="exam-info">
                          <strong>Ingegneria del Software</strong>
                          <span>Anno III • Semestre 1 • 12 CFU</span>
                        </div>
                        <span className="exam-badge-grade badge-pending">In Preparazione</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePreviewTab === 'orario' && (
                  <motion.div 
                    key="tab-orario"
                    className="preview-tab-content"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="preview-schedule-day">
                      <div className="schedule-day-header">
                        <strong>Oggi: Mercoledì Accademico</strong>
                        <span className="schedule-live-indicator">
                          <span className="live-dot"></span> Lezione in Corso
                        </span>
                      </div>

                      <div className="schedule-timeline">
                        <div className="schedule-slot-item current">
                          <div className="time-badge">09:00 - 11:00</div>
                          <div className="slot-details">
                            <strong>Algoritmi e Strutture Dati</strong>
                            <span>Aula 2B • Prof. Rossi • Presenza</span>
                          </div>
                          <span className="slot-badge live">Iniziata da 40 min</span>
                        </div>

                        <div className="schedule-slot-item">
                          <div className="time-badge">11:30 - 13:30</div>
                          <div className="slot-details">
                            <strong>Architettura degli Elaboratori</strong>
                            <span>Aula Magna • Prof. Bianchi</span>
                          </div>
                          <span className="slot-badge">Prossima</span>
                        </div>

                        <div className="schedule-slot-item">
                          <div className="time-badge">15:00 - 18:00</div>
                          <div className="slot-details">
                            <strong>Gruppo di Studio con Compagni di Corso</strong>
                            <span>Biblioteca Centrale • Sala Studio 3</span>
                          </div>
                          <span className="slot-badge">Focus</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePreviewTab === 'ai' && (
                  <motion.div 
                    key="tab-ai"
                    className="preview-tab-content"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="preview-ai-dialog">
                      <div className="ai-chat-bubble user">
                        <User size={14} />
                        <div>
                          <strong>Studente:</strong>
                          <p>Puoi sintetizzarmi la differenza tra Processi e Thread in 3 punti chiave per l'orale di domani?</p>
                        </div>
                      </div>

                      <div className="ai-chat-bubble bot">
                        <Bot size={15} style={{ color: 'var(--accent-primary)' }} />
                        <div>
                          <strong>UniPlanner AI Tutor (Gemini Flash):</strong>
                          <p>Ecco la sintesi concettuale ad alto impatto per l'esame:</p>
                          <ol>
                            <li><strong>Spazio di Indirizzamento:</strong> I processi hanno memoria isolata; i thread condividono il medesimo spazio d'indirizzamento del processo padre.</li>
                            <li><strong>Overhead di Context Switch:</strong> Il cambio di contesto tra thread è molto più rapido poiché non richiede la ricarica della tabella delle pagine (TLB).</li>
                            <li><strong>Comunicazione (IPC):</strong> I thread comunicano direttamente via memoria condivisa, mentre i processi richiedono pipe, socket o shared memory esplicita.</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="showcase-footer">
              <span>Vuoi testare queste funzionalità sul tuo piano di studi?</span>
              <button className="primary-btn showcase-try-btn" onClick={handleStart}>
                <span>Prova Subito Gratis</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HIGHLIGHTS STRIP */}
      <section className="welcome-highlights-section">
        <div className="highlights-row">
          {highlights.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="highlight-pill">
                <Icon size={14} className="highlight-icon" />
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. ALL 7 FEATURES GRID */}
      <section id="features" className="welcome-features-section">
        <div className="section-header">
          <div className="section-eyebrow">Funzionalità Complete</div>
          <h2>Tutto ciò di cui hai bisogno per eccellere</h2>
          <p>Uno strumento specializzato per ogni fase della tua carriera universitaria</p>
        </div>

        <div className="features-grid">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div 
                key={item.id} 
                className="feature-card glass-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.05, duration: 0.35 }}
                whileHover={{ y: -4 }}
                onClick={() => handleCardClick(item.id)}
              >
                <div className="feature-icon-box" style={{ background: item.color }}>
                  <Icon size={22} color="white" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <div className="feature-card-arrow" style={{ color: item.color }}>
                  <span>Esplora strumento</span>
                  <ArrowRight size={14} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 6. PRICING TABLE (uniplanner.ai style & Screenshot 2) */}
      <section id="prezzi" className="welcome-pricing-section">
        <div className="section-header">
          <div className="section-eyebrow">Piani & Trasparenza</div>
          <h2>Scegli il piano ideale per i tuoi studi</h2>
          <p>Investi sul tuo metodo di studio. Nessun costo nascosto, cancellazione immediata in 1 clic.</p>
        </div>

        <div className="welcome-pricing-grid">
          {pricingPlans.map((plan) => (
            <div 
              key={plan.id} 
              className={`pricing-tier-card glass-panel ${plan.isPopular ? 'popular-tier' : ''}`}
            >
              {plan.isPopular && (
                <div className="pricing-tier-popular-ribbon">
                  <Star size={12} fill="currentColor" />
                  <span>{plan.badge}</span>
                </div>
              )}

              <div className="pricing-tier-header">
                {!plan.isPopular && plan.badge && (
                  <span className="pricing-tier-badge">{plan.badge}</span>
                )}
                <h3 className="pricing-tier-title">{plan.name}</h3>
                <div className="pricing-tier-price-row">
                  <span className="pricing-tier-amount">{plan.price}</span>
                  <span className="pricing-tier-period">{plan.period}</span>
                </div>
                {plan.subtext && <div className="pricing-tier-subtext">{plan.subtext}</div>}
                <p className="pricing-tier-desc">{plan.description}</p>
              </div>

              <div className="pricing-tier-features-list">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="pricing-tier-feature-row">
                    <Check size={16} className="tier-check-icon" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <button 
                type="button"
                className={`pricing-tier-cta-btn ${plan.isPopular ? 'primary-btn' : 'secondary-btn'}`}
                onClick={() => handlePlanAction(plan)}
              >
                <span>{plan.ctaText}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="pricing-guarantees">
          <div className="guarantee-item">
            <Lock size={15} />
            <span>Pagamenti crittografati sicuri con Stripe</span>
          </div>
          <div className="guarantee-item">
            <CheckCircle2 size={15} />
            <span>Nessun vincolo contrattuale, disdici quando vuoi</span>
          </div>
          <div className="guarantee-item">
            <ShieldCheck size={15} />
            <span>Garanzia rimborso 14 giorni per studenti</span>
          </div>
        </div>
      </section>

      {/* 7. SECURITY & GDPR SECTION */}
      <section id="sicurezza" className="welcome-security-section glass-panel">
        <div className="security-content">
          <div className="security-icon-badge">
            <ShieldCheck size={32} />
          </div>
          <div className="security-text">
            <h3>I tuoi dati accademici appartengono solo a te</h3>
            <p>
              UniPlanner adotta l'approccio <strong>Local-First & Zero-Tracking</strong>: 
              tutti i tuoi dati (esami, voti, note e orari) vengono salvati localmente sul tuo dispositivo 
              e protetti da crittografia a riposo. I token di sessione utilizzano standard di sicurezza conformi al GDPR (UE 2016/679).
            </p>
          </div>
        </div>
        <div className="security-badges-list">
          <div className="security-badge-item">
            <Check size={14} />
            <span>Zero profilazione o rivendita dati a terzi</span>
          </div>
          <div className="security-badge-item">
            <Check size={14} />
            <span>Autenticazione a Due Fattori (2FA / OTP)</span>
          </div>
          <div className="security-badge-item">
            <Check size={14} />
            <span>Backup ed export completo in formato JSON aperto</span>
          </div>
        </div>
      </section>

      {/* 8. FINAL CALL TO ACTION BANNER */}
      <section className="welcome-final-cta glass-panel">
        <div className="cta-inner">
          <div className="cta-badge">
            <GraduationCap size={16} />
            <span>Unisciti a migliaia di studenti</span>
          </div>
          <h2>Pronto a vivere l'università con serenità e metodo?</h2>
          <p>Inizia a gestire il tuo piano di studi e calcola la tua media in meno di un minuto.</p>
          
          <div className="final-actions-row">
            <button className="primary-btn final-main-btn" onClick={handleStart}>
              <span>Inizia Subito Gratis</span>
              <ArrowRight size={17} />
            </button>
            {!currentUser && (
              <button 
                type="button" 
                className="google-hero-btn"
                onClick={handleGoogleSignIn}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" className="google-icon">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Accedi con Google</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 9. LEGAL & COMPLIANCE FOOTER */}
      <footer className="welcome-legal-footer">
        <div className="legal-footer-inner">
          <div className="legal-footer-brand">
            <div className="footer-logo-row">
              <div className="welcome-mini-logo">UP</div>
              <span className="welcome-brand">UniPlanner</span>
            </div>
            <p className="footer-disclaimer-text">
              UniPlanner è una piattaforma accademica indipendente creata per supportare il metodo di studio degli studenti universitari. 
              Non è affiliato ufficialmente né approvato dalle università citate. Tutti i marchi appartengono ai rispettivi proprietari.
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
                <span>Termini di Servizio & Disclaimer</span>
              </button>
              <button type="button" className="legal-footer-link" onClick={() => onOpenLegal('cookies')}>
                <span>Cookie & Storage Policy</span>
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default Welcome;
