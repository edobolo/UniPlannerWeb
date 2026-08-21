import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Search, 
  School, 
  GraduationCap, 
  Calendar, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  Award, 
  Sparkles, 
  X, 
  ChevronRight, 
  Copy, 
  Check, 
  AlertCircle,
  TrendingUp,
  MapPin,
  Lock,
  Shield,
  Share2,
  ExternalLink,
  MessageCircle,
  Link as LinkIcon,
  RotateCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { safeJsonParse } from '../utils/security';
import { generateShareLink, fetchUserProfile, publishUserProfile, connectMutualFriend, fetchMyFriendsList } from '../utils/cloudSync';
import './Friends.css';

const STORAGE_FRIENDS_KEY = 'uniplanner_friends_db_v2';

const MINI_START_HOUR = 8;
const MINI_END_HOUR = 19;
const MINI_HOUR_HEIGHT = 40; // px per hour in mini calendar

const Friends = () => {
  const { currentUser, setIsAuthModalOpen } = useAuth();

  const [friends, setFriends] = useState(() => {
    // Purge any legacy mock friends
    const legacy = safeJsonParse(localStorage.getItem('uniplanner_friends_db_v1'), []);
    const cleanLegacy = legacy.filter(f => f.id !== 'fr_marco' && !f.id?.startsWith('fr_'));
    if (cleanLegacy.length > 0) {
      localStorage.setItem(STORAGE_FRIENDS_KEY, JSON.stringify(cleanLegacy));
    }
    localStorage.removeItem('uniplanner_friends_db_v1');

    const saved = safeJsonParse(localStorage.getItem(STORAGE_FRIENDS_KEY), []);
    return saved.filter(f => f.id !== 'fr_marco' && !f.fullName?.includes('(UP-'));
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(() => {
    const saved = safeJsonParse(localStorage.getItem(STORAGE_FRIENDS_KEY), []);
    const clean = saved.filter(f => f.id !== 'fr_marco' && !f.fullName?.includes('(UP-'));
    return clean.length > 0 ? clean[0] : null;
  });
  const [activeFriendTab, setActiveFriendTab] = useState('exams'); // 'exams' | 'deadlines' | 'schedule' | 'common'
  
  // Add Friend Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshingFriend, setIsRefreshingFriend] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_FRIENDS_KEY, JSON.stringify(friends));
  }, [friends]);

  // Sync current user's profile to Raspberry Pi backend on mount/update
  useEffect(() => {
    if (currentUser && currentUser.friendCode) {
      try {
        const savedExams = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);
        const savedSchedule = safeJsonParse(localStorage.getItem('uniplanner_schedule_v1'), []);
        const savedDeadlines = safeJsonParse(localStorage.getItem('uniplanner_deadlines'), []);
        publishUserProfile(currentUser, savedExams, savedSchedule, savedDeadlines);
      } catch (e) {
        console.warn('Sync profile err:', e);
      }
    }
  }, [currentUser]);

  // Live Refresh specific friend data from Raspberry Pi
  const handleRefreshFriendData = async (friendCode) => {
    if (!friendCode) return;
    setIsRefreshingFriend(true);
    try {
      const fresh = await fetchUserProfile(friendCode);
      if (fresh) {
        setSelectedFriend(fresh);
        setFriends(prev => {
          const map = new Map();
          prev.forEach(f => map.set((f.friendCode || f.username || f.id).toUpperCase(), f));
          map.set((fresh.friendCode || fresh.username || fresh.id).toUpperCase(), fresh);
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.warn('Refresh friend err:', e);
    } finally {
      setIsRefreshingFriend(false);
    }
  };

  // Auto-refresh selected friend when opening tab or selecting friend
  useEffect(() => {
    if (selectedFriend?.friendCode) {
      handleRefreshFriendData(selectedFriend.friendCode);
    }
  }, [activeFriendTab, selectedFriend?.friendCode]);

  // Download mutual friends list automatically from Raspberry Pi
  useEffect(() => {
    if (currentUser?.friendCode) {
      const syncMutualFriends = async () => {
        try {
          const cloudFriends = await fetchMyFriendsList(currentUser.friendCode);
          if (cloudFriends && cloudFriends.length > 0) {
            setFriends(prev => {
              const map = new Map();
              cloudFriends.forEach(cf => {
                const key = (cf.friendCode || cf.username || cf.id).toUpperCase();
                map.set(key, cf);
              });
              prev.forEach(pf => {
                const key = (pf.friendCode || pf.username || pf.id).toUpperCase();
                if (!map.has(key)) map.set(key, pf);
              });
              const merged = Array.from(map.values());
              if (!selectedFriend && merged.length > 0) {
                setSelectedFriend(merged[0]);
              }
              return merged;
            });
          }
        } catch (err) {
          console.warn('Sync mutual friends err:', err);
        }
      };

      syncMutualFriends();
    }
  }, [currentUser]);

  const handleCopyMyCode = () => {
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

  const handleSendWhatsApp = () => {
    if (!currentUser) return;
    const link = generateShareLink(currentUser);
    if (!link) return;
    const text = encodeURIComponent(`Ciao! Aggiungimi su UniPlanner con il mio Codice Amico ${currentUser.friendCode} oppure tramite link diretto: ${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    const cleanInput = newFriendInput.trim();
    if (!cleanInput) {
      setAddError('Inserisci il Codice Amico, l\'username o il link del tuo compagno di corso.');
      return;
    }

    if (currentUser && (cleanInput.toUpperCase() === currentUser.friendCode?.toUpperCase() || cleanInput.toLowerCase() === currentUser.username?.toLowerCase())) {
      setAddError('Non puoi aggiungere te stesso come amico.');
      return;
    }

    setIsSearching(true);
    try {
      // 1. Interroga il server sul Raspberry Pi!
      const realFriendProfile = await fetchUserProfile(cleanInput);

      if (!realFriendProfile || (!realFriendProfile.fullName && !realFriendProfile.username)) {
        setAddError(`Nessun account trovato per "${cleanInput}". Assicurati che il tuo amico si sia registrato su UniPlanner e ti abbia fornito il suo Codice Amico esatto.`);
        setIsSearching(false);
        return;
      }

      const alreadyFriend = friends.some(
        f => (f.friendCode && f.friendCode.toUpperCase() === realFriendProfile.friendCode?.toUpperCase()) ||
             (f.username && f.username.toLowerCase() === realFriendProfile.username?.toLowerCase())
      );
      if (alreadyFriend) {
        setAddError('Questo studente è già presente nella tua lista amici.');
        setIsSearching(false);
        return;
      }

      // 2. Crea l'amicizia RECIPROCA sul Raspberry Pi (anche lui ti vedrà in automatico!)
      if (currentUser?.friendCode) {
        await connectMutualFriend(currentUser.friendCode, realFriendProfile.friendCode || cleanInput);
      }

      setFriends(prev => [realFriendProfile, ...prev]);
      setSelectedFriend(realFriendProfile);
      setAddSuccess(`Amico ${realFriendProfile.fullName || realFriendProfile.username} aggiunto con successo!`);
      setNewFriendInput('');
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddSuccess('');
      }, 1200);
    } catch (err) {
      setAddError('Errore di connessione al server. Verifica che il server sia attivo e riprova.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveFriend = (friendId) => {
    const updated = friends.filter(f => f.id !== friendId);
    setFriends(updated);
    if (selectedFriend?.id === friendId) {
      setSelectedFriend(updated[0] || null);
    }
  };

  const filteredFriends = friends.filter(f => 
    (f.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.degreeCourse || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.university || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if current user is sharing grades
  const userSharesGrades = currentUser?.shareGrades !== false;
  // Reciprocity rule: can only view friend's grades if current user is sharing AND friend is sharing
  const canViewFriendGrades = userSharesGrades && (selectedFriend?.shareGrades !== false);

  // Mini schedule helper calculation
  const miniHours = Array.from({ length: MINI_END_HOUR - MINI_START_HOUR + 1 }, (_, i) => MINI_START_HOUR + i);
  const weekDayHeaders = [
    { name: 'LUN', index: 0 },
    { name: 'MAR', index: 1 },
    { name: 'MER', index: 2 },
    { name: 'GIO', index: 3 },
    { name: 'VEN', index: 4 }
  ];

  const timeToMiniTop = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    const mins = (h * 60 + m) - (MINI_START_HOUR * 60);
    return Math.max(0, (mins / 60) * MINI_HOUR_HEIGHT);
  };

  const timeToMiniHeight = (startTime, endTime) => {
    if (!startTime || !endTime) return MINI_HOUR_HEIGHT;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return Math.max(26, (durationMinutes / 60) * MINI_HOUR_HEIGHT);
  };

  return (
    <div className="friends-page-container">
      {/* Top Header */}
      <div className="friends-header">
        <div>
          <h1 className="friends-title">Amici & Compagni di Corso</h1>
          <p className="friends-subtitle">
            Confronta i piani di studio, visualizza le scadenze e sincronizza i tuoi orari con i compagni di ateneo.
          </p>
        </div>

        <div className="header-actions-group">
          {/* My Friend Code Badge */}
          <div className="my-friend-code-card">
            <span className="code-label">Il tuo Codice Amico:</span>
            <div className="code-pill">
              <strong>{currentUser?.friendCode || 'Accedi o Registrati'}</strong>
              {currentUser ? (
                <button 
                  className="code-copy-btn" 
                  onClick={handleCopyMyCode}
                  title="Copia codice amico"
                >
                  {copiedCode ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
                </button>
              ) : (
                <button 
                  className="code-copy-btn" 
                  onClick={() => setIsAuthModalOpen(true)}
                  title="Accedi o crea un account"
                >
                  <UserPlus size={14} />
                </button>
              )}
            </div>
          </div>

          {currentUser && (
            <button 
              className="ghost-btn share-profile-btn" 
              onClick={() => setIsShareModalOpen(true)}
              title="Condividi il tuo link o invia su WhatsApp"
            >
              <Share2 size={17} />
              <span>Condividi</span>
            </button>
          )}

          <button className="primary-btn add-friend-btn" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus size={18} />
            <span>Aggiungi Amico</span>
          </button>
        </div>
      </div>

      {/* Main Friends View: Split Layout */}
      <div className="friends-layout-grid">
        {/* Left Column: Friends List */}
        <div className="friends-sidebar-panel glass-panel">
          <div className="search-bar-wrap">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Cerca per nome, corso o ateneo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="friends-list-container">
            {filteredFriends.length > 0 ? (
              filteredFriends.map((friend) => {
                const isSelected = selectedFriend?.id === friend.id;
                return (
                  <motion.div
                    key={friend.id}
                    className={`friend-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedFriend(friend);
                    }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div 
                      className="friend-avatar" 
                      style={{ background: friend.avatarColor || '#3b82f6' }}
                    >
                      {(friend.fullName || friend.username || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="friend-info">
                      <div className="friend-name-row">
                        <h4>{friend.fullName}</h4>
                        <span className="friend-status-badge">{friend.status}</span>
                      </div>
                      <span className="friend-course">{friend.degreeCourse}</span>
                      <span className="friend-uni">{friend.university}</span>
                    </div>

                    <ChevronRight size={18} className="arrow-icon" />
                  </motion.div>
                );
              })
            ) : (
              <div className="no-friends-box">
                <Users size={36} />
                <p>Nessun amico trovato</p>
                <button className="secondary-btn" onClick={() => setIsAddModalOpen(true)}>
                  Aggiungi un amico
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Selected Friend Detail */}
        <div className="friend-detail-panel glass-panel">
          {selectedFriend ? (
            <div className="friend-detail-wrapper">
              {/* Detail Header */}
              <div className="friend-detail-header">
                <div className="detail-header-left">
                  <div 
                    className="avatar-detail-large"
                    style={{ background: selectedFriend.avatarColor || '#3b82f6' }}
                  >
                    {(selectedFriend.fullName || selectedFriend.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="detail-name-row">
                      <h2>{selectedFriend.fullName}</h2>
                      <span className="friend-code-tag">{selectedFriend.university}</span>
                    </div>
                    <span className="detail-sub">@{selectedFriend.username} • {selectedFriend.status}</span>
                    <p className="detail-bio">{selectedFriend.bio}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="ghost-btn refresh-friend-btn"
                    onClick={() => handleRefreshFriendData(selectedFriend.friendCode)}
                    disabled={isRefreshingFriend}
                    title="Aggiorna orario ed esami dell'amico in tempo reale dal Raspberry Pi"
                  >
                    <RotateCw size={15} className={isRefreshingFriend ? 'spin-animation' : ''} />
                    <span>{isRefreshingFriend ? 'Aggiornamento...' : 'Aggiorna'}</span>
                  </button>

                  <button 
                    className="ghost-btn remove-friend-btn"
                    onClick={() => handleRemoveFriend(selectedFriend.id)}
                    title="Rimuovi amico"
                  >
                    <X size={16} />
                    <span>Rimuovi</span>
                  </button>
                </div>
              </div>

              {/* Friend Stats Bar */}
              <div className="friend-stats-strip">
                <div className="friend-stat-item">
                  <span className="stat-label">Media Voti</span>
                  {canViewFriendGrades ? (
                    <strong className="stat-value">{selectedFriend.stats?.avgGrade ?? '—'}</strong>
                  ) : (
                    <strong className="stat-value privacy-locked" title="Privacy attiva">
                      <Lock size={13} /> Nascosto
                    </strong>
                  )}
                </div>
                <div className="friend-stat-item">
                  <span className="stat-label">Progresso CFU</span>
                  <strong className="stat-value">{selectedFriend.stats?.cfu ?? 0} / {selectedFriend.stats?.totalCfu ?? '—'}</strong>
                </div>
                <div className="friend-stat-item">
                  <span className="stat-label">Esami Superati</span>
                  <strong className="stat-value">{selectedFriend.stats?.passedExams ?? 0} / {selectedFriend.stats?.totalExams ?? '—'}</strong>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="friend-nav-tabs">
                <button 
                  className={`f-tab ${activeFriendTab === 'exams' ? 'active' : ''}`}
                  onClick={() => setActiveFriendTab('exams')}
                >
                  <BookOpen size={16} />
                  <span>Piano di Studi</span>
                </button>
                <button 
                  className={`f-tab ${activeFriendTab === 'deadlines' ? 'active' : ''}`}
                  onClick={() => setActiveFriendTab('deadlines')}
                >
                  <Calendar size={16} />
                  <span>Scadenze ({(selectedFriend.deadlines || []).length})</span>
                </button>
                <button 
                  className={`f-tab ${activeFriendTab === 'schedule' ? 'active' : ''}`}
                  onClick={() => setActiveFriendTab('schedule')}
                >
                  <Clock size={16} />
                  <span>Orario Lezioni</span>
                </button>
                <button 
                  className={`f-tab ${activeFriendTab === 'common' ? 'active' : ''}`}
                  onClick={() => setActiveFriendTab('common')}
                >
                  <Sparkles size={16} />
                  <span>In Comune 🤝</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="friend-tab-body">
                {/* 1. EXAMS TAB */}
                {activeFriendTab === 'exams' && (
                  <div className="f-exams-list">
                    <div className="f-section-header">
                      <h3 className="section-title">Esami di {selectedFriend.fullName}</h3>
                      {!userSharesGrades && (
                        <span className="privacy-active-tag">
                          <Lock size={12} /> La tua privacy voti è attiva
                        </span>
                      )}
                    </div>

                    {!canViewFriendGrades && (
                      <div className="privacy-warning-banner">
                        <Lock size={18} className="privacy-banner-icon" />
                        <div>
                          <strong>Condivisione Voti Riservata</strong>
                          <p>
                            {!userSharesGrades 
                              ? 'Hai scelto di nascondere la tua media e i tuoi voti. Per principio di reciprocità, attiva la condivisione nelle impostazioni del tuo Profilo per poter visualizzare i voti dei tuoi amici.'
                              : `${selectedFriend.fullName} ha scelto di non condividere pubblicamente i propri voti individuali.`}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="f-exam-grid">
                      {(selectedFriend.exams || []).map((exam, idx) => (
                        <div key={idx} className={`f-exam-card ${exam.status}`}>
                          <div className="f-exam-top">
                            <span className="exam-status-dot" />
                            <h4>{exam.name}</h4>
                          </div>
                          <div className="f-exam-bottom">
                            <span className="cfu-pill">{exam.cfu} CFU</span>
                            {exam.status === 'passed' ? (
                              canViewFriendGrades ? (
                                <span className="grade-badge">Voto: <strong>{exam.grade}</strong></span>
                              ) : (
                                <span className="grade-badge locked">
                                  <Lock size={11} /> <strong>Superato</strong>
                                </span>
                              )
                            ) : (
                              <span className="planned-badge">Previsto: {exam.date || 'Prossima sessione'}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. DEADLINES TAB */}
                {activeFriendTab === 'deadlines' && (
                  <div className="f-deadlines-list">
                    <h3 className="section-title">Prossime Scadenze Condivise</h3>
                    {(selectedFriend.deadlines || []).length > 0 ? (
                      <div className="deadlines-col">
                        {(selectedFriend.deadlines || []).map((dl) => (
                          <div key={dl.id} className="f-deadline-card" style={{ borderLeftColor: dl.color || '#8b5cf6' }}>
                            <div className="dl-main">
                              <span className="dl-tag" style={{ background: dl.color + '22', color: dl.color }}>{dl.tag}</span>
                              <h4>{dl.title}</h4>
                            </div>
                            <div className="dl-date">
                              <Calendar size={14} />
                              <span>{dl.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-text">Nessuna scadenza in programma.</p>
                    )}
                  </div>
                )}

                {/* 3. SCHEDULE TAB: Google Calendar Mini Style */}
                {activeFriendTab === 'schedule' && (
                  <div className="f-schedule-view">
                    <div className="f-schedule-header-row">
                      <h3 className="section-title">Orario Settimanale di {selectedFriend.fullName}</h3>
                      <span className="mini-gcal-badge">Vista Calendario</span>
                    </div>

                    {selectedFriend.schedule && selectedFriend.schedule.length > 0 ? (
                      <div className="mini-gcal-container">
                        {/* Day Headers */}
                        <div className="mini-gcal-header-row">
                          <div className="mini-time-corner"></div>
                          {weekDayHeaders.map(day => (
                            <div key={day.index} className="mini-day-header">
                              <span>{day.name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Calendar Grid Body */}
                        <div className="mini-gcal-grid">
                          {/* Time Column Gutter */}
                          <div className="mini-time-gutter">
                            {miniHours.map(h => (
                              <div key={h} className="mini-time-cell" style={{ height: MINI_HOUR_HEIGHT }}>
                                <span className="mini-time-label">{String(h).padStart(2, '0')}:00</span>
                              </div>
                            ))}
                          </div>

                          {/* Day Columns */}
                          <div className="mini-day-columns">
                            {/* Horizontal grid lines */}
                            <div className="mini-hour-lines">
                              {miniHours.map(h => (
                                <div key={h} className="mini-hour-line" style={{ height: MINI_HOUR_HEIGHT }} />
                              ))}
                            </div>

                            {/* 5 Columns (Lun - Ven) */}
                            {weekDayHeaders.map(day => {
                              const dayLessons = selectedFriend.schedule.filter(s => {
                                if (s.dayIndex !== undefined) return s.dayIndex === day.index;
                                const dayStr = String(s.day || '').toLowerCase();
                                if (day.index === 0 && dayStr.includes('lun')) return true;
                                if (day.index === 1 && dayStr.includes('mar')) return true;
                                if (day.index === 2 && dayStr.includes('mer')) return true;
                                if (day.index === 3 && dayStr.includes('gio')) return true;
                                if (day.index === 4 && dayStr.includes('ven')) return true;
                                return false;
                              });

                              return (
                                <div key={day.index} className="mini-day-col">
                                  {dayLessons.map((les, lIdx) => {
                                    const top = timeToMiniTop(les.startTime || (les.time ? les.time.split(' - ')[0] : '09:00'));
                                    const height = timeToMiniHeight(
                                      les.startTime || (les.time ? les.time.split(' - ')[0] : '09:00'),
                                      les.endTime || (les.time ? les.time.split(' - ')[1] : '11:00')
                                    );
                                    const color = les.color || '#38bdf8';

                                    return (
                                      <div
                                        key={lIdx}
                                        className="mini-lesson-card"
                                        style={{
                                          top: `${top}px`,
                                          height: `${height}px`,
                                          backgroundColor: `${color}20`,
                                          borderColor: `${color}66`,
                                          borderLeft: `4px solid ${color}`
                                        }}
                                        title={`${les.subject}\nOrario: ${les.startTime || les.time}\nAula: ${les.room || 'N/D'}\n${les.professor ? 'Docente: ' + les.professor : ''}`}
                                      >
                                        <div className="mini-lesson-subject" style={{ color: color }}>
                                          {les.subject}
                                        </div>
                                        <div className="mini-lesson-meta">
                                          <span className="mini-time-tag">
                                            {les.startTime ? `${les.startTime} - ${les.endTime}` : les.time}
                                          </span>
                                          {les.room && (
                                            <span className="mini-room-tag">
                                              <MapPin size={10} />
                                              {les.room}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="empty-text">Nessuna lezione registrata nell'orario.</p>
                    )}
                  </div>
                )}

                {/* 4. IN COMMON TAB */}
                {activeFriendTab === 'common' && (
                  <div className="f-common-view">
                    <h3 className="section-title">Cosa avete in comune?</h3>
                    <div className="common-highlight-box">
                      <div className="common-item">
                        <Award size={22} className="common-icon" />
                        <div>
                          <strong>Sessioni di Studio Condivise</strong>
                          <p>Potete avviare il Timer Pomodoro insieme per massimizzare la concentrazione durante le sessioni d'esame.</p>
                        </div>
                      </div>

                      <div className="common-item">
                        <Clock size={22} className="common-icon" />
                        <div>
                          <strong>Fasce Orarie Libere</strong>
                          <p>Entrambi siete liberi il <strong>Venerdì pomeriggio</strong> per studiare o organizzare progetti universitari.</p>
                        </div>
                      </div>

                      <div className="common-item">
                        <BookOpen size={22} className="common-icon" />
                        <div>
                          <strong>Materie del Percorso</strong>
                          <p>Condividete l'interesse per le tecnologie e i corsi di sviluppo software.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-selection-placeholder empty-friends-welcome">
              <div className="empty-icon-circle">
                <Users size={46} />
              </div>
              <h3>{friends.length === 0 ? 'Nessun compagno di corso aggiunto' : 'Seleziona un amico dalla lista'}</h3>
              <p>
                {friends.length === 0 
                  ? 'Connettiti con i tuoi colleghi di ateneo tramite il Codice Amico per confrontare i piani di studio, sincronizzare gli orari e vedere quando siete entrambi liberi per studiare.'
                  : 'Clicca su un profilo a sinistra per visualizzare il suo piano di studi, le sue scadenze e l\'orario delle lezioni.'}
              </p>
              {friends.length === 0 && (
                <button className="primary-btn add-first-friend-btn" onClick={() => setIsAddModalOpen(true)}>
                  <UserPlus size={18} />
                  <span>Aggiungi il tuo primo Amico</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Friend Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content glass-panel add-friend-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="modal-header">
                <h2>Aggiungi un Amico</h2>
                <button className="icon-btn" onClick={() => setIsAddModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddFriend} className="add-friend-form">
                <p className="add-friend-desc">
                  Inserisci il <strong>Codice Amico</strong> (es. <code>UP-MARCO</code>) oppure incolla il link inviato dal tuo compagno di corso:
                </p>

                <div className="form-group">
                  <label>Codice Amico o Link</label>
                  <input 
                    type="text" 
                    placeholder="Es. UP-8K3X9 oppure link https://.../?u=..."
                    value={newFriendInput}
                    onChange={(e) => setNewFriendInput(e.target.value)}
                    required
                  />
                </div>

                {addError && (
                  <div className="modal-alert error">
                    <AlertCircle size={16} />
                    <span>{addError}</span>
                  </div>
                )}

                {addSuccess && (
                  <div className="modal-alert success">
                    <CheckCircle2 size={16} />
                    <span>{addSuccess}</span>
                  </div>
                )}

                <div className="modal-actions-custom">
                  <button type="button" className="ghost-btn" onClick={() => setIsAddModalOpen(false)} disabled={isSearching}>
                    Annulla
                  </button>
                  <button type="submit" className="primary-btn" disabled={isSearching}>
                    <UserPlus size={16} />
                    <span>{isSearching ? 'Ricerca in corso...' : 'Cerca e Aggiungi'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Profile Modal */}
      <AnimatePresence>
        {isShareModalOpen && currentUser && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content glass-panel add-friend-modal share-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Share2 size={20} className="guide-sparkle-icon" />
                  <h2>Condividi il tuo Profilo</h2>
                </div>
                <button className="icon-btn" onClick={() => setIsShareModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="share-modal-body">
                <p className="add-friend-desc">
                  I tuoi compagni possono aggiungerti inserendo il tuo **Codice Amico** oppure aprendo il tuo link diretto:
                </p>

                {/* Friend Code Display */}
                <div className="share-code-box">
                  <span className="share-code-label">Il tuo Codice Amico:</span>
                  <div className="share-code-row">
                    <span className="share-code-text">{currentUser.friendCode}</span>
                    <button className="sm-btn primary-btn" onClick={handleCopyMyCode}>
                      {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCode ? 'Copiato!' : 'Copia'}</span>
                    </button>
                  </div>
                </div>

                {/* Magic Share Link Box */}
                <div className="share-actions-group">
                  <button className="primary-btn share-action-wide" onClick={handleCopyShareLink}>
                    <LinkIcon size={16} />
                    <span>{copiedLink ? 'Link Copiato negli Appunti! ✓' : 'Copia Link Diretto di Invito'}</span>
                  </button>

                  <button className="ghost-btn whatsapp-share-btn" onClick={handleSendWhatsApp}>
                    <MessageCircle size={16} />
                    <span>Invia su WhatsApp</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Friends;
