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
  const [otpForm, setOtpForm] = useState({ friendCode: '', otp: '' });
  const [twoFactorToggling, setTwoFactorToggling] = useState(false);
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
        setOtpForm({ friendCode: res.friendCode, otp: '' });
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
      await verify2FA(otpForm.friendCode, otpForm.otp);
      setOtpForm({ friendCode: '', otp: '' });
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Codice OTP non valido o scaduto.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setLoading(true);

    const googleClientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';

    if (googleClientId && typeof window !== 'undefined') {
      try {
        if (!window.google?.accounts?.id) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              if (response.credential) {
                await loginWithGoogle(response.credential);
                setIsAuthModalOpen(false);
              }
            } catch (err) {
              setErrorMsg(err.message || 'Accesso con Google non riuscito.');
            } finally {
              setLoading(false);
            }
          }
        });

        window.google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn('Errore GIS:', err);
      }
    }

    // Modalità guidata prompt se Client ID non è ancora in .env
    try {
      const email = prompt('Accedi con il tuo indirizzo Google:', 'studente@gmail.com');
      if (!email) {
        setLoading(false);
        return;
      }
      const name = email.split('@')[0];
      await loginWithGoogle(null, {
        email: email.trim(),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
      });
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Accesso con Google non riuscito.');
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
          <div className="account-tab-content">
            {!isEditingProfile ? (
              <div className="profile-view">
                <div className="profile-card-top">
                  <div 
                    className={`profile-avatar-large ${currentUser.isPremium ? 'is-pro-avatar' : ''}`} 
                    style={{ background: currentUser.avatarColor || '#8b5cf6' }}
                  >
                    {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()}
                    {currentUser.isPremium && (
                      <span className="avatar-crown-badge large-crown" title="Membro PRO 👑">
                        <Crown size={13} />
                      </span>
                    )}
                  </div>
                  <div className="profile-info-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4>{currentUser.fullName}</h4>
                      {currentUser.isPremium && (
                        <span className="account-pro-pill" title="Membro PRO 👑">
                          <Crown size={12} /> Membro PRO
                        </span>
                      )}
                    </div>
                    <span className="profile-username">@{currentUser.username}</span>
                    <span className="profile-status-pill">{currentUser.status || 'Libero ☕'}</span>
                  </div>
                </div>

                <div className="friend-code-box">
                  <div className="friend-code-left">
                    <span className="code-label">Il tuo Codice Amico:</span>
                    <strong className="code-value">{currentUser.friendCode}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className={`copy-code-btn ${copiedCode ? 'copied' : ''}`}
                      onClick={handleCopyCode}
                      title="Copia codice amico"
                    >
                      {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedCode ? 'Copiato!' : 'Codice'}</span>
                    </button>
                    <button 
                      className={`copy-code-btn ${copiedLink ? 'copied' : ''}`}
                      onClick={handleCopyShareLink}
                      title="Copia link breve"
                    >
                      {copiedLink ? <Check size={16} /> : <Sparkles size={16} />}
                      <span>{copiedLink ? 'Link Copiato!' : 'Link'}</span>
                    </button>
                  </div>
                </div>

                <div className="profile-details-grid">
                  <div className="detail-item">
                    <School size={16} className="detail-icon" />
                    <div>
                      <span className="detail-label">Università</span>
                      <strong className="detail-val">{currentUser.university || 'Non specificata'}</strong>
                    </div>
                  </div>
                  <div className="detail-item">
                    <GraduationCap size={16} className="detail-icon" />
                    <div>
                      <span className="detail-label">Corso di Studi</span>
                      <strong className="detail-val">{currentUser.degreeCourse || 'Non specificato'}</strong>
                    </div>
                  </div>
                  <div className="detail-item full">
                    <Mail size={16} className="detail-icon" />
                    <div>
                      <span className="detail-label">Email</span>
                      <strong className="detail-val">{currentUser.email}</strong>
                    </div>
                  </div>
                </div>

                {/* Privacy Card */}
                <div className="profile-privacy-box">
                  <div className="privacy-box-header">
                    <div className="privacy-title-group">
                      <Lock size={15} className="privacy-icon" />
                      <span className="privacy-title">Condivisione Voti & Media</span>
                    </div>
                    <span className={`privacy-badge ${currentUser.shareGrades !== false ? 'shared' : 'hidden'}`}>
                      {currentUser.shareGrades !== false ? 'Visibili agli amici' : '🔒 Nascosti (Privacy)'}
                    </span>
                  </div>
                  <p className="privacy-desc">
                    {currentUser.shareGrades !== false 
                      ? 'I tuoi amici possono vedere la tua media e i voti dei tuoi esami. Puoi anche visualizzare i voti dei tuoi amici.'
                      : 'Hai nascosto i tuoi voti e la media. Per reciprocità, non puoi visualizzare i voti e la media dei tuoi compagni.'}
                  </p>
                  <button 
                    type="button" 
                    className="privacy-toggle-btn"
                    onClick={toggleGradePrivacyQuick}
                  >
                    {currentUser.shareGrades !== false ? 'Nascondi i miei voti agli amici' : 'Condividi voti con gli amici'}
                  </button>
                </div>

                {/* Two-Factor Authentication (2FA) Card */}
                <div className="profile-privacy-box" style={{ marginTop: '12px' }}>
                  <div className="privacy-box-header">
                    <div className="privacy-title-group">
                      <KeyRound size={15} className="privacy-icon" style={{ color: currentUser.twoFactorEnabled ? '#10b981' : '#f59e0b' }} />
                      <span className="privacy-title">Autenticazione a Due Fattori (2FA / OTP)</span>
                    </div>
                    <span className={`privacy-badge ${currentUser.twoFactorEnabled ? 'shared' : 'hidden'}`}>
                      {currentUser.twoFactorEnabled ? '🛡️ Attiva (OTP)' : '⚠️ Disattivata'}
                    </span>
                  </div>
                  <p className="privacy-desc">
                    {currentUser.twoFactorEnabled 
                      ? 'Il tuo account richiede una verifica crittografica con codice OTP a 6 cifre ad ogni accesso per bloccare intrusioni.'
                      : 'Proteggi il tuo account abilitando il codice OTP a 6 cifre inviato ad ogni tentativo di accesso.'}
                  </p>
                  <button 
                    type="button" 
                    className="privacy-toggle-btn"
                    disabled={twoFactorToggling}
                    onClick={handleToggle2FA}
                    style={{ borderColor: currentUser.twoFactorEnabled ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)', color: currentUser.twoFactorEnabled ? '#ef4444' : '#10b981' }}
                  >
                    {twoFactorToggling ? 'Aggiornamento...' : (currentUser.twoFactorEnabled ? 'Disattiva Protezione 2FA' : 'Attiva Protezione 2FA')}
                  </button>
                </div>

                {/* Notification Settings Card */}
                <div className="profile-privacy-box" style={{ marginTop: '12px' }}>
                  <div className="privacy-box-header">
                    <div className="privacy-title-group">
                      {notificationsEnabled ? <Bell size={15} className="privacy-icon" style={{ color: '#38bdf8' }} /> : <BellOff size={15} className="privacy-icon" style={{ color: '#ef4444' }} />}
                      <span className="privacy-title">Notifiche & Avvisi App</span>
                    </div>
                    <span className={`privacy-badge ${notificationsEnabled ? 'shared' : 'hidden'}`}>
                      {notificationsEnabled ? '🔔 Attive (ON)' : '🔕 Disattivate (OFF)'}
                    </span>
                  </div>
                  <p className="privacy-desc">
                    {notificationsEnabled 
                      ? 'Ricevi avvisi per lezioni imminenti, scadenze dei compiti ed esami.'
                      : 'Notifiche e suoni disattivati. Nessun avviso pop-up verrà mostrato.'}
                  </p>
                  <button 
                    type="button" 
                    className="privacy-toggle-btn"
                    onClick={toggleNotifSetting}
                    style={{ borderColor: notificationsEnabled ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)', color: notificationsEnabled ? '#ef4444' : '#38bdf8' }}
                  >
                    {notificationsEnabled ? 'Disattiva Notifiche' : 'Attiva Notifiche'}
                  </button>
                </div>

                {/* Smartphone Shortcuts & Widget Info Card */}
                <div className="profile-privacy-box" style={{ marginTop: '12px' }}>
                  <div className="privacy-box-header">
                    <div className="privacy-title-group">
                      <Smartphone size={15} className="privacy-icon" style={{ color: '#10b981' }} />
                      <span className="privacy-title">Widget & Scorciatoie Schermata Home</span>
                    </div>
                    <span className="privacy-badge shared" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      ⚡ Rapido 1-Tap
                    </span>
                  </div>
                  <p className="privacy-desc">
                    Tieni premuta l'icona di UniPlanner sullo schermo del telefono per accedere subito a: <strong>Orario Lezioni</strong>, <strong>Timer Pomodoro</strong>, <strong>Piano Esami</strong> o <strong>Assistente AI</strong>.
                  </p>
                </div>

                {currentUser.bio && (
                  <div className="profile-bio-box">
                    <p>{currentUser.bio}</p>
                  </div>
                )}

                {/* Stripe Customer Portal for PRO members */}
                {currentUser?.isPremium && (
                  <div className="profile-privacy-box" style={{ marginTop: '12px', border: '1px solid rgba(245, 158, 11, 0.35)', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.05))' }}>
                    <div className="privacy-box-header">
                      <div className="privacy-title-group">
                        <CreditCard size={15} style={{ color: '#f59e0b' }} />
                        <span className="privacy-title" style={{ color: '#f59e0b', fontWeight: 700 }}>Gestione Abbonamento PRO</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenStripePortal}
                        disabled={isOpeningPortal}
                        className="privacy-toggle-btn"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', borderColor: 'transparent' }}
                      >
                        {isOpeningPortal ? 'Apertura...' : 'Apri Portale Stripe'}
                        <ExternalLink size={12} style={{ marginLeft: 4 }} />
                      </button>
                    </div>
                    <p className="privacy-desc">
                      Accedi al portale ufficiale di Stripe per aggiornare il metodo di pagamento, visualizzare le fatture o gestire la tua sottoscrizione in self-service.
                    </p>
                  </div>
                )}

                {/* Data Backup & Privacy Export (GDPR) */}
                <div className="profile-privacy-box" style={{ marginTop: '12px' }}>
                  <div className="privacy-box-header">
                    <div className="privacy-title-group">
                      <Download size={15} className="privacy-icon" style={{ color: '#38bdf8' }} />
                      <span className="privacy-title">Backup & Ripristino Dati</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleExportData}
                        className="privacy-toggle-btn"
                        style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                        title="Scarica un file .json con tutti i tuoi dati"
                      >
                        <Download size={12} style={{ marginRight: 4 }} />
                        Scarica JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => jsonFileInputRef.current?.click()}
                        className="privacy-toggle-btn"
                        style={{ borderColor: 'rgba(168, 85, 247, 0.4)', color: '#c084fc' }}
                        title="Carica un file .json per ripristinare il tuo percorso"
                      >
                        <Upload size={12} style={{ marginRight: 4 }} />
                        Carica Backup
                      </button>
                    </div>
                  </div>
                  <p className="privacy-desc">
                    Esporta o ripristina in qualsiasi momento tutti i tuoi esami, voti, orari, appunti e statistiche tramite file di backup JSON.
                  </p>
                </div>

                {onOpenLegal && (
                  <button 
                    type="button" 
                    className="profile-legal-trigger-btn"
                    onClick={() => onOpenLegal('privacy')}
                  >
                    <Scale size={14} />
                    <span>Informativa Privacy & Termini d'Uso (GDPR)</span>
                  </button>
                )}

                {/* Zona Pericolo / Eliminazione Account GDPR */}
                <div className="profile-danger-zone">
                  <div className="danger-zone-header">
                    <div className="privacy-title-group">
                      <Trash2 size={16} className="danger-icon" />
                      <span className="danger-title">Eliminazione Account & Privacy GDPR</span>
                    </div>
                  </div>
                  <p className="danger-desc">
                    Richiedi l'eliminazione definitiva dell'account e di tutti i dati associati (Diritto all'Oblio).
                    {currentUser?.isPremium && (
                      <strong style={{ display: 'block', marginTop: 5, color: '#f59e0b' }}>
                        💳 L'abbonamento PRO su Stripe verrà annullato automaticamente senza ulteriori addebiti.
                      </strong>
                    )}
                  </p>
                  
                  {showDeleteConfirm ? (
                    <div className="delete-account-confirm-box">
                      <div className="confirm-text">
                        <strong>⚠️ Sei assolutamente sicuro?</strong>
                        <span>Tutti i tuoi dati cloud, esami, orari e crediti verranno eliminati. Questa azione non può essere annullata.</span>
                      </div>
                      <div className="confirm-buttons">
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
                      className="danger-action-btn"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 size={14} />
                      <span>Elimina il mio Account</span>
                    </button>
                  )}
                </div>

                <div className="profile-actions">
                  <button className="secondary-btn" onClick={startEditProfile}>
                    <Edit3 size={16} />
                    <span>Modifica Profilo</span>
                  </button>
                  <button className="ghost-btn logout-btn" onClick={logout}>
                    <LogOut size={16} />
                    <span>Disconnetti</span>
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
              <span>Continua con Google</span>
            </button>

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
              🛡️ <strong>Verifica 2FA Richiesta:</strong> Inserisci il codice numerico monouso a 6 cifre per accedere al tuo account in modo sicuro.
            </div>

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
