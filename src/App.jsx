import React, { useState, useEffect } from 'react';
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
  User
} from 'lucide-react';
import TitleBar from './components/TitleBar';
import Welcome from './pages/Welcome';
import Grades from './pages/Grades';
import Exams from './pages/Exams';
import Deadlines from './pages/Deadlines';
import Pomodoro from './pages/Pomodoro';
import Notifications from './pages/Notifications';
import Schedule from './pages/Schedule';
import Friends from './pages/Friends';
import AccountModal from './components/AccountModal';
import LegalModal from './components/LegalModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { fetchUserProfile, publishUserProfile, connectMutualFriend } from './utils/cloudSync';
import { safeJsonParse } from './utils/security';
import './App.css';

function MainApp() {
  const [activeTab, setActiveTab] = useState(() => {
    // If URL has u= or import query, open amici tab directly
    if (typeof window !== 'undefined' && (window.location.search.includes('u=') || window.location.search.includes('importFriend='))) {
      return 'amici';
    }
    const welcomeSeen = localStorage.getItem('uniplanner_welcome_seen');
    return !welcomeSeen ? 'benvenuto' : 'esami';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('uniplanner_theme') || 'dark';
  });
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState('privacy');
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [importedFriendToast, setImportedFriendToast] = useState(null);

  const { currentUser, setIsAuthModalOpen, setAuthModalTab } = useAuth();
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Handle Friend Import from URL Query (?u=UP-XXXX)
  useEffect(() => {
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

  // Auto-sync real student profile and schedule to Raspberry Pi cloud backend
  useEffect(() => {
    if (currentUser && currentUser.friendCode) {
      try {
        const savedExams = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);
        const savedSchedule = safeJsonParse(localStorage.getItem('uniplanner_schedule_v1'), []);
        const savedDeadlines = safeJsonParse(localStorage.getItem('uniplanner_deadlines'), []);
        publishUserProfile(currentUser, savedExams, savedSchedule, savedDeadlines);
      } catch (e) {
        console.warn('Sync cloud profile err:', e);
      }
    }
  }, [currentUser, activeTab]);

  const handleOpenLegal = (tab = 'privacy') => {
    setLegalInitialTab(tab);
    setIsLegalModalOpen(true);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('uniplanner_theme', theme);
  }, [theme]);

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
                onClick={() => setActiveTab('benvenuto')}
                title="Scopri la guida e tutte le funzioni di UniPlanner"
              >
                <Sparkles size={15} className="guide-sparkle-icon" />
                <span>Guida</span>
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

        <AnimatePresence mode="wait">
          {activeTab === 'benvenuto' && (
            <motion.div
              key="benvenuto"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
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
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Exams />
            </motion.div>
          )}

          {activeTab === 'voti' && (
            <motion.div
              key="voti"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Grades />
            </motion.div>
          )}

          {activeTab === 'orario' && (
            <motion.div
              key="orario"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Schedule />
            </motion.div>
          )}

          {activeTab === 'scadenze' && (
            <motion.div
              key="scadenze"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Deadlines />
            </motion.div>
          )}

          {activeTab === 'pomodoro' && (
            <motion.div
              key="pomodoro"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Pomodoro />
            </motion.div>
          )}

          {activeTab === 'amici' && (
            <motion.div
              key="amici"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Friends />
            </motion.div>
          )}

          {activeTab === 'notifiche' && (
            <motion.div
              key="notifiche"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Notifications />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav glass-panel">
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
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
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

    {/* Legal & Privacy Compliance Modal */}
    <LegalModal 
      isOpen={isLegalModalOpen} 
      onClose={() => setIsLegalModalOpen(false)} 
      initialTab={legalInitialTab} 
    />

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
                  href="/downloads/UniPlanner-Setup.exe" 
                  download="UniPlanner-Setup.exe"
                  className="primary-btn download-action-btn"
                >
                  <Download size={18} />
                  <span>Scarica Installer Windows (.exe)</span>
                </a>

                <a 
                  href="/downloads/UniPlanner.exe" 
                  download="UniPlanner-Portable.exe"
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

