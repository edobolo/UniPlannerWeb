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
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sanitizeText, safeJsonParse } from '../utils/security';
import './Friends.css';

const STORAGE_FRIENDS_KEY = 'uniplanner_friends_db_v1';

const MINI_START_HOUR = 8;
const MINI_END_HOUR = 19;
const MINI_HOUR_HEIGHT = 40; // px per hour in mini calendar

const Friends = () => {
  const { currentUser, setIsAuthModalOpen } = useAuth();

  const [friends, setFriends] = useState(() => {
    return safeJsonParse(localStorage.getItem(STORAGE_FRIENDS_KEY), []);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(() => {
    const saved = safeJsonParse(localStorage.getItem(STORAGE_FRIENDS_KEY), []);
    return saved.length > 0 ? saved[0] : null;
  });
  const [activeFriendTab, setActiveFriendTab] = useState('exams'); // 'exams' | 'deadlines' | 'schedule' | 'common'
  
  // Add Friend Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFriendCode, setNewFriendCode] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_FRIENDS_KEY, JSON.stringify(friends));
  }, [friends]);

  const handleCopyMyCode = () => {
    if (!currentUser?.friendCode) return;
    navigator.clipboard.writeText(currentUser.friendCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleAddFriend = (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    const cleanInput = sanitizeText(newFriendCode, 30).trim().toUpperCase();
    if (!cleanInput) {
      setAddError('Inserisci un codice amico o username valido.');
      return;
    }

    if (currentUser && (cleanInput === currentUser.friendCode?.toUpperCase() || cleanInput === currentUser.username?.toUpperCase())) {
      setAddError('Non puoi aggiungere te stesso come amico.');
      return;
    }

    const alreadyFriend = friends.some(
      f => f.friendCode.toUpperCase() === cleanInput || f.username.toUpperCase() === cleanInput
    );
    if (alreadyFriend) {
      setAddError('Questo studente è già presente nella tua lista amici.');
      return;
    }

    // Dynamic test mock generated if custom code entered
    const newFriend = {
      id: `fr_${Date.now()}`,
      username: cleanInput.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      fullName: `Studente (${cleanInput})`,
      friendCode: cleanInput.startsWith('UP-') ? cleanInput : `UP-${cleanInput.slice(0, 5)}`,
      university: 'Università degli Studi',
      degreeCourse: 'Corso Universitario',
      avatarColor: '#8b5cf6',
      status: 'Libero ☕',
      bio: 'Studente collegato tramite codice amico.',
      shareGrades: true,
      stats: {
        cfu: 60,
        totalCfu: 180,
        avgGrade: 27.8,
        passedExams: 10,
        totalExams: 22
      },
      exams: [
        { name: 'Esame di Indirizzo I', grade: 28, cfu: 6, status: 'passed' },
        { name: 'Esame di Indirizzo II', grade: 29, cfu: 9, status: 'passed' },
        { name: 'Prossimo Appello', grade: null, cfu: 9, status: 'planned', date: '2026-09-18' }
      ],
      deadlines: [
        { id: `d_${Date.now()}`, title: 'Sessione di Studio Condivisa', date: '2026-09-01', tag: 'Studio', color: '#38bdf8' }
      ],
      schedule: [
        { dayIndex: 0, dayName: 'Lun', startTime: '10:00', endTime: '12:00', subject: 'Lezione Corso I', room: 'Aula 1', professor: 'Docente', color: '#38bdf8' },
        { dayIndex: 2, dayName: 'Mer', startTime: '14:00', endTime: '16:00', subject: 'Laboratorio', room: 'Lab 2', professor: 'Docente', color: '#10b981' }
      ]
    };

    setFriends(prev => [newFriend, ...prev]);
    setSelectedFriend(newFriend);
    setAddSuccess(`Amico ${newFriend.fullName} aggiunto con successo!`);
    setNewFriendCode('');
    setTimeout(() => {
      setIsAddModalOpen(false);
      setAddSuccess('');
    }, 1200);
  };

  const handleRemoveFriend = (friendId) => {
    const updated = friends.filter(f => f.id !== friendId);
    setFriends(updated);
    if (selectedFriend?.id === friendId) {
      setSelectedFriend(updated[0] || null);
    }
  };

  const filteredFriends = friends.filter(f => 
    f.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.degreeCourse.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.university.toLowerCase().includes(searchQuery.toLowerCase())
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
          {/* User's Friend Code Badge */}
          <div className="my-friend-code-card">
            <span className="code-label">Il tuo Codice Amico:</span>
            <div className="code-pill">
              <strong>{currentUser?.friendCode || 'Accedi o Registrati'}</strong>
              {currentUser ? (
                <button 
                  className="code-copy-btn" 
                  onClick={handleCopyMyCode}
                  title="Copia codice"
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
                      {friend.fullName.charAt(0).toUpperCase()}
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
                    {selectedFriend.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="detail-name-row">
                      <h2>{selectedFriend.fullName}</h2>
                      <span className="friend-code-tag">{selectedFriend.friendCode}</span>
                    </div>
                    <span className="detail-sub">@{selectedFriend.username} • {selectedFriend.status}</span>
                    <p className="detail-bio">{selectedFriend.bio}</p>
                  </div>
                </div>

                <button 
                  className="ghost-btn remove-friend-btn"
                  onClick={() => handleRemoveFriend(selectedFriend.id)}
                  title="Rimuovi amico"
                >
                  <X size={16} />
                  <span>Rimuovi</span>
                </button>
              </div>

              {/* Friend Stats Bar */}
              <div className="friend-stats-strip">
                <div className="friend-stat-item">
                  <span className="stat-label">Media Voti</span>
                  {canViewFriendGrades ? (
                    <strong className="stat-value">{selectedFriend.stats.avgGrade}</strong>
                  ) : (
                    <strong className="stat-value privacy-locked" title="Privacy attiva">
                      <Lock size={13} /> Nascosto
                    </strong>
                  )}
                </div>
                <div className="friend-stat-item">
                  <span className="stat-label">Progresso CFU</span>
                  <strong className="stat-value">{selectedFriend.stats.cfu} / {selectedFriend.stats.totalCfu}</strong>
                </div>
                <div className="friend-stat-item">
                  <span className="stat-label">Esami Superati</span>
                  <strong className="stat-value">{selectedFriend.stats.passedExams} / {selectedFriend.stats.totalExams}</strong>
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
                  <span>Scadenze ({selectedFriend.deadlines.length})</span>
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
                      {selectedFriend.exams.map((exam, idx) => (
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
                    {selectedFriend.deadlines.length > 0 ? (
                      <div className="deadlines-col">
                        {selectedFriend.deadlines.map((dl) => (
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
                  Inserisci il <strong>Codice Amico</strong> (es. <code>UP-MARCO</code>, <code>UP-GIULI</code>) oppure l'username dello studente per collegarvi.
                </p>

                <div className="form-group">
                  <label>Codice Amico o Username</label>
                  <input 
                    type="text" 
                    placeholder="Es. UP-8K3X9 o marco_rossi"
                    value={newFriendCode}
                    onChange={(e) => setNewFriendCode(e.target.value)}
                    maxLength={25}
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
                  <button type="button" className="ghost-btn" onClick={() => setIsAddModalOpen(false)}>
                    Annulla
                  </button>
                  <button type="submit" className="primary-btn">
                    <UserPlus size={16} />
                    <span>Conferma e Aggiungi</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Friends;
