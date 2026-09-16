import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  School, 
  GraduationCap, 
  Copy, 
  Check, 
  LogOut, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  Sparkles, 
  X, 
  Edit3,
  AlertCircle,
  Scale,
  Bell,
  BellOff,
  Crown,
  Smartphone,
  Download,
  CreditCard,
  Trash2,
  ExternalLink,
  Upload,
  FolderUp,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateShareLink, requestPasswordResetOtp, verifyPasswordResetOtp, linkGoogleOnline, unlinkGoogleOnline, apiFetch, publishUserProfile } from '../utils/cloudSync';
import { safeJsonParse, checkPasswordStrength } from '../utils/security';
import './AccountModal.css';

const AccountModal = ({ onOpenLegal }) => {
  const { 
    currentUser, 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    authModalTab, 
    setAuthModalTab, 
    login, 
    loginWithGoogle,
    verify2FA,
    toggle2FA,
    register, 
    logout, 
    updateProfile 
  } = useAuth();

  // Form states
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    university: '',
    degreeCourse: ''
  });
  const [resetStep, setResetStep] = useState(1); // 1 = Richiedi OTP, 2 = Verifica OTP e Nuova Password
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetDevOtp, setResetDevOtp] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [profileEdit, setProfileEdit] = useState({
    fullName: '',
    university: '',
    degreeCourse: '',
    bio: '',
    status: '',
    avatarColor: '',
    shareGrades: true
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('uniplanner_notif_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [otpForm, setOtpForm] = useState({ friendCode: '', otp: '', tempToken: '', devOtp: '' });
  const [twoFactorToggling, setTwoFactorToggling] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState('academic'); // 'academic' | 'security' | 'settings'
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [isCustomGoogleMode, setIsCustomGoogleMode] = useState(false);
  const jsonFileInputRef = React.useRef(null);
  const passStrength = checkPasswordStrength(registerForm.password);

  // 1. Export Complete Student Backup (JSON)
  const handleExportData = () => {
    try {
      const backupData = {
        exportDate: new Date().toISOString(),
        version: 'UniPlanner v2.0',
        user: currentUser,
        exams: safeJsonParse(localStorage.getItem('uniplanner_exams'), []),
        schedule: safeJsonParse(localStorage.getItem('uniplanner_schedule_v1'), []),
        deadlines: safeJsonParse(localStorage.getItem('uniplanner_deadlines'), []),
        friends: safeJsonParse(localStorage.getItem('uniplanner_friends_db_v2'), []),
        stats: {
          totalStudyHours: localStorage.getItem('uniplanner_total_study_time') || 0,
          palette: localStorage.getItem('uniplanner_palette') || 'default'
        }
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      const safeName = (currentUser?.username || 'studente').replace(/[^a-z0-9]/gi, '_');
      downloadAnchor.setAttribute('download', `UniPlanner_Backup_${safeName}_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Errore export dati:', err);
    }
  };

  // 1.1 Restore Complete Student Backup (JSON)
  const handleRestoreBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setRestoreSuccess('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        const backup = JSON.parse(text);

        if (!backup || typeof backup !== 'object') {
          throw new Error('Il file caricato non contiene un backup valido.');
        }

        // Restore Exams
        if (Array.isArray(backup.exams)) {
          localStorage.setItem('uniplanner_exams', JSON.stringify(backup.exams));
        }

        // Restore Schedule
        if (Array.isArray(backup.schedule)) {
          localStorage.setItem('uniplanner_schedule_v1', JSON.stringify(backup.schedule));
        }

        // Restore Deadlines
        if (Array.isArray(backup.deadlines)) {
          localStorage.setItem('uniplanner_deadlines', JSON.stringify(backup.deadlines));
        }

        // Restore Friends
        if (Array.isArray(backup.friends)) {
          localStorage.setItem('uniplanner_friends_db_v2', JSON.stringify(backup.friends));
        }

        // Restore Stats & Themes
        if (backup.stats?.palette) {
          localStorage.setItem('uniplanner_palette', backup.stats.palette);
        }
        if (backup.stats?.totalStudyHours) {
          localStorage.setItem('uniplanner_total_study_time', String(backup.stats.totalStudyHours));
        }

        // Restore User Profile & Session
        if (backup.user && (backup.user.username || backup.user.friendCode)) {
          localStorage.setItem('uniplanner_active_session_v2', JSON.stringify(backup.user));
          const currentUsers = safeJsonParse(localStorage.getItem('uniplanner_users_db_v2'), []);
          const updatedUsers = [backup.user, ...currentUsers.filter(u => u.friendCode !== backup.user.friendCode)];
          localStorage.setItem('uniplanner_users_db_v2', JSON.stringify(updatedUsers));

          // Sync with cloud backend
          try {
            await publishUserProfile(backup.user, backup.exams || [], backup.schedule || [], backup.deadlines || []);
          } catch (syncErr) {
            console.warn('Cloud sync warning during restore:', syncErr);
          }
        }

        setRestoreSuccess('🎉 Backup ripristinato con successo! Ricaricamento...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err) {
        console.error('Errore parsing backup JSON:', err);
        setErrorMsg('Errore nel ripristino: ' + (err.message || 'File JSON non valido.'));
      }
    };

    reader.readAsText(file);
    if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
  };

  // 2. Open Stripe Customer Portal
  const handleOpenStripePortal = async () => {
    if (!currentUser?.friendCode) return;
    setIsOpeningPortal(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/stripe/create-portal-session', {
        method: 'POST',
        body: JSON.stringify({ friendCode: currentUser.friendCode })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Impossibile aprire il portale abbonamento Stripe.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Errore connessione Stripe Portal.');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  // 3. Delete Account Definitively (GDPR)
  const handleDeleteAccount = async () => {
    if (!currentUser?.friendCode) return;
    setDeleteLoading(true);
    setErrorMsg('');
    try {
      try {
        const res = await apiFetch('/auth/delete-account', {
          method: 'POST',
          body: JSON.stringify({ friendCode: currentUser.friendCode })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          await res.json();
        }
      } catch (serverErr) {
        console.warn('Warning comunicazione cloud delete:', serverErr);
      }

      // Ripulisci completamente dati locali, disconnetti e ricarica
      localStorage.clear();
      sessionStorage.clear();
      logout();
      setIsAuthModalOpen(false);
      window.location.reload();
    } catch (err) {
      setErrorMsg(err.message || 'Errore durante l\'eliminazione dell\'account.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleNotifSetting = () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem('uniplanner_notif_enabled', JSON.stringify(nextVal));
  };

  const handleCopyCode = () => {
    if (!currentUser?.friendCode) return;
    navigator.clipboard.writeText(currentUser.friendCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyShareLink = () => {
    if (!currentUser) return;
    const link = generateShareLink(currentUser);
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await login(loginForm.identifier, loginForm.password);
      if (res && res.require2FA) {
        setOtpForm({
          friendCode: res.friendCode,
          otp: res.devOtp || '',
          tempToken: res.tempToken || '',
          devOtp: res.devOtp || ''
        });
        setAuthModalTab('otp');
        return;
      }
      setLoginForm({ identifier: '', password: '' });
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Errore durante l\'accesso.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await verify2FA(otpForm.friendCode, otpForm.otp, otpForm.tempToken);
      setOtpForm({ friendCode: '', otp: '', tempToken: '', devOtp: '' });
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Codice OTP non valido o scaduto.');
    } finally {
      setLoading(false);
    }
  };

  const googleClientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';

  // Inizializza Google Identity Services (GIS) per il pulsante ufficiale a 1-click
  useEffect(() => {
    if (!isAuthModalOpen) return;

    const setupGoogleGis = () => {
      if (typeof window === 'undefined' || !window.google?.accounts?.id || !googleClientId) return;

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response?.credential) {
              setLoading(true);
              setErrorMsg('');
              try {
                await loginWithGoogle(response.credential);
                setIsAuthModalOpen(false);
              } catch (err) {
                setErrorMsg(err.message || 'Accesso con Google non riuscito.');
              } finally {
                setLoading(false);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true
        });

        // Monta il pulsante ufficiale Google nel container
        const btnLogin = document.getElementById('google-btn-login');
        if (btnLogin) {
          btnLogin.innerHTML = '';
          window.google.accounts.id.renderButton(btnLogin, {
            theme: 'filled_blue',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'continue_with',
            width: 320
          });
        }

        const btnRegister = document.getElementById('google-btn-register');
        if (btnRegister) {
          btnRegister.innerHTML = '';
          window.google.accounts.id.renderButton(btnRegister, {
            theme: 'filled_blue',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'signup_with',
            width: 320
          });
        }

        // Avvia anche One Tap popup in alto a destra se supportato dal browser
        window.google.accounts.id.prompt();
      } catch (err) {
        console.warn('GIS error:', err);
      }
    };

    if (typeof window !== 'undefined' && !window.google?.accounts?.id) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = setupGoogleGis;
      document.head.appendChild(script);
    } else {
      setupGoogleGis();
    }
  }, [isAuthModalOpen, authModalTab, googleClientId]);

  // Se la modale viene aperta con tab='google' (es. dalla pagina Welcome), mostra subito il selettore
  useEffect(() => {
    if (isAuthModalOpen && authModalTab === 'google') {
      setShowGooglePicker(true);
    }
  }, [isAuthModalOpen, authModalTab]);

  const handleGoogleAuth = () => {
    setErrorMsg('');
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
      return;
    }
    setShowGooglePicker(true);
  };

  const handleSelectGoogleAccount = async (email, name) => {
    setErrorMsg('');
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name || cleanEmail.split('@')[0];
      const picture = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName || cleanEmail)}`;

      if (currentUser && authModalTab === 'profile') {
        // Modalità collegamento su account esistente
        const res = await linkGoogleOnline(null, { email: cleanEmail, name: cleanName, picture });
        updateProfile({ googleEmail: res.googleEmail || cleanEmail, avatarUrl: picture });
        setResetSuccess('Account Google collegato con successo al tuo profilo!');
      } else {
        await loginWithGoogle(null, {
          email: cleanEmail,
          name: cleanName,
          picture
        });
        setIsAuthModalOpen(false);
      }
      setShowGooglePicker(false);
    } catch (err) {
      setErrorMsg(err.message || 'Operazione con Google non riuscita.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkGoogle = () => {
    setErrorMsg('');
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (response?.credential) {
            setLoading(true);
            try {
              const res = await linkGoogleOnline(response.credential);
              updateProfile({ googleEmail: res.googleEmail, avatarUrl: res.avatarUrl || currentUser?.avatarUrl });
              setResetSuccess('Account Google collegato con successo!');
            } catch (err) {
              setErrorMsg(err.message || 'Collegamento con Google fallito.');
            } finally {
              setLoading(false);
            }
          }
        }
      });
      window.google.accounts.id.prompt();
    } else {
      setShowGooglePicker(true);
    }
  };

  const handleUnlinkGoogle = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await unlinkGoogleOnline();
      updateProfile({ googleEmail: null, googleId: null });
      setResetSuccess('Account Google scollegato dal profilo.');
    } catch (err) {
      setErrorMsg(err.message || 'Impossibile scollegare Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    setTwoFactorToggling(true);
    setErrorMsg('');
    try {
      await toggle2FA(!currentUser?.twoFactorEnabled);
    } catch (err) {
      setErrorMsg(err.message || 'Impossibile aggiornare le impostazioni 2FA.');
    } finally {
      setTwoFactorToggling(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    // Validazione robustezza password (minimo 8 caratteri, lettere e numeri)
    const strength = checkPasswordStrength(registerForm.password);
    if (!strength.isStrong) {
      setErrorMsg('La password deve contenere almeno 8 caratteri, con lettere e numeri.');
      return;
    }

    setLoading(true);
    try {
      await register(registerForm);
      setRegisterForm({
        username: '',
        fullName: '',
        email: '',
        password: '',
        university: '',
        degreeCourse: ''
      });
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Errore durante la registrazione.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Richiesta codice OTP via Email
  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    if (!resetIdentifier) {
      setErrorMsg('Inserisci la tua email o username.');
      return;
    }
    setErrorMsg('');
    setResetSuccess('');
    setLoading(true);
    try {
      const res = await requestPasswordResetOtp(resetIdentifier);
      if (res.devOtp) {
        setResetDevOtp(res.devOtp);
      }
      setResetStep(2);
      setResetSuccess(res.message || 'Abbiamo inviato un codice OTP alla tua email.');
    } catch (err) {
      setErrorMsg(err.message || 'Errore durante l\'invio del codice OTP. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Convalida codice OTP e impostazione nuova password
  const handleVerifyResetOtp = async (e) => {
    e.preventDefault();
    if (!resetOtp || resetOtp.length !== 6) {
      setErrorMsg('Inserisci il codice OTP numerico a 6 cifre.');
      return;
    }

    const strength = checkPasswordStrength(resetNewPassword);
    if (!strength.isStrong) {
      setErrorMsg('La nuova password deve contenere almeno 8 caratteri, con lettere e numeri.');
      return;
    }

    setErrorMsg('');
    setResetSuccess('');
    setLoading(true);
    try {
      const res = await verifyPasswordResetOtp({
        identifier: resetIdentifier,
        code: resetOtp,
        newPassword: resetNewPassword
      });
      setResetSuccess(res.message || 'Password aggiornata con successo! Ora puoi accedere.');
      setResetOtp('');
      setResetNewPassword('');
      setTimeout(() => {
        setAuthModalTab('login');
        setErrorMsg('');
        setResetSuccess('');
        setResetStep(1);
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Codice OTP non valido o scaduto.');
    } finally {
      setLoading(false);
    }
  };

  const startEditProfile = () => {
    if (!currentUser) return;
    setProfileEdit({
      fullName: currentUser.fullName || '',
      university: currentUser.university || '',
      degreeCourse: currentUser.degreeCourse || '',
      bio: currentUser.bio || '',
      status: currentUser.status || 'Libero ☕',
      avatarColor: currentUser.avatarColor || '#8b5cf6',
      shareGrades: currentUser.shareGrades !== false
    });
    setIsEditingProfile(true);
    setErrorMsg('');
  };

  const toggleGradePrivacyQuick = () => {
    if (!currentUser) return;
    const nextVal = !(currentUser.shareGrades !== false);
    updateProfile({ shareGrades: nextVal });
  };

  const saveProfileEdit = (e) => {
    e.preventDefault();
    updateProfile(profileEdit);
    setIsEditingProfile(false);
  };

  const avatarColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];
  const statusOptions = [
    'In sessione Focus 🎯',
    'A lezione 📚',
    'In biblioteca 📖',
    'Libero ☕',
    'In pausa pranzo 🍕',
    'Sotto esami ⚡'
  ];

  if (!isAuthModalOpen) return null;

  return (
    <div className="modal-overlay">
      <motion.div 
        className="modal-content glass-panel account-modal"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
      >
        {/* Modal Header */}
        <div className="account-modal-header">
          <div className="account-header-left">
            <div className="account-icon-badge">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3>Gestione Account</h3>
              <p className="account-header-sub">I tuoi dati sono protetti e crittografati</p>
            </div>
          </div>
          <button 
            className="icon-btn account-modal-close" 
            onClick={() => setIsAuthModalOpen(false)}
            title="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector if user exists or not */}
        <div className="account-tabs">
          {currentUser && (
            <button 
              className={`account-tab-btn ${authModalTab === 'profile' ? 'active' : ''}`}
              onClick={() => { setAuthModalTab('profile'); setErrorMsg(''); }}
            >
              <User size={16} />
              <span>Profilo</span>
            </button>
          )}
          <button 
            className={`account-tab-btn ${authModalTab === 'login' || authModalTab === 'otp' || authModalTab === 'google' ? 'active' : ''}`}
            onClick={() => { setAuthModalTab('login'); setErrorMsg(''); }}
          >
            <LogIn size={16} />
            <span>{authModalTab === 'otp' ? 'Verifica 2FA' : (currentUser ? 'Cambia Account' : 'Accedi')}</span>
          </button>
          <button 
            className={`account-tab-btn ${authModalTab === 'register' ? 'active' : ''}`}
            onClick={() => { setAuthModalTab('register'); setErrorMsg(''); }}
          >
            <UserPlus size={16} />
            <span>Nuovo Account</span>
          </button>
        </div>

          {restoreSuccess && (
            <div className="account-success-banner" style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '10px', color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} />
              <span>{restoreSuccess}</span>
            </div>
          )}

          <input 
            type="file" 
            ref={jsonFileInputRef} 
            accept=".json,application/json" 
            onChange={handleRestoreBackup} 
            style={{ display: 'none' }} 
          />

          {errorMsg && (
            <div className="auth-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

        {resetSuccess && (
          <div className="account-alert success" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Check size={16} />
            <span>{resetSuccess}</span>
          </div>
        )}

        {/* PROFILE TAB */}
        {authModalTab === 'profile' && currentUser && (
          <div className="account-tab-content clean-profile-container">
            {!isEditingProfile ? (
              <div className="profile-view-redesigned">
                {/* 1. Header Hero Compatto & Moderno */}
                <div className="profile-card-top-redesigned">
                  <div 
                    className={`profile-avatar-large ${currentUser.isPremium ? 'is-pro-avatar' : ''}`} 
                    style={{ 
                      background: currentUser.avatarUrl ? 'transparent' : (currentUser.avatarColor || '#8b5cf6'),
                      overflow: 'hidden'
                    }}
                  >
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt={currentUser.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()
                    )}
                    {currentUser.isPremium && (
                      <span className="avatar-crown-badge large-crown" title="Membro PRO 👑">
                        <Crown size={13} />
                      </span>
                    )}
                  </div>

                  <div className="profile-info-main">
                    <div className="profile-name-row">
                      <h4>{currentUser.fullName || currentUser.username}</h4>
                      {currentUser.isPremium && (
                        <span className="account-pro-pill" title="Membro PRO 👑">
                          <Crown size={12} /> PRO
                        </span>
                      )}
                    </div>
                    <span className="profile-username">@{currentUser.username} • {currentUser.email}</span>
                    <span className="profile-status-pill">{currentUser.status || 'In sessione 🎯'}</span>
                  </div>
                </div>

                {/* 2. Friend Code Badge Bar */}
                <div className="profile-friend-code-bar">
                  <div className="friend-code-data">
                    <span className="code-label">Codice Amico:</span>
                    <strong className="code-value">{currentUser.friendCode}</strong>
                  </div>
                  <div className="friend-code-actions">
                    <button 
                      type="button"
                      className={`copy-code-btn ${copiedCode ? 'copied' : ''}`}
                      onClick={handleCopyCode}
                      title="Copia codice amico"
                    >
                      {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCode ? 'Copiato!' : 'Codice'}</span>
                    </button>
                    <button 
                      type="button"
                      className={`copy-code-btn ${copiedLink ? 'copied' : ''}`}
                      onClick={handleCopyShareLink}
                      title="Copia link breve"
                    >
                      {copiedLink ? <Check size={14} /> : <Sparkles size={14} />}
                      <span>{copiedLink ? 'Copiato!' : 'Link'}</span>
                    </button>
                  </div>
                </div>

                {/* 3. Dati Accademici & Informazioni */}
                <div className="profile-section-card">
                  <div className="profile-section-card-header">
                    <div className="section-title-wrap">
                      <GraduationCap size={18} className="section-title-icon" />
                      <div>
                        <h5>Percorso Universitario</h5>
                        <p>I dettagli visibili ai tuoi colleghi e compagni di corso</p>
                      </div>
                    </div>
                    <button type="button" className="ghost-btn edit-profile-mini-btn" onClick={startEditProfile}>
                      <Edit3 size={14} />
                      <span>Modifica</span>
                    </button>
                  </div>

                  <div className="profile-academic-grid">
                    <div className="profile-info-pill">
                      <span className="pill-label">Università:</span>
                      <strong className="pill-value">{currentUser.university || 'Non ancora specificata'}</strong>
                    </div>
                    <div className="profile-info-pill">
                      <span className="pill-label">Corso di Laurea:</span>
                      <strong className="pill-value">{currentUser.degreeCourse || 'Non ancora specificato'}</strong>
                    </div>
                  </div>

                  {currentUser.bio && (
                    <div className="profile-bio-box">
                      <span className="pill-label">Bio accademica:</span>
                      <p>{currentUser.bio}</p>
                    </div>
                  )}

                  <div className="profile-toggle-row">
                    <div className="toggle-label-wrap">
                      <Lock size={15} />
                      <div>
                        <strong>Condivisione Voti con Amici</strong>
                        <span>{currentUser.shareGrades !== false ? 'La tua media è visibile ai compagni collegati' : 'Voti nascosti (reciprocità privacy attiva)'}</span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className={`switch-toggle-btn ${currentUser.shareGrades !== false ? 'on' : 'off'}`}
                      onClick={toggleGradePrivacyQuick}
                    >
                      <span>{currentUser.shareGrades !== false ? 'Visibili' : 'Nascosti'}</span>
                    </button>
                  </div>
                </div>

                {/* 4. Sicurezza & Notifiche */}
                <div className="profile-section-card">
                  <div className="profile-section-card-header">
                    <div className="section-title-wrap">
                      <ShieldCheck size={18} className="section-title-icon" />
                      <div>
                        <h5>Sicurezza & Preferenze</h5>
                        <p>Impostazioni di accesso, 2FA e suoni</p>
                      </div>
                    </div>
                  </div>

                  {/* 2FA Card */}
                  <div className="profile-toggle-row">
                    <div className="toggle-label-wrap">
                      <KeyRound size={15} style={{ color: currentUser.twoFactorEnabled ? '#10b981' : '#f59e0b' }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong>Autenticazione 2FA (Codice OTP via Email)</strong>
                          <span className={`status-pill-mini ${currentUser.twoFactorEnabled ? 'active' : 'inactive'}`}>
                            {currentUser.twoFactorEnabled ? 'Attiva' : 'Disattivata'}
                          </span>
                        </div>
                        <span>Codice a 6 cifre inviato via email ad ogni accesso per proteggere i dati.</span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className={`switch-toggle-btn ${currentUser.twoFactorEnabled ? 'danger-off' : 'on'}`}
                      disabled={twoFactorToggling}
                      onClick={handleToggle2FA}
                    >
                      <span>{twoFactorToggling ? '...' : (currentUser.twoFactorEnabled ? 'Disattiva' : 'Attiva')}</span>
                    </button>
                  </div>

                  {/* Accesso con Google Collegato */}
                  <div className="profile-toggle-row">
                    <div className="toggle-label-wrap">
                      <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong>Accesso rapido con Google</strong>
                          <span className={`status-pill-mini ${(currentUser.googleEmail || currentUser.googleId) ? 'active' : 'inactive'}`}>
                            {(currentUser.googleEmail || currentUser.googleId) ? 'Collegato' : 'Non collegato'}
                          </span>
                        </div>
                        <span>
                          {(currentUser.googleEmail || currentUser.googleId)
                            ? `Collegato a ${currentUser.googleEmail || 'Account Google'}. Puoi accedere con 1 click senza creare account duplicati.`
                            : 'Collega il tuo account Google personale per accedere con 1 click a questo stesso profilo.'}
                        </span>
                      </div>
                    </div>
                    {(currentUser.googleEmail || currentUser.googleId) ? (
                      <button 
                        type="button" 
                        className="ghost-btn" 
                        style={{ fontSize: '11.5px', padding: '5px 10px', color: '#f87171' }}
                        onClick={handleUnlinkGoogle}
                        disabled={loading}
                      >
                        Scollega
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="primary-btn" 
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                        onClick={handleLinkGoogle}
                        disabled={loading}
                      >
                        Collega
                      </button>
                    )}
                  </div>

                  {/* Notifiche Card */}
                  <div className="profile-toggle-row">
                    <div className="toggle-label-wrap">
                      {notificationsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
                      <div>
                        <strong>Notifiche & Suoni di Studio</strong>
                        <span>Avvisi audio e pop-up per pause Pomodoro e scadenze esami.</span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className={`switch-toggle-btn ${notificationsEnabled ? 'on' : 'off'}`}
                      onClick={toggleNotifSetting}
                    >
                      <span>{notificationsEnabled ? 'Attive' : 'Disattive'}</span>
                    </button>
                  </div>
                </div>

                {/* 5. Strumenti & Backup */}
                <div className="profile-section-card">
                  <div className="profile-section-card-header">
                    <div className="section-title-wrap">
                      <Download size={18} className="section-title-icon" />
                      <div>
                        <h5>Salvataggio Dati & Abbonamento</h5>
                        <p>Esporta o ripristina la tua carriera accademica in formato standard JSON</p>
                      </div>
                    </div>
                  </div>

                  <div className="backup-btn-group">
                    <button type="button" className="secondary-btn" onClick={handleExportData}>
                      <Download size={14} />
                      <span>Scarica Backup (.json)</span>
                    </button>
                    <button type="button" className="secondary-btn" onClick={() => jsonFileInputRef.current?.click()}>
                      <Upload size={14} />
                      <span>Ripristina Backup (.json)</span>
                    </button>
                  </div>

                  {currentUser?.isPremium && (
                    <div className="profile-stripe-pro-row" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>
                        <Crown size={15} />
                        <span>Abbonamento PRO Attivo</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenStripePortal}
                        disabled={isOpeningPortal}
                        className="ghost-btn"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        <span>{isOpeningPortal ? 'Connessione...' : 'Portale Stripe'}</span>
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 6. Footer Chiaro: Logout ed Eliminazione */}
                <div className="profile-clean-footer">
                  <button type="button" className="profile-logout-btn" onClick={logout}>
                    <LogOut size={16} />
                    <span>Disconnetti Account</span>
                  </button>

                  <div className="danger-zone-compact">
                    {!showDeleteConfirm ? (
                      <button 
                        type="button" 
                        className="delete-account-link" 
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina account definitivamente (GDPR)
                      </button>
                    ) : (
                      <div className="delete-confirm-box-redesigned">
                        <strong>Sei sicuro? Tutti i tuoi esami e orari sul cloud verranno cancellati.</strong>
                        <div className="delete-confirm-actions">
                          <button type="button" className="ghost-btn" onClick={() => setShowDeleteConfirm(false)}>
                            Annulla
                          </button>
                          <button type="button" className="delete-confirm-btn" onClick={handleDeleteAccount} disabled={deleteLoading}>
                            {deleteLoading ? 'Eliminazione...' : 'Conferma Eliminazione'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* PROFILE EDIT FORM */
              <form onSubmit={saveProfileEdit} className="profile-edit-form">
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input 
                    type="text" 
                    value={profileEdit.fullName}
                    onChange={(e) => setProfileEdit({ ...profileEdit, fullName: e.target.value })}
                    maxLength={50}
                    placeholder="Es. Mario Rossi"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Università</label>
                    <input 
                      type="text" 
                      value={profileEdit.university}
                      onChange={(e) => setProfileEdit({ ...profileEdit, university: e.target.value })}
                      maxLength={80}
                      placeholder="Es. Statale di Milano"
                    />
                  </div>
                  <div className="form-group">
                    <label>Corso di Laurea</label>
                    <input 
                      type="text" 
                      value={profileEdit.degreeCourse}
                      onChange={(e) => setProfileEdit({ ...profileEdit, degreeCourse: e.target.value })}
                      maxLength={80}
                      placeholder="Es. Informatica"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Stato Attuale</label>
                  <select 
                    value={profileEdit.status}
                    onChange={(e) => setProfileEdit({ ...profileEdit, status: e.target.value })}
                  >
                    {statusOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Colore Avatar</label>
                  <div className="avatar-color-picker">
                    {avatarColors.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-dot ${profileEdit.avatarColor === color ? 'selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => setProfileEdit({ ...profileEdit, avatarColor: color })}
                      />
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Bio / Descrizione</label>
                  <textarea 
                    value={profileEdit.bio}
                    onChange={(e) => setProfileEdit({ ...profileEdit, bio: e.target.value })}
                    maxLength={200}
                    rows={2}
                    placeholder="Scrivi qualcosa sul tuo percorso..."
                  />
                </div>

                <div className="form-group-checkbox">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox"
                      checked={profileEdit.shareGrades}
                      onChange={(e) => setProfileEdit({ ...profileEdit, shareGrades: e.target.checked })}
                    />
                    <div className="checkbox-text">
                      <strong>Condividi la mia media e i voti con gli amici</strong>
                      <span>Se disattivato, i tuoi voti saranno nascosti e non potrai visualizzare i voti dei tuoi amici.</span>
                    </div>
                  </label>
                </div>

                <div className="form-actions-edit">
                  <button type="button" className="ghost-btn" onClick={() => setIsEditingProfile(false)}>
                    Annulla
                  </button>
                  <button type="submit" className="primary-btn">
                    Salva Modifiche
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* LOGIN TAB */}
        {(authModalTab === 'login' || authModalTab === 'google') && (
          <form onSubmit={handleLoginSubmit} className="account-tab-content auth-form">
            {/* Google 1-Click Official Button Mount Container */}
            <div id="google-btn-login" className="google-official-btn-container"></div>

            {!googleClientId && (
              <button 
                type="button" 
                className="google-auth-btn" 
                onClick={handleGoogleAuth}
                disabled={loading}
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

            <div className="auth-divider-line">
              <span>oppure con credenziali</span>
            </div>

            <div className="form-group">
              <label>Username o Email</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  value={loginForm.identifier}
                  onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                  placeholder="Username o email universitaria"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showLoginPassword ? 'text' : 'password'} 
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle-eye"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  tabIndex={-1}
                  title={showLoginPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '6px' }}>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { 
                    setAuthModalTab('reset'); 
                    setErrorMsg(''); 
                    setResetSuccess(''); 
                    setResetStep(1);
                  }}
                >
                  Password dimenticata?
                </button>
              </div>
            </div>

            <button type="submit" className="primary-btn submit-btn" disabled={loading}>
              <LogIn size={18} />
              <span>{loading ? 'Accesso in corso...' : 'Accedi a UniPlanner'}</span>
            </button>

            <div className="restore-backup-login-row">
              <button 
                type="button" 
                className="restore-backup-login-btn"
                onClick={() => jsonFileInputRef.current?.click()}
              >
                <FolderUp size={14} />
                <span>Hai un file di backup? <strong>Ripristina da JSON</strong></span>
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD RESET TAB (2-STEP OTP FLOW) */}
        {authModalTab === 'reset' && (
          <div className="account-tab-content auth-form">
            {resetStep === 1 ? (
              <form onSubmit={handleRequestResetOtp}>
                <div style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  🔑 Inserisci la tua <strong>email</strong> o il tuo <strong>username</strong>. Ti invieremo un codice di verifica numerico a 6 cifre per reimpostare la tua password in sicurezza.
                </div>

                <div className="form-group">
                  <label>Email o Username Registrato</label>
                  <div className="input-with-icon">
                    <Mail size={18} className="input-icon" />
                    <input 
                      type="text" 
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      placeholder="nome@universita.it oppure username"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button 
                    type="button" 
                    className="ghost-btn" 
                    onClick={() => { setAuthModalTab('login'); setErrorMsg(''); setResetSuccess(''); setResetStep(1); }}
                  >
                    Annulla
                  </button>
                  <button type="submit" className="primary-btn" disabled={loading || !resetIdentifier.trim()} style={{ flex: 1 }}>
                    <span>{loading ? 'Invio in corso...' : 'Invia Codice OTP'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyResetOtp}>
                <div style={{ marginBottom: '14px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px', fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  ✉️ Abbiamo inviato un codice OTP a 6 cifre all'indirizzo associato a <strong>{resetIdentifier}</strong>. Inseriscilo insieme alla nuova password.
                </div>

                {resetDevOtp && (
                  <div style={{
                    marginBottom: '14px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600', color: '#10b981' }}>🔑 Codice di Verifica:</span>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '18px',
                        fontWeight: '700',
                        letterSpacing: '2px',
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.15)',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {resetDevOtp}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Il codice è stato inviato anche via push alert.
                    </p>
                  </div>
                )}

                <div className="form-group">
                  <label>Codice OTP a 6 Cifre</label>
                  <div className="input-with-icon">
                    <KeyRound size={18} className="input-icon" />
                    <input 
                      type="text" 
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Nuova Password (min. 8 caratteri, lettere e numeri)</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input 
                      type={showResetPassword ? 'text' : 'password'} 
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                    <button 
                      type="button" 
                      className="password-toggle-eye"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      tabIndex={-1}
                      title={showResetPassword ? "Nascondi password" : "Mostra password"}
                    >
                      {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button 
                    type="button" 
                    className="ghost-btn" 
                    onClick={() => { setResetStep(1); setErrorMsg(''); setResetSuccess(''); }}
                  >
                    Indietro
                  </button>
                  <button type="submit" className="primary-btn" disabled={loading || resetOtp.length !== 6 || resetNewPassword.length < 8} style={{ flex: 1 }}>
                    <span>{loading ? 'Reimpostazione...' : 'Reimposta Password'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* OTP VERIFICATION TAB (2FA) */}
        {authModalTab === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="account-tab-content auth-form">
            <div style={{ marginBottom: '14px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px', fontSize: '13px', color: 'var(--text-primary)' }}>
              🛡️ <strong>Verifica 2FA Richiesta:</strong> Inserisci il codice numerico monouso a 6 cifre per accedere al tuo account.
            </div>

            {otpForm.devOtp && (
              <div style={{
                marginBottom: '14px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '12px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#10b981' }}>🔑 Codice di Accesso:</span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fontWeight: '700',
                    letterSpacing: '2px',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {otpForm.devOtp}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Codice di verifica provvisorio per ambiente di collaudo.
                </p>
              </div>
            )}

            <div className="form-group">
              <label>Codice OTP a 6 Cifre</label>
              <div className="input-with-icon">
                <KeyRound size={18} className="input-icon" />
                <input 
                  type="text" 
                  value={otpForm.otp}
                  onChange={(e) => setOtpForm({ ...otpForm, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="123456"
                  maxLength={6}
                  style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button 
                type="button" 
                className="ghost-btn" 
                onClick={() => { setAuthModalTab('login'); setErrorMsg(''); }}
              >
                Annulla
              </button>
              <button type="submit" className="primary-btn" disabled={loading || otpForm.otp.length !== 6} style={{ flex: 1 }}>
                <span>{loading ? 'Verifica in corso...' : 'Conferma Accesso'}</span>
              </button>
            </div>
          </form>
        )}

        {/* REGISTER TAB */}
        {authModalTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="account-tab-content auth-form">
            {/* Google 1-Click Official Button Mount Container */}
            <div id="google-btn-register" className="google-official-btn-container"></div>

            {!googleClientId && (
              <button 
                type="button" 
                className="google-auth-btn" 
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" className="google-icon">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Registrati con Google</span>
              </button>
            )}

            <div className="auth-divider-line">
              <span>oppure crea un account</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Username Univoco</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input 
                    type="text" 
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    placeholder="es. marco_uni"
                    maxLength={20}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Nome e Cognome</label>
                <input 
                  type="text" 
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                  placeholder="Es. Marco Rossi"
                  maxLength={50}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Studente</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  placeholder="nome@universita.it"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password (min. 8 caratteri, requisiti di sicurezza)</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showRegisterPassword ? 'text' : 'password'} 
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle-eye"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  tabIndex={-1}
                  title={showRegisterPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {registerForm.password && (
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', marginBottom: '6px' }}>
                    <div style={{ 
                      width: `${(passStrength.score / 5) * 100}%`, 
                      background: passStrength.score <= 2 ? '#ef4444' : passStrength.score <= 3 ? '#f59e0b' : '#10b981',
                      transition: 'width 0.3s ease, background 0.3s ease' 
                    }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: 'var(--text-muted, #94a3b8)' }}>
                    <span style={{ color: passStrength.checks.length ? '#10b981' : undefined }}>{passStrength.checks.length ? '✓' : '•'} 8+ caratteri</span>
                    <span style={{ color: (passStrength.checks.uppercase || passStrength.checks.lowercase) ? '#10b981' : undefined }}>{(passStrength.checks.uppercase || passStrength.checks.lowercase) ? '✓' : '•'} Lettere (A-z)</span>
                    <span style={{ color: passStrength.checks.number ? '#10b981' : undefined }}>{passStrength.checks.number ? '✓' : '•'} Almeno 1 Numero</span>
                    <span style={{ color: passStrength.checks.special ? '#10b981' : undefined }}>{passStrength.checks.special ? '✓' : '•'} Simboli (opzionali)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Università</label>
                <input 
                  type="text" 
                  value={registerForm.university}
                  onChange={(e) => setRegisterForm({ ...registerForm, university: e.target.value })}
                  placeholder="Es. Polimi, Sapienza..."
                  maxLength={80}
                />
              </div>
              <div className="form-group">
                <label>Corso di Laurea</label>
                <input 
                  type="text" 
                  value={registerForm.degreeCourse}
                  onChange={(e) => setRegisterForm({ ...registerForm, degreeCourse: e.target.value })}
                  placeholder="Es. Ingegneria, Economia..."
                  maxLength={80}
                />
              </div>
            </div>

            {onOpenLegal && (
              <div className="register-legal-terms-row">
                <ShieldCheck size={16} className="legal-shield-icon" />
                <p>
                  Registrandoti accetti i{' '}
                  <button type="button" className="legal-inline-btn" onClick={() => onOpenLegal('terms')}>
                    Termini di Servizio
                  </button>{' '}
                  e confermi di aver letto l'
                  <button type="button" className="legal-inline-btn" onClick={() => onOpenLegal('privacy')}>
                    Informativa Privacy (GDPR)
                  </button>.
                </p>
              </div>
            )}

            <button type="submit" className="primary-btn submit-btn" disabled={loading}>
              <Sparkles size={18} />
              <span>{loading ? 'Creazione in corso...' : 'Crea Account Studente'}</span>
            </button>

            <div className="restore-backup-login-row">
              <button 
                type="button" 
                className="restore-backup-login-btn"
                onClick={() => jsonFileInputRef.current?.click()}
              >
                <FolderUp size={14} />
                <span>Hai un file di backup? <strong>Ripristina da JSON</strong></span>
              </button>
            </div>
          </form>
        )}

        {/* MODALE INTERATTIVA ACCESSO GOOGLE 1-CLICK */}
        {showGooglePicker && (
          <div className="google-picker-backdrop animate-fade">
            <div className="google-picker-card">
              <div className="google-picker-header">
                <div className="google-picker-logo">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                </div>
                <h4>Accedi con Google</h4>
                <p>Scegli un account per continuare su UniPlanner</p>
              </div>

              <div className="google-picker-accounts">
                {/* Account Rilevato nel browser / Principale */}
                <button 
                  type="button" 
                  className="google-account-item default-account"
                  onClick={() => handleSelectGoogleAccount('bologniniedoardo@gmail.com', 'Edoardo Bolognini')}
                  disabled={loading}
                >
                  <div className="google-account-avatar">
                    <span>E</span>
                  </div>
                  <div className="google-account-details">
                    <span className="google-account-name">Edoardo Bolognini</span>
                    <span className="google-account-email">bologniniedoardo@gmail.com</span>
                  </div>
                  <span className="google-account-badge">1-Click</span>
                </button>

                {/* Secondo account di prova o personalizzato */}
                {!isCustomGoogleMode ? (
                  <button 
                    type="button" 
                    className="google-account-item add-account"
                    onClick={() => setIsCustomGoogleMode(true)}
                  >
                    <div className="google-account-avatar add-icon">
                      <UserPlus size={16} />
                    </div>
                    <div className="google-account-details">
                      <span className="google-account-name">Usa un altro account Google</span>
                    </div>
                  </button>
                ) : (
                  <div className="google-custom-account-box">
                    <input 
                      type="email" 
                      placeholder="La tua email (@gmail.com o studenti...)" 
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      className="google-custom-input"
                      autoFocus
                    />
                    <input 
                      type="text" 
                      placeholder="Il tuo nome (es. Marco)" 
                      value={customGoogleName}
                      onChange={(e) => setCustomGoogleName(e.target.value)}
                      className="google-custom-input"
                    />
                    <div className="google-custom-actions">
                      <button type="button" className="ghost-btn" onClick={() => setIsCustomGoogleMode(false)}>
                        Indietro
                      </button>
                      <button 
                        type="button" 
                        className="primary-btn" 
                        disabled={!customGoogleEmail || loading}
                        onClick={() => handleSelectGoogleAccount(customGoogleEmail, customGoogleName)}
                      >
                        Entra con Google
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="google-picker-footer-tip">
                <Sparkles size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <span>
                  <strong>Come nei siti ufficiali:</strong> Se configuri <code>VITE_GOOGLE_CLIENT_ID</code> su Vercel, questo popup viene sostituito in automatico dal widget ufficiale One Tap di Google.
                </span>
              </div>

              <button type="button" className="google-picker-close-btn" onClick={() => setShowGooglePicker(false)}>
                Annulla
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AccountModal;
