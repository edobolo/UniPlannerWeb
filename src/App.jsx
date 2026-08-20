import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Clock, 
  Calendar, 
  Bell, 
  TrendingUp, 
  Sun, 
  Moon, 
  Download, 
  Monitor, 
  CheckCircle2, 
  X, 
  Users, 
  CalendarDays, 
  UserCheck, 
  Sparkles, 
  User, 
  Bug,
  Palette,
  Crown
} from 'lucide-react';
import TitleBar from './components/TitleBar';
import Exams from './pages/Exams'; // Pagina iniziale caricata istantaneamente
import AccountModal from './components/AccountModal';
import ThemeModal from './components/ThemeModal';
import ProUpgradeModal from './components/ProUpgradeModal';

// 🚀 Dynamic Lazy Loading per framerate a 60 FPS e bundle compatto
const Welcome = lazy(() => import('./pages/Welcome'));
const Grades = lazy(() => import('./pages/Grades'));
const Deadlines = lazy(() => import('./pages/Deadlines'));
const Pomodoro = lazy(() => import('./pages/Pomodoro'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Friends = lazy(() => import('./pages/Friends'));
const LegalModal = lazy(() => import('./components/LegalModal'));
const BugReportModal = lazy(() => import('./components/BugReportModal'));

import { AuthProvider, useAuth } from './context/AuthContext';
import { fetchUserProfile, publishUserProfile, connectMutualFriend } from './utils/cloudSync';
import { safeJsonParse } from './utils/security';
import './App.css';

function MainApp() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && (window.location.search.includes('u=') || window.location.search.includes('importFriend='))) {
      return 'amici';
    }
    return 'esami';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('uniplanner_theme') || 'dark';
  });
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState('privacy');
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [importedFriendToast, setImportedFriendToast] = useState(null);

  const { currentUser, setIsAuthModalOpen, setAuthModalTab } = useAuth();
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Handle Friend Import from URL Query (?u=UP-XXXX) or PRO Unlock (?pro=true)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('pro') === 'true' || urlParams.get('unlock') === 'pro') {
        localStorage.setItem('uniplanner_pro_unlocked', 'true');
      }
    }

    const importFromUrl = async () => {
      if (typeof window === 'undefined' || !window.location.search) return;
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('u') || urlParams.get('p') || urlParams.get('importFriend');
      
      if (queryParam) {
        try {
          const friendProfile = await fetchUserProfile(queryParam);
          if (friendProfile && (friendProfile.fullName || friendProfile.username)) {
            const currentFriends = safeJsonParse(localStorage.getItem('uniplanner_friends_db_v2'), []);
            const exists = currentFriends.some(f => 
              (f.friendCode && f.friendCode.toUpperCase() === friendProfile.friendCode?.toUpperCase()) ||
              (f.username && f.username.toLowerCase() === friendProfile.username?.toLowerCase())
            );
            if (!exists) {
              const updated = [friendProfile, ...currentFriends];
              localStorage.setItem('uniplanner_friends_db_v2', JSON.stringify(updated));
            }
            if (currentUser?.friendCode) {
              await connectMutualFriend(currentUser.friendCode, friendProfile.friendCode);
            }
            setImportedFriendToast(friendProfile);
            setActiveTab('amici');
            // Clean URL without reload
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.warn('Errore import amico da URL:', err);
        }
      }
    };

    importFromUrl();
  }, [currentUser]);

  // Auto-sync real student profile and schedule to Raspberry Pi cloud backend (Smart Bidirectional Sync)
  useEffect(() => {
    if (currentUser && currentUser.friendCode) {
      const syncWithCloud = async () => {
        try {
          // 1. Scarica i dati aggiornati dal Raspberry Pi
          const cloudData = await fetchUserProfile(currentUser.friendCode);
          
          if (cloudData) {
            const localExams = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);
            const localSchedule = safeJsonParse(localStorage.getItem('uniplanner_schedule_v1'), []);
            const localDeadlines = safeJsonParse(localStorage.getItem('uniplanner_deadlines'), []);

            // Se il cloud ha esami e il locale è vuoto, carica dal cloud
            if ((!localExams || localExams.length === 0) && cloudData.exams && cloudData.exams.length > 0) {
              localStorage.setItem('uniplanner_exams', JSON.stringify(cloudData.exams));
            } else if (localExams && localExams.length > 0) {
              // Se abbiamo esami locali, sincronizza verso il cloud
              publishUserProfile(currentUser, localExams, localSchedule, localDeadlines);
            }

            // Se il cloud ha l'orario e il locale è vuoto, carica dal cloud
            if ((!localSchedule || localSchedule.length === 0) && cloudData.schedule && cloudData.schedule.length > 0) {
              const uniqueLessonsMap = new Map();
              cloudData.schedule.forEach(l => {
                const key = l.id || `${l.subject}_${l.dayIndex}_${l.startTime}_${l.date || 'weekly'}`;
                if (!uniqueLessonsMap.has(key)) uniqueLessonsMap.set(key, l);
              });
              localStorage.setItem('uniplanner_schedule_v1', JSON.stringify(Array.from(uniqueLessonsMap.values())));
            }

            // Se il cloud ha scadenze e il locale è vuoto, carica dal cloud
            if ((!localDeadlines || localDeadlines.length === 0) && cloudData.deadlines && cloudData.deadlines.length > 0) {
              localStorage.setItem('uniplanner_deadlines', JSON.stringify(cloudData.deadlines));
            }
          }
        } catch (e) {
          console.warn('Sync cloud initial err:', e);
        }
      };

      syncWithCloud();
    }
  }, [currentUser?.friendCode]);

  const handleOpenLegal = (tab = 'privacy') => {
    setLegalInitialTab(tab);
    setIsLegalModalOpen(true);
  };

  const [palette, setPalette] = useState(() => {
    return localStorage.getItem('uniplanner_palette') || 'default';
  });

  useEffect(() => {
    if (palette === 'amoled' && theme === 'light') {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('uniplanner_theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;
      localStorage.setItem('uniplanner_theme', theme);
    }
  }, [theme, palette]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('uniplanner_palette', palette);
    if (palette === 'amoled') {
      setTheme('dark');
    }
  }, [palette]);

  // Electron Auto-Updater listener
  useEffect(() => {
    if (isElectron && window.electronAPI) {
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
      });
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateDownloaded(true);
        setUpdateInfo(info);
      });
      return () => {
        window.electronAPI.removeAllUpdaterListeners?.();
      };
    }
  }, [isElectron]);

  const toggleTheme = () => {
    if (palette === 'amoled') {
      // Se è in amoled, mostra alert/toast o passa a palette default per abilitare il tema chiaro
      setPalette('default');
      setTheme('light');
      return;
    }
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navItems = [
    { id: 'esami', label: 'Piano di Studi', icon: BookOpen },
    { id: 'voti', label: 'Statistiche', icon: TrendingUp },
    { id: 'orario', label: 'Orario Lezioni', icon: CalendarDays },
    { id: 'scadenze', label: 'Scadenze', icon: Calendar },
    { id: 'pomodoro', label: 'Timer', icon: Clock },
    { id: 'amici', label: 'Amici & Social', icon: Users },
    { id: 'notifiche', label: 'Notifiche', icon: Bell },
  ];

  const handleOpenAccount = () => {
    setAuthModalTab('profile');
    setIsAuthModalOpen(true);
  };

  const handleRestartUpdate = () => {
    if (isElectron && window.electronAPI?.restartAndInstallUpdate) {
      window.electronAPI.restartAndInstallUpdate();
    }
  };

  return (
    <div className="app-root">
      <TitleBar />

      {/* Mobile Top Header */}
      <header className="mobile-header glass-panel">
        <div 
          className="mobile-logo" 
          onClick={() => setActiveTab('benvenuto')}
          title="Guida UniPlanner"
        >
          <div className="logo-icon">UP</div>
          <h2>UniPlanner</h2>
        </div>

        <div className="mobile-header-actions">
          <button 
            className={`mobile-icon-btn ${activeTab === 'benvenuto' ? 'active' : ''}`}
            onClick={() => setActiveTab('benvenuto')}
            title="Guida"
          >
            <Sparkles size={18} className="guide-sparkle-icon" />
          </button>

          <button 
            className={`mobile-icon-btn ${activeTab === 'notifiche' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifiche')}
            title="Notifiche"
          >
            <Bell size={18} />
          </button>

          <button 
            className="mobile-icon-btn" 
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modalità Chiara' : 'Modalità Scura'}
          >
            {theme === 'dark' ? <Sun size={18} className="sun-icon" /> : <Moon size={18} className="moon-icon" />}
          </button>

          <div 
            className="mobile-user-avatar" 
            onClick={handleOpenAccount}
            style={{ background: currentUser?.avatarColor || 'rgba(255, 255, 255, 0.1)' }}
            title={currentUser ? currentUser.fullName : "Accedi o registrati"}
          >
            {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : (currentUser?.username?.charAt(0).toUpperCase() || <User size={17} />)}
          </div>
        </div>
      </header>

      <div className="app-container">
        <nav className="sidebar glass-panel">
          <div className="sidebar-top">
            <div 
              className="logo-container clickable-logo" 
              onClick={() => setActiveTab('benvenuto')}
              title="Guida & Presentazione UniPlanner"
            >
              <div className="logo-icon">UP</div>
              <h2>UniPlanner</h2>
            </div>
            
            <ul className="nav-list">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <li key={item.id}>
                    <button 
                      className={`nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                      {isActive && (
                        <motion.div 
                          layoutId="active-nav-bg"
                          className="nav-active-bg"
                          initial={false}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Sidebar Footer with Account, Guide, Download & Theme Toggle */}
          <div className="sidebar-footer">
            {/* User Account Badge */}
            <div className="user-profile-badge" onClick={handleOpenAccount} title={currentUser ? "Gestisci account e impostazioni" : "Accedi o crea un account"}>
              <div 
                className="user-badge-avatar" 
                style={{ background: currentUser?.avatarColor || 'rgba(255, 255, 255, 0.1)' }}
              >
                {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : (currentUser?.username?.charAt(0).toUpperCase() || <User size={16} />)}
                {currentUser && <span className="online-indicator" />}
              </div>
              <div className="user-badge-info">
                <span className="badge-name">{currentUser?.fullName || (currentUser?.username ? `@${currentUser.username}` : 'Accedi')}</span>
                <span className="badge-code">{currentUser?.university || (currentUser?.username ? `@${currentUser.username}` : 'Crea Account')}</span>
              </div>
            </div>

            <button 
              className="pro-upgrade-sidebar-btn"
              onClick={async () => {
                const isRealPro = Boolean(currentUser?.isPremium && currentUser?.stripeCustomerId);
                if (isRealPro && currentUser?.friendCode) {
                  try {
                    const { apiFetch } = await import('./utils/cloudSync');
                    const res = await apiFetch('/stripe/create-portal-session', {
                      method: 'POST',
                      body: JSON.stringify({ friendCode: currentUser.friendCode })
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                    else alert(data.error || 'Errore apertura portale');
                  } catch (err) {
                    console.error(err);
                    alert('Impossibile aprire il portale di gestione.');
                  }
                } else {
                  setIsProModalOpen(true);
                }
              }}
              title={currentUser?.isPremium ? "Gestisci il tuo abbonamento PRO" : "Sblocca UniPlanner PRO"}
            >
              <Crown size={15} style={{ color: '#f59e0b' }} />
              <span>{currentUser?.isPremium && currentUser?.stripeCustomerId ? 'Gestisci PRO 👑' : 'Passa a PRO ⚡'}</span>
            </button>

            {!isElectron && (
              <button 
                className="download-app-btn"
                onClick={() => setIsDownloadModalOpen(true)}
                title="Scarica l'applicazione desktop nativa (.exe)"
              >
                <Monitor size={15} className="download-icon" />
                <span>Scarica App (.exe)</span>
              </button>
            )}

            <div className="sidebar-bottom-row">
              <button 
                className="footer-mini-btn"
                onClick={() => setIsThemeModalOpen(true)}
                title="Scegli il colore della tua Facoltà o tema AMOLED"
              >
                <Palette size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>Temi</span>
              </button>

              <button 
                className="footer-mini-btn"
                onClick={() => setActiveTab('benvenuto')}
                title="Scopri la guida e tutte le funzioni di UniPlanner"
              >
                <Sparkles size={15} className="guide-sparkle-icon" />
                <span>Guida</span>
              </button>

              <button 
                className="footer-mini-btn"
                onClick={() => setIsBugModalOpen(true)}
                title="Segnala un bug o invia un suggerimento per UniPlanner"
              >
                <Bug size={15} style={{ color: '#ef4444' }} />
                <span>Bug</span>
              </button>

              <button 
                className="footer-mini-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Passa alla Modalità Chiara' : 'Passa alla Modalità Scura'}
              >
                {theme === 'dark' ? <Sun size={15} className="sun-icon" /> : <Moon size={15} className="moon-icon" />}
                <span>{theme === 'dark' ? 'Chiaro' : 'Scuro'}</span>
              </button>
            </div>
          </div>
        </nav>

      <main className="main-content">
        {/* AutoUpdater Notification Pill */}
        <AnimatePresence>
          {updateDownloaded && (
            <motion.div 
              className="updater-toast-banner glass-panel"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="updater-toast-content">
                <Sparkles size={18} className="update-icon-glow" />
                <div>
                  <strong>Nuovo aggiornamento UniPlanner pronto!</strong>
                  <span className="update-subtext">La nuova versione è stata scaricata. Riavvia ora per applicarla.</span>
                </div>
              </div>
              <button className="primary-btn update-restart-btn" onClick={handleRestartUpdate}>
                Riavvia & Aggiorna
              </button>
            </motion.div>
          )}

          {/* Real Friend Imported via Link Toast */}
          {importedFriendToast && (
            <motion.div 
              className="updater-toast-banner glass-panel friend-imported-toast"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="updater-toast-content">
                <Users size={20} className="update-icon-glow" style={{ color: '#38bdf8' }} />
                <div>
                  <strong>Amico {importedFriendToast.fullName} collegato con successo! 🎉</strong>
                  <span className="update-subtext">Visualizza subito il suo piano di studi, media e orario delle lezioni.</span>
                </div>
              </div>
              <button className="primary-btn update-restart-btn" onClick={() => setImportedFriendToast(null)}>
                Mostra Profilo
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }} />}>
          <AnimatePresence mode="wait">
            {activeTab === 'benvenuto' && (
              <motion.div
                key="benvenuto"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Welcome 
                  onNavigate={(tab) => setActiveTab(tab)} 
                  onOpenDownload={() => setIsDownloadModalOpen(true)} 
                  onOpenLegal={handleOpenLegal}
                />
              </motion.div>
            )}

            {activeTab === 'esami' && (
              <motion.div
                key="esami"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Exams />
              </motion.div>
            )}

            {activeTab === 'voti' && (
              <motion.div
                key="voti"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Grades />
              </motion.div>
            )}

            {activeTab === 'orario' && (
              <motion.div
                key="orario"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Schedule />
              </motion.div>
            )}

            {activeTab === 'scadenze' && (
              <motion.div
                key="scadenze"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Deadlines />
              </motion.div>
            )}

            {activeTab === 'pomodoro' && (
              <motion.div
                key="pomodoro"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Pomodoro />
              </motion.div>
            )}

            {activeTab === 'amici' && (
              <motion.div
                key="amici"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Friends />
              </motion.div>
            )}

            {activeTab === 'notifiche' && (
              <motion.div
                key="notifiche"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="page-wrapper gpu-accelerated"
              >
                <Notifications />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav glass-panel gpu-accelerated">
        {navItems.filter(item => item.id !== 'notifiche').map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="mobile-nav-icon-wrap">
                <Icon size={20} />
                {isActive && (
                  <motion.div 
                    layoutId="mobile-nav-glow"
                    className="mobile-nav-glow"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </div>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

    {/* Account Management Modal */}
    <AccountModal onOpenLegal={handleOpenLegal} />

    {/* Dedicated Faculty Color Themes Modal */}
    <ThemeModal 
      isOpen={isThemeModalOpen}
      onClose={() => setIsThemeModalOpen(false)}
      currentPalette={palette}
      onSelectPalette={(palId) => {
        setPalette(palId);
        document.documentElement.setAttribute('data-palette', palId);
        localStorage.setItem('uniplanner_palette', palId);
      }}
      theme={theme}
      onToggleTheme={toggleTheme}
    />

    {/* Pro Upgrade Modal */}
    <ProUpgradeModal 
      isOpen={isProModalOpen}
      onClose={() => setIsProModalOpen(false)}
      friendCode={currentUser?.friendCode}
    />

    {/* Lazy Modals with Suspense */}
    <Suspense fallback={null}>
      {isLegalModalOpen && (
        <LegalModal 
          isOpen={isLegalModalOpen} 
          onClose={() => setIsLegalModalOpen(false)} 
          initialTab={legalInitialTab} 
        />
      )}

      {isBugModalOpen && (
        <BugReportModal 
          isOpen={isBugModalOpen} 
          onClose={() => setIsBugModalOpen(false)} 
        />
      )}
    </Suspense>

    {/* Download Desktop App Modal */}
    <AnimatePresence>
      {isDownloadModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content glass-panel modern-modal download-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
          >
            <div className="download-modal-header">
              <div className="download-modal-brand">
                <div className="download-modal-icon">
                  <Monitor size={22} />
                </div>
                <div className="download-modal-headings">
                  <h3>UniPlanner Desktop</h3>
                  <span className="download-modal-badge">App Ufficiale Windows</span>
                </div>
              </div>
              <button 
                className="icon-btn download-modal-close" 
                onClick={() => setIsDownloadModalOpen(false)}
                title="Chiudi"
              >
                <X size={20} />
              </button>
            </div>

            <div className="download-modal-body">
              <p className="download-modal-desc">
                Scarica ed esegui UniPlanner nativamente sul tuo PC con prestazioni ottimali e notifiche di sistema.
              </p>

              <div className="download-features-list">
                <div className="feature-item">
                  <CheckCircle2 size={18} className="feature-icon" />
                  <div>
                    <strong>Avvio Istantaneo Offline</strong>
                    <p>Funziona senza browser aperto e salva i tuoi dati in locale.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <CheckCircle2 size={18} className="feature-icon" />
                  <div>
                    <strong>Timer & Notifiche Native</strong>
                    <p>Avvisi sonori e visivi Windows allo scadere delle sessioni di studio.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <CheckCircle2 size={18} className="feature-icon" />
                  <div>
                    <strong>Interfaccia Frameless Glass</strong>
                    <p>Design moderno ed elegante senza le barre di Windows.</p>
                  </div>
                </div>
              </div>

              <div className="download-actions-grid">
                <a 
                  href="https://github.com/edobolo/UniPlannerWeb/releases/latest" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="primary-btn download-action-btn"
                >
                  <Download size={18} />
                  <span>Scarica Installer Windows (.exe)</span>
                </a>

                <a 
                  href="https://github.com/edobolo/UniPlannerWeb/releases" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary-btn download-action-btn"
                >
                  <Download size={18} />
                  <span>Scarica Versione Portable (.exe)</span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

