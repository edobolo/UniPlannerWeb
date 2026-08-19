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
  Scale
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateShareLink } from '../utils/cloudSync';
import { safeJsonParse } from '../utils/security';
import './AccountModal.css';

const AccountModal = ({ onOpenLegal }) => {
  const { 
    currentUser, 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    authModalTab, 
    setAuthModalTab, 
    login, 
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
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleCopyCode = () => {
    if (!currentUser?.friendCode) return;
    navigator.clipboard.writeText(currentUser.friendCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await login(loginForm.identifier, loginForm.password);
      setLoginForm({ identifier: '', password: '' });
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Errore durante l\'accesso.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
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
            className={`account-tab-btn ${authModalTab === 'login' ? 'active' : ''}`}
            onClick={() => { setAuthModalTab('login'); setErrorMsg(''); }}
          >
            <LogIn size={16} />
            <span>{currentUser ? 'Cambia Account' : 'Accedi'}</span>
          </button>
          <button 
            className={`account-tab-btn ${authModalTab === 'register' ? 'active' : ''}`}
            onClick={() => { setAuthModalTab('register'); setErrorMsg(''); }}
          >
            <UserPlus size={16} />
            <span>Nuovo Account</span>
          </button>
        </div>

        {errorMsg && (
          <div className="account-alert error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PROFILE TAB */}
        {authModalTab === 'profile' && currentUser && (
          <div className="account-tab-content">
            {!isEditingProfile ? (
              <div className="profile-view">
                <div className="profile-card-top">
                  <div 
                    className="profile-avatar-large" 
                    style={{ background: currentUser.avatarColor || '#8b5cf6' }}
                  >
                    {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="profile-info-main">
                    <h4>{currentUser.fullName}</h4>
                    <span className="profile-username">@{currentUser.username}</span>
                    <span className="profile-status-pill">{currentUser.status || 'Libero ☕'}</span>
                  </div>
                </div>

                <div className="friend-code-box">
                  <div className="friend-code-left">
                    <span className="code-label">Link di Condivisione Profilo:</span>
                    <strong className="code-value" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Invita amici con 1 clic</strong>
                  </div>
                  <button 
                    className={`copy-code-btn ${copiedLink ? 'copied' : ''}`}
                    onClick={handleCopyShareLink}
                  >
                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedLink ? 'Link Copiato!' : 'Copia Link'}</span>
                  </button>
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

                {currentUser.bio && (
                  <div className="profile-bio-box">
                    <p>{currentUser.bio}</p>
                  </div>
                )}

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
            </div>

            <button type="submit" className="primary-btn submit-btn" disabled={loading}>
              <LogIn size={18} />
              <span>{loading ? 'Accesso in corso...' : 'Accedi a UniPlanner'}</span>
            </button>
          </form>
        )}

        {/* REGISTER TAB */}
        {authModalTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="account-tab-content auth-form">
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
              <label>Password (min. 6 caratteri)</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
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
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default AccountModal;
