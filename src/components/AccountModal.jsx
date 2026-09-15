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
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateShareLink, resetUserPassword, apiFetch, publishUserProfile } from '../utils/cloudSync';
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
  const [resetForm, setResetForm] = useState({ friendCode: '', email: '', newPassword: '' });
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

  if (!isAuthModalOpen) return null;

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

  const handleGoogleAuth = () => {
    setErrorMsg('');
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
      return;
    }

    setErrorMsg('Per attivare l\'accesso 1-click con Google, inserisci il tuo VITE_GOOGLE_CLIENT_ID gratuito nel file .env.');
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
    
    // Validazione robustezza password
    const strength = checkPasswordStrength(registerForm.password);
    if (!strength.isStrong) {
      setErrorMsg('La password non soddisfa tutti i requisiti di sicurezza (minimo 8 caratteri, maiuscola, minuscola, numero, simbolo speciale).');
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

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setResetSuccess('');
    setLoading(true);
    try {
      const res = await resetUserPassword(resetForm.friendCode, resetForm.email, resetForm.newPassword);
      setResetSuccess(res.message || 'Password aggiornata con successo! Ora puoi accedere.');
      setResetForm({ friendCode: '', email: '', newPassword: '' });
    } catch (err) {
      setErrorMsg(err.message || 'Impossibile resettare la password. Verifica i dati inseriti.');
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
            className={`account-tab-btn ${authModalTab === 'login' || authModalTab === 'otp' ? 'active' : ''}`}
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

                {/* 3. Sub-Navigation Tabs (Segmented Control) */}
                <div className="profile-segmented-nav">
                  <button 
                    type="button"
                    className={`profile-seg-btn ${profileSubTab === 'academic' ? 'active' : ''}`}
                    onClick={() => setProfileSubTab('academic')}
                  >
                    <GraduationCap size={15} />
                    <span>Dati Studi</span>
                  </button>
                  <button 
                    type="button"
                    className={`profile-seg-btn ${profileSubTab === 'security' ? 'active' : ''}`}
                    onClick={() => setProfileSubTab('security')}
                  >
                    <ShieldCheck size={15} />
                    <span>Sicurezza & 2FA</span>
                  </button>
                  <button 
                    type="button"
                    className={`profile-seg-btn ${profileSubTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setProfileSubTab('settings')}
                  >
                    <Download size={15} />
                    <span>Backup & Dati</span>
                  </button>
                </div>

                {/* 4. TAB CONTENTS */}
                <div className="profile-subtab-body">
                  {/* TAB 1: ACADEMIC */}
                  {profileSubTab === 'academic' && (
                    <div className="profile-tab-section animate-fade">
                      <div className="academic-details-box">
                        <div className="academic-detail-row">
                          <School size={16} className="detail-icon" />
                          <div className="academic-detail-text">
                            <span className="label">Università / Ateneo:</span>
                            <strong>{currentUser.university || 'Non specificata'}</strong>
                          </div>
                        </div>

                        <div className="academic-detail-row">
                          <GraduationCap size={16} className="detail-icon" />
                          <div className="academic-detail-text">
                            <span className="label">Corso di Laurea:</span>
                            <strong>{currentUser.degreeCourse || 'Non specificato'}</strong>
                          </div>
                        </div>

                        {currentUser.bio && (
                          <div className="academic-detail-row full">
                            <div className="academic-detail-text bio-text">
                              <span className="label">Bio accademica:</span>
                              <p>{currentUser.bio}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Privacy Voti */}
                      <div className="profile-setting-card">
                        <div className="setting-card-left">
                          <div className="setting-icon-box">
                            <Lock size={16} />
                          </div>
                          <div>
                            <strong>Condivisione Voti tra Amici</strong>
                            <p>
                              {currentUser.shareGrades !== false 
                                ? 'I tuoi voti e la media sono visibili ai tuoi compagni di corso collegati.' 
                                : 'I tuoi voti sono nascosti per motivi di privacy (reciprocità attiva).'}
                            </p>
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

                      <div className="profile-tab-action">
                        <button type="button" className="primary-btn full-width" onClick={startEditProfile}>
                          <Edit3 size={15} />
                          <span>Modifica Dati Accademici</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SECURITY & 2FA */}
                  {profileSubTab === 'security' && (
                    <div className="profile-tab-section animate-fade">
                      {/* 2FA Card */}
                      <div className="profile-setting-card">
                        <div className="setting-card-left">
                          <div className="setting-icon-box" style={{ background: currentUser.twoFactorEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: currentUser.twoFactorEnabled ? '#10b981' : '#f59e0b' }}>
                            <KeyRound size={16} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong>Autenticazione a Due Fattori (2FA / OTP)</strong>
                              <span className={`status-pill-mini ${currentUser.twoFactorEnabled ? 'active' : 'inactive'}`}>
                                {currentUser.twoFactorEnabled ? 'Attiva' : 'Disattivata'}
                              </span>
                            </div>
                            <p>
                              {currentUser.twoFactorEnabled
                                ? 'Protezione attiva: ad ogni accesso riceverai un codice monouso a 6 cifre via email per verificare la tua identità.'
                                : 'Abilita il codice OTP monouso inviato via email ad ogni accesso per proteggere il tuo account da intrusioni.'}
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          className={`switch-toggle-btn ${currentUser.twoFactorEnabled ? 'danger-off' : 'on'}`}
                          disabled={twoFactorToggling}
                          onClick={handleToggle2FA}
                        >
                          <span>{twoFactorToggling ? 'Attesa...' : (currentUser.twoFactorEnabled ? 'Disattiva' : 'Attiva')}</span>
                        </button>
                      </div>

                      {/* Info Crittografia & Sessione */}
                      <div className="security-notice-box">
                        <ShieldCheck size={18} />
                        <div>
                          <strong>Sessione Sicura & Dati Crittografati</strong>
                          <p>
                            UniPlanner non salva mai token di sessione in LocalStorage. Tutti i cookie e gli scambi cloud sono protetti con crittografia end-to-end e conformi al Regolamento GDPR (UE 2016/679).
                          </p>
                        </div>
                      </div>

                      {onOpenLegal && (
                        <button 
                          type="button" 
                          className="legal-link-pill-btn"
                          onClick={() => onOpenLegal('privacy')}
                        >
                          <Scale size={14} />
                          <span>Leggi Informativa Privacy & Diritti Studente (GDPR)</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* TAB 3: SETTINGS & BACKUP */}
                  {profileSubTab === 'settings' && (
                    <div className="profile-tab-section animate-fade">
                      {/* Notifiche */}
                      <div className="profile-setting-card">
                        <div className="setting-card-left">
                          <div className="setting-icon-box">
                            {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                          </div>
                          <div>
                            <strong>Notifiche & Suoni di Studio</strong>
                            <p>Avvisi sonori e pop-up per scadenze, orari di lezione e sessioni Pomodoro.</p>
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

                      {/* Backup & Ripristino */}
                      <div className="profile-backup-card">
                        <div className="backup-card-header">
                          <Download size={16} />
                          <div>
                            <strong>Salvataggio & Ripristino Dati (.JSON)</strong>
                            <p>Scarica una copia dei tuoi dati accademici o ripristina un salvataggio precedente.</p>
                          </div>
                        </div>
                        <div className="backup-btn-group">
                          <button type="button" className="secondary-btn" onClick={handleExportData}>
                            <Download size={14} />
                            <span>Scarica Backup (.json)</span>
                          </button>
                          <button type="button" className="secondary-btn" onClick={() => jsonFileInputRef.current?.click()}>
                            <Upload size={14} />
                            <span>Ripristina da File</span>
                          </button>
                        </div>
                      </div>

                      {/* Stripe Customer Portal se PRO */}
                      {currentUser?.isPremium && (
                        <div className="profile-stripe-card">
                          <div className="stripe-card-header">
                            <CreditCard size={16} style={{ color: '#f59e0b' }} />
                            <div>
                              <strong style={{ color: '#f59e0b' }}>Gestione Abbonamento PRO</strong>
                              <p>Gestisci il tuo piano, aggiorna la carta di credito o scarica le fatture dal portale ufficiale Stripe.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleOpenStripePortal}
                            disabled={isOpeningPortal}
                            className="primary-btn stripe-portal-btn"
                          >
                            <span>{isOpeningPortal ? 'Connessione...' : 'Apri Portale Stripe'}</span>
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      )}

                      {/* Scorciatoie Home Widget */}
                      <div className="profile-shortcuts-info">
                        <Smartphone size={15} />
                        <span><strong>Tip Mobile:</strong> Tieni premuta l'icona UniPlanner sullo schermo dello smartphone per avviare rapidamente Orario o Pomodoro.</span>
                      </div>

                      {/* Accordion Zona Pericolo */}
                      <div className="profile-danger-accordion">
                        <button 
                          type="button" 
                          className="danger-toggle-summary"
                          onClick={() => setDangerZoneOpen(!dangerZoneOpen)}
                        >
                          <Trash2 size={14} />
                          <span>Opzioni Avanzate: Eliminazione Account (Diritto all'Oblio)</span>
                        </button>

                        {dangerZoneOpen && (
                          <div className="danger-accordion-content animate-fade">
                            <p>L'eliminazione cancellerà definitivamente dal cloud tutti gli esami, orari e crediti associati al tuo Codice Amico.</p>
                            {showDeleteConfirm ? (
                              <div className="delete-confirm-box-redesigned">
                                <strong>⚠️ Confermi la cancellazione irreversibile?</strong>
                                <div className="delete-confirm-actions">
                                  <button type="button" className="ghost-btn" onClick={() => setShowDeleteConfirm(false)}>
                                    Annulla
                                  </button>
                                  <button type="button" className="delete-confirm-btn" onClick={handleDeleteAccount} disabled={deleteLoading}>
                                    {deleteLoading ? 'Eliminazione...' : 'Sì, Elimina Definitivamente'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button 
                                type="button" 
                                className="danger-btn-trigger" 
                                onClick={() => setShowDeleteConfirm(true)}
                              >
                                <Trash2 size={14} />
                                <span>Elimina il mio Account</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Footer Fisso con Logout */}
                <div className="profile-footer-bar">
                  <button type="button" className="ghost-btn profile-logout-btn" onClick={logout}>
                    <LogOut size={15} />
                    <span>Disconnetti Sessione</span>
                  </button>
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
        {authModalTab === 'login' && (
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
                  type="password" 
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: '6px' }}>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { setAuthModalTab('reset'); setErrorMsg(''); setResetSuccess(''); }}
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

        {/* FORGOT PASSWORD RESET TAB */}
        {authModalTab === 'reset' && (
          <form onSubmit={handleResetSubmit} className="account-tab-content auth-form">
            <div style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '10px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              🔑 Inserisci il tuo <strong>Codice Amico</strong> e l'<strong>Email</strong> usata per la registrazione per impostare una nuova password.
            </div>

            <div className="form-group">
              <label>Il tuo Codice Amico (es. UP-XXXX)</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  value={resetForm.friendCode}
                  onChange={(e) => setResetForm({ ...resetForm, friendCode: e.target.value })}
                  placeholder="UP-XXXX"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Indirizzo Email Registrato</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  value={resetForm.email}
                  onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                  placeholder="mario.rossi@studenti.it"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Nuova Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                  placeholder="Almeno 6 caratteri"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button 
                type="button" 
                className="ghost-btn" 
                onClick={() => { setAuthModalTab('login'); setErrorMsg(''); setResetSuccess(''); }}
              >
                Annulla
              </button>
              <button type="submit" className="primary-btn" disabled={loading} style={{ flex: 1 }}>
                <span>{loading ? 'Aggiornamento...' : 'Reimposta Password'}</span>
              </button>
            </div>
          </form>
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
                  Il codice è stato inviato anche via notifica push ntfy e precompilato qui sotto per consentirti l'accesso immediato.
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
                  type="password" 
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
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
                    <span style={{ color: passStrength.checks.uppercase ? '#10b981' : undefined }}>{passStrength.checks.uppercase ? '✓' : '•'} 1 Maiuscola</span>
                    <span style={{ color: passStrength.checks.lowercase ? '#10b981' : undefined }}>{passStrength.checks.lowercase ? '✓' : '•'} 1 Minuscola</span>
                    <span style={{ color: passStrength.checks.number ? '#10b981' : undefined }}>{passStrength.checks.number ? '✓' : '•'} 1 Numero</span>
                    <span style={{ color: passStrength.checks.special ? '#10b981' : undefined }}>{passStrength.checks.special ? '✓' : '•'} 1 Simbolo</span>
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
      </motion.div>
    </div>
  );
};

export default AccountModal;
