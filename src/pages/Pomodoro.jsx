import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  Headphones, 
  Flame, 
  BookOpen, 
  FastForward, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ListTodo, 
  Sparkles,
  X,
  BellRing
} from 'lucide-react';
import { playAlarmSound, startAmbientSound, stopAmbientSound, setAmbientVolume } from '../utils/audioSynthesis';
import './Pomodoro.css';

const DEFAULT_SETTINGS = {
  workTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  alarmSound: 'bell', // 'bell', 'chime', 'gong', 'digital'
  alarmVolume: 0.8,
  ambientSound: 'none', // 'none', 'rain', 'waves', 'binaural', 'whitenoise'
  ambientVolume: 0.5,
  desktopNotifications: true
};

const AMBIENT_OPTIONS = [
  { id: 'none', label: 'Nessuno', icon: '🔇' },
  { id: 'rain', label: 'Pioggia Rilassante', icon: '🌧️' },
  { id: 'waves', label: 'Onde del Mare', icon: '🌊' },
  { id: 'binaural', label: 'Onde Alpha Focus (10Hz)', icon: '🧠' },
  { id: 'whitenoise', label: 'Rumore Bianco', icon: '💨' }
];

const ALARM_OPTIONS = [
  { id: 'bell', label: 'Campana Tibetana (Zen)' },
  { id: 'chime', label: 'Armonia Cristallina' },
  { id: 'gong', label: 'Gong Profondo' },
  { id: 'digital', label: 'Beep Digitale' }
];

const Pomodoro = () => {
  // Settings
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('uniplanner_pomodoro_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Exams from Study Plan
  const [exams, setExams] = useState(() => {
    const saved = localStorage.getItem('uniplanner_exams');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedExamId, setSelectedExamId] = useState(() => {
    return localStorage.getItem('uniplanner_pomodoro_selected_exam') || 'general';
  });

  // Tasks list for current session
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('uniplanner_pomodoro_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTaskText, setNewTaskText] = useState('');

  // Daily statistics
  const [stats, setStats] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('uniplanner_pomodoro_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === todayStr) {
        return parsed;
      } else {
        // New day: compute streak
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const isConsecutive = parsed.date === yesterday && parsed.todaySessions > 0;
        const newStreak = isConsecutive ? (parsed.streak || 1) + 1 : 1;
        return {
          date: todayStr,
          todaySessions: 0,
          todayMinutes: 0,
          totalSessions: parsed.totalSessions || 0,
          streak: newStreak
        };
      }
    }
    return {
      date: todayStr,
      todaySessions: 0,
      todayMinutes: 0,
      totalSessions: 0,
      streak: 1
    };
  });

  // Timer mode and state
  const [mode, setMode] = useState('pomodoro'); // 'pomodoro', 'shortBreak', 'longBreak'
  const [timeLeft, setTimeLeft] = useState(settings.workTime * 60);
  const [isActive, setIsActive] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0); // in current cycle
  
  // Ambient Sound State
  const [ambientSound, setAmbientSound] = useState(settings.ambientSound);
  const [ambientVol, setAmbientVol] = useState(settings.ambientVolume);

  // UI Modals / Zen Mode
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);

  const MODES = {
    pomodoro: { 
      label: 'Focus', 
      time: settings.workTime * 60, 
      color: '#ef4444', 
      colorGlow: 'rgba(239, 68, 68, 0.35)',
      badge: '🍅 Concentrazione'
    },
    shortBreak: { 
      label: 'Pausa Corta', 
      time: settings.shortBreakTime * 60, 
      color: '#06b6d4', 
      colorGlow: 'rgba(6, 182, 212, 0.35)',
      badge: '☕ Pausa Veloce'
    },
    longBreak: { 
      label: 'Pausa Lunga', 
      time: settings.longBreakTime * 60, 
      color: '#8b5cf6', 
      colorGlow: 'rgba(139, 92, 246, 0.35)',
      badge: '🌴 Ricarica Totale'
    }
  };

  // Sync exams and stats in localStorage
  useEffect(() => {
    localStorage.setItem('uniplanner_pomodoro_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('uniplanner_pomodoro_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('uniplanner_pomodoro_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('uniplanner_pomodoro_selected_exam', selectedExamId);
  }, [selectedExamId]);

  // Request desktop notification permission if enabled
  useEffect(() => {
    if (settings.desktopNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings.desktopNotifications]);

  // Document Title update
  useEffect(() => {
    if (isActive) {
      const modeEmoji = mode === 'pomodoro' ? '🍅' : '☕';
      document.title = `(${formatTime(timeLeft)}) ${modeEmoji} ${MODES[mode].label} - UniPlanner`;
    } else {
      document.title = 'Pomodoro Timer - UniPlanner';
    }
    return () => {
      document.title = 'UniPlanner';
    };
  }, [isActive, timeLeft, mode]);

  // Ambient sound management
  useEffect(() => {
    if (isActive && ambientSound !== 'none') {
      startAmbientSound(ambientSound, ambientVol);
    } else {
      stopAmbientSound();
    }
    return () => {
      stopAmbientSound();
    };
  }, [isActive, ambientSound, ambientVol]);

  // Handle ambient volume live adjustment
  const handleAmbientVolumeChange = (newVol) => {
    setAmbientVol(newVol);
    setAmbientVolume(newVol);
    setSettings(prev => ({ ...prev, ambientVolume: newVol }));
  };

  // Switch ambient sound
  const handleAmbientSoundChange = (soundId) => {
    setAmbientSound(soundId);
    setSettings(prev => ({ ...prev, ambientSound: soundId }));
    if (isActive && soundId !== 'none') {
      startAmbientSound(soundId, ambientVol);
    } else if (soundId === 'none') {
      stopAmbientSound();
    }
  };

  // Log study session completion
  const handleSessionComplete = () => {
    // 1. Play alert sound
    playAlarmSound(settings.alarmSound, settings.alarmVolume);

    // 2. Desktop notification
    if (settings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
      const title = mode === 'pomodoro' ? '🍅 Pomodoro Completato!' : '☕ Pausa Terminata!';
      const body = mode === 'pomodoro' 
        ? 'Grande lavoro! Prenditi una meritata pausa.' 
        : 'Pausa finita! Pronto per un nuovo blocco di concentrazione?';
      try {
        new Notification(title, { body, icon: '/vite.svg' });
      } catch (e) {
        console.log('Notification blocked', e);
      }
    }

    if (mode === 'pomodoro') {
      const minutesSpent = settings.workTime;
      const newPomodoroCount = pomodoroCount + 1;
      setPomodoroCount(newPomodoroCount);

      // Update today's stats
      setStats(prev => ({
        ...prev,
        todaySessions: prev.todaySessions + 1,
        todayMinutes: prev.todayMinutes + minutesSpent,
        totalSessions: prev.totalSessions + 1
      }));

      // Update study time for selected exam
      if (selectedExamId !== 'general') {
        const savedExams = localStorage.getItem('uniplanner_exams');
        const examList = savedExams ? JSON.parse(savedExams) : exams;
        const currentExam = examList.find(e => e.id.toString() === selectedExamId.toString());

        const updatedExams = examList.map(ex => {
          if (ex.id.toString() === selectedExamId.toString()) {
            return {
              ...ex,
              studyTimeMin: (ex.studyTimeMin || 0) + minutesSpent
            };
          }
          return ex;
        });

        setExams(updatedExams);
        localStorage.setItem('uniplanner_exams', JSON.stringify(updatedExams));

        // Add to Notifications Center
        const currentNotifs = JSON.parse(localStorage.getItem('uniplanner_notifications') || '[]');
        const examName = currentExam ? currentExam.name : 'Materia';
        const newNotif = {
          id: Date.now(),
          type: 'success',
          title: 'Sessione di Studio Registrata',
          message: `Hai completato ${minutesSpent} minuti di studio per "${examName}".`,
          date: new Date().toISOString()
        };
        localStorage.setItem('uniplanner_notifications', JSON.stringify([newNotif, ...currentNotifs]));
      }

      // Check if long break interval reached
      if (newPomodoroCount % settings.longBreakInterval === 0) {
        setMode('longBreak');
        setTimeLeft(settings.longBreakTime * 60);
        setIsActive(settings.autoStartBreaks);
      } else {
        setMode('shortBreak');
        setTimeLeft(settings.shortBreakTime * 60);
        setIsActive(settings.autoStartBreaks);
      }
    } else {
      // Break finished, return to pomodoro
      setMode('pomodoro');
      setTimeLeft(settings.workTime * 60);
      setIsActive(settings.autoStartPomodoros);
    }
  };

  // Timer Tick Interval
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      handleSessionComplete();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode, pomodoroCount, settings, selectedExamId, exams]);

  // Keybindings (Space to Play/Pause, Z for Zen Mode, Esc to close Zen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || isSettingsOpen) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsActive(prev => !prev);
      } else if (e.key === 'z' || e.key === 'Z') {
        setIsZenMode(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsZenMode(false);
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(MODES[mode].time);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(MODES[newMode].time);
  };

  const addFiveMinutes = () => {
    setTimeLeft(prev => prev + 300);
  };

  const skipToNext = () => {
    setIsActive(false);
    if (mode === 'pomodoro') {
      if ((pomodoroCount + 1) % settings.longBreakInterval === 0) {
        switchMode('longBreak');
      } else {
        switchMode('shortBreak');
      }
    } else {
      switchMode('pomodoro');
    }
  };

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Progress Calculation
  const totalModeTime = MODES[mode].time;
  const progress = Math.min(100, Math.max(0, ((totalModeTime - timeLeft) / totalModeTime) * 100));
  const radius = 125;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Task Handlers
  const handleAddTask = (e) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      const newTask = {
        id: Date.now(),
        text: newTaskText.trim(),
        completed: false
      };
      setTasks([...tasks, newTask]);
      setNewTaskText('');
    }
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const clearCompletedTasks = () => {
    setTasks(tasks.filter(t => !t.completed));
  };

  // Settings Save
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSettings(tempSettings);
    setIsSettingsOpen(false);

    // Apply active mode new duration if reset
    if (!isActive) {
      if (mode === 'pomodoro') setTimeLeft(tempSettings.workTime * 60);
      if (mode === 'shortBreak') setTimeLeft(tempSettings.shortBreakTime * 60);
      if (mode === 'longBreak') setTimeLeft(tempSettings.longBreakTime * 60);
    }
  };

  const selectedExam = exams.find(e => e.id.toString() === selectedExamId.toString());

  return (
    <div className="pomodoro-page-container">
      {/* Header with Stats & Actions */}
      <header className="pomodoro-header">
        <div className="header-left">
          <h1 className="page-title">Pomodoro Timer</h1>
          <p className="page-subtitle">Massimizza la concentrazione, sincronizza lo studio</p>
        </div>

        <div className="header-actions">
          <div className="streak-badge glass-panel" title="Giorni consecutivi di studio">
            <Flame size={18} className="streak-icon" />
            <span>{stats.streak} {stats.streak === 1 ? 'giorno' : 'giorni'} di fila</span>
          </div>

          <button 
            className="icon-btn-pill glass-panel" 
            onClick={() => setIsZenMode(true)}
            title="Modalità Zen / Schermo Intero (Tasto Z)"
          >
            <Maximize2 size={16} />
            <span>Zen Mode</span>
          </button>

          <button 
            className="icon-btn-pill glass-panel" 
            onClick={() => {
              setTempSettings(settings);
              setIsSettingsOpen(true);
            }}
            title="Impostazioni Timer"
          >
            <Settings size={16} />
            <span>Impostazioni</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Timer Area & Productivity Sidebar */}
      <div className="pomodoro-main-grid">
        {/* Left / Center: Modern Timer Card */}
        <div className="pomodoro-card glass-panel" style={{ '--theme-glow': MODES[mode].colorGlow }}>
          {/* Subject / Exam Selector */}
          <div className="exam-selector-bar">
            <div className="exam-selector-label-group">
              <BookOpen size={16} className="exam-icon" />
              <span className="exam-label">Materia di studio:</span>
            </div>
            <select 
              className="exam-select"
              value={selectedExamId} 
              onChange={e => setSelectedExamId(e.target.value)}
            >
              <option value="general">Studio Generale (Nessun esame specifico)</option>
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.year})
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="mode-selector">
            {Object.entries(MODES).map(([key, val]) => (
              <button 
                key={key} 
                className={`mode-btn ${mode === key ? 'active' : ''}`}
                style={mode === key ? { background: val.color, color: '#fff', boxShadow: `0 4px 15px ${val.colorGlow}` } : {}}
                onClick={() => switchMode(key)}
              >
                {val.label}
              </button>
            ))}
          </div>

          {/* SVG Circular Timer */}
          <div className="timer-wrapper">
            <svg className="timer-svg" width="310" height="310" viewBox="0 0 310 310">
              <circle
                className="timer-track"
                cx="155" cy="155" r={radius}
                strokeWidth="12"
              />
              <motion.circle
                className="timer-progress"
                cx="155" cy="155" r={radius}
                strokeWidth="12"
                stroke={MODES[mode].color}
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: "linear" }}
                style={{ strokeLinecap: 'round' }}
              />
            </svg>

            <div className="timer-display">
              <span className="time-badge" style={{ color: MODES[mode].color }}>
                {MODES[mode].badge}
              </span>
              <span className="time-text">{formatTime(timeLeft)}</span>
              {selectedExam && mode === 'pomodoro' && (
                <span className="selected-exam-tag">{selectedExam.name}</span>
              )}
            </div>
          </div>

          {/* Pomodoro Cycle Dots (e.g. 4 dots for 1 full cycle) */}
          <div className="cycle-progress-wrapper">
            <span className="cycle-label">Ciclo Focus:</span>
            <div className="cycle-dots">
              {Array.from({ length: settings.longBreakInterval }).map((_, index) => {
                const isCompleted = (pomodoroCount % settings.longBreakInterval) > index;
                const isCurrent = (pomodoroCount % settings.longBreakInterval) === index && mode === 'pomodoro';
                return (
                  <div 
                    key={index} 
                    className={`cycle-dot ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                    title={`Sessione ${index + 1} di ${settings.longBreakInterval}`}
                  />
                );
              })}
            </div>
            <span className="cycle-counter">
              {(pomodoroCount % settings.longBreakInterval)}/{settings.longBreakInterval}
            </span>
          </div>

          {/* Controls Bar */}
          <div className="timer-controls">
            <button 
              className="quick-adjust-btn ghost-btn" 
              onClick={addFiveMinutes}
              title="Aggiungi 5 minuti alla sessione corrente"
            >
              +5 min
            </button>

            <button 
              className="control-btn primary-btn main-play-btn" 
              onClick={toggleTimer} 
              style={{ background: MODES[mode].color, boxShadow: `0 8px 24px ${MODES[mode].colorGlow}` }}
              title={isActive ? "Pausa (Spazio)" : "Avvia (Spazio)"}
            >
              {isActive ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: 3 }} />}
            </button>

            <button 
              className="control-btn ghost-btn" 
              onClick={resetTimer}
              title="Ricomincia timer"
            >
              <RotateCcw size={22} />
            </button>

            <button 
              className="quick-adjust-btn ghost-btn" 
              onClick={skipToNext}
              title="Salta alla prossima fase"
            >
              <FastForward size={18} />
            </button>
          </div>
        </div>

        {/* Right Sidebar: Focus Audio, Daily Stats & Session Checklist */}
        <div className="pomodoro-sidebar">
          {/* Ambient Sound Dock */}
          <div className="sidebar-card glass-panel ambient-dock">
            <div className="card-heading">
              <div className="heading-title">
                <Headphones size={18} className="heading-icon" />
                <span>Suoni d'Ambiente Focus</span>
              </div>
              {ambientSound !== 'none' && (
                <span className="ambient-live-tag">In Riproduzione</span>
              )}
            </div>

            <div className="ambient-selector-grid">
              {AMBIENT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`ambient-btn ${ambientSound === opt.id ? 'active' : ''}`}
                  onClick={() => handleAmbientSoundChange(opt.id)}
                >
                  <span className="ambient-emoji">{opt.icon}</span>
                  <span className="ambient-btn-label">{opt.label}</span>
                </button>
              ))}
            </div>

            {ambientSound !== 'none' && (
              <div className="volume-slider-row">
                <Volume2 size={16} className="volume-icon" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={ambientVol}
                  onChange={e => handleAmbientVolumeChange(parseFloat(e.target.value))}
                  className="modern-range"
                />
                <span className="volume-percent">{Math.round(ambientVol * 100)}%</span>
              </div>
            )}
          </div>

          {/* Daily Productivity Stats */}
          <div className="sidebar-card glass-panel stats-card">
            <div className="card-heading">
              <div className="heading-title">
                <Sparkles size={18} className="heading-icon" />
                <span>Riepilogo di Oggi</span>
              </div>
            </div>

            <div className="daily-stats-row">
              <div className="stat-box">
                <span className="stat-number">{stats.todaySessions}</span>
                <span className="stat-desc">🍅 Pomodori</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-box">
                <span className="stat-number">{stats.todayMinutes}</span>
                <span className="stat-desc">⏱️ Minuti Totali</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-box">
                <span className="stat-number">{stats.totalSessions}</span>
                <span className="stat-desc">🏆 Totali App</span>
              </div>
            </div>
          </div>

          {/* Session Mini To-Do List */}
          <div className="sidebar-card glass-panel tasks-card">
            <div className="card-heading">
              <div className="heading-title">
                <ListTodo size={18} className="heading-icon" />
                <span>Obiettivi di Questa Sessione</span>
              </div>
              {tasks.filter(t => t.completed).length > 0 && (
                <button className="clear-completed-btn" onClick={clearCompletedTasks}>
                  Pulisci completati
                </button>
              )}
            </div>

            <form className="add-task-form" onSubmit={handleAddTask}>
              <input 
                type="text" 
                placeholder="Cosa vuoi completare in questi 25m?..."
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                className="task-input"
              />
              <button type="submit" className="add-task-btn" title="Aggiungi task">
                <Plus size={18} />
              </button>
            </form>

            <div className="tasks-list-scroll">
              <AnimatePresence>
                {tasks.length === 0 ? (
                  <p className="no-tasks-hint">Nessun obiettivo aggiunto. Scrivi cosa vuoi studiare per mantenere il focus!</p>
                ) : (
                  tasks.map(task => (
                    <motion.div 
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={`task-item ${task.completed ? 'completed' : ''}`}
                    >
                      <button 
                        className={`task-check-btn ${task.completed ? 'checked' : ''}`}
                        onClick={() => toggleTask(task.id)}
                      >
                        <CheckCircle2 size={18} />
                      </button>
                      <span className="task-text">{task.text}</span>
                      <button className="task-delete-btn" onClick={() => deleteTask(task.id)}>
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ZEN MODE (FULLSCREEN FOCUS) OVERLAY */}
      <AnimatePresence>
        {isZenMode && (
          <motion.div 
            className="zen-mode-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ '--zen-glow': MODES[mode].colorGlow }}
          >
            <div className="zen-header">
              <div className="zen-exam-info">
                <span className="zen-mode-badge" style={{ color: MODES[mode].color }}>
                  {MODES[mode].badge}
                </span>
                {selectedExam && <span className="zen-exam-name">• {selectedExam.name}</span>}
              </div>

              <button 
                className="zen-close-btn ghost-btn" 
                onClick={() => setIsZenMode(false)}
                title="Esci da Zen Mode (Esc)"
              >
                <Minimize2 size={18} />
                <span>Esci (Esc)</span>
              </button>
            </div>

            <div className="zen-center-content">
              <div className="zen-timer-wrapper">
                <svg className="zen-timer-svg" width="380" height="380" viewBox="0 0 380 380">
                  <circle
                    className="zen-timer-track"
                    cx="190" cy="190" r="160"
                    strokeWidth="14"
                  />
                  <motion.circle
                    className="zen-timer-progress"
                    cx="190" cy="190" r="160"
                    strokeWidth="14"
                    stroke={MODES[mode].color}
                    strokeDasharray={2 * Math.PI * 160}
                    strokeDashoffset={(2 * Math.PI * 160) - (progress / 100) * (2 * Math.PI * 160)}
                    transition={{ duration: 1, ease: "linear" }}
                    style={{ strokeLinecap: 'round' }}
                  />
                </svg>

                <div className="zen-timer-display">
                  <span className="zen-time-text">{formatTime(timeLeft)}</span>
                  <span className="zen-cycle-text">
                    Pomodoro {(pomodoroCount % settings.longBreakInterval) + 1} di {settings.longBreakInterval}
                  </span>
                </div>
              </div>

              <div className="zen-controls">
                <button 
                  className="zen-play-btn" 
                  onClick={toggleTimer}
                  style={{ background: MODES[mode].color, boxShadow: `0 10px 30px ${MODES[mode].colorGlow}` }}
                >
                  {isActive ? <Pause size={36} /> : <Play size={36} style={{ marginLeft: 4 }} />}
                </button>
                <button className="zen-btn ghost-btn" onClick={resetTimer} title="Ricomincia">
                  <RotateCcw size={24} />
                </button>
                <button className="zen-btn ghost-btn" onClick={skipToNext} title="Salta fase">
                  <FastForward size={24} />
                </button>
              </div>

              {/* Minimal ambient switcher in Zen Mode */}
              <div className="zen-ambient-bar glass-panel">
                <Headphones size={16} />
                <div className="zen-ambient-options">
                  {AMBIENT_OPTIONS.map(opt => (
                    <button 
                      key={opt.id}
                      className={`zen-ambient-chip ${ambientSound === opt.id ? 'active' : ''}`}
                      onClick={() => handleAmbientSoundChange(opt.id)}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content glass-panel modern-modal settings-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
              <div className="modal-header-custom">
                <h2>Impostazioni Pomodoro</h2>
                <button className="icon-btn" onClick={() => setIsSettingsOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSettings}>
                <div className="settings-section">
                  <h3>⏱️ Durata Fasi (Minuti)</h3>
                  <div className="settings-inputs-grid">
                    <div className="form-group">
                      <label>Focus (Lavoro)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="120" 
                        value={tempSettings.workTime} 
                        onChange={e => setTempSettings({ ...tempSettings, workTime: Number(e.target.value) })} 
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Pausa Corta</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="60" 
                        value={tempSettings.shortBreakTime} 
                        onChange={e => setTempSettings({ ...tempSettings, shortBreakTime: Number(e.target.value) })} 
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Pausa Lunga</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="90" 
                        value={tempSettings.longBreakTime} 
                        onChange={e => setTempSettings({ ...tempSettings, longBreakTime: Number(e.target.value) })} 
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Pausa lunga ogni</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        value={tempSettings.longBreakInterval} 
                        onChange={e => setTempSettings({ ...tempSettings, longBreakInterval: Number(e.target.value) })} 
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>🔔 Suoni e Notifiche</h3>
                  <div className="form-group">
                    <label>Suono di Fine Timer</label>
                    <div className="sound-preview-row">
                      <select 
                        value={tempSettings.alarmSound}
                        onChange={e => setTempSettings({ ...tempSettings, alarmSound: e.target.value })}
                        className="minimal-select"
                      >
                        {ALARM_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="ghost-btn preview-btn"
                        onClick={() => playAlarmSound(tempSettings.alarmSound, tempSettings.alarmVolume)}
                      >
                        <Volume2 size={16} /> Prova
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Volume Avviso: {Math.round(tempSettings.alarmVolume * 100)}%</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={tempSettings.alarmVolume}
                      onChange={e => setTempSettings({ ...tempSettings, alarmVolume: parseFloat(e.target.value) })}
                      className="modern-range"
                    />
                  </div>

                  <label className="checkbox-row">
                    <input 
                      type="checkbox" 
                      checked={tempSettings.desktopNotifications} 
                      onChange={e => setTempSettings({ ...tempSettings, desktopNotifications: e.target.checked })}
                    />
                    <span>Notifiche desktop quando il timer finisce</span>
                  </label>
                </div>

                <div className="settings-section">
                  <h3>⚡ Automazioni</h3>
                  <label className="checkbox-row">
                    <input 
                      type="checkbox" 
                      checked={tempSettings.autoStartBreaks} 
                      onChange={e => setTempSettings({ ...tempSettings, autoStartBreaks: e.target.checked })}
                    />
                    <span>Avvia automaticamente le pause</span>
                  </label>
                  <label className="checkbox-row">
                    <input 
                      type="checkbox" 
                      checked={tempSettings.autoStartPomodoros} 
                      onChange={e => setTempSettings({ ...tempSettings, autoStartPomodoros: e.target.checked })}
                    />
                    <span>Avvia automaticamente il focus dopo una pausa</span>
                  </label>
                </div>

                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={() => setIsSettingsOpen(false)}>
                    Annulla
                  </button>
                  <button type="submit" className="primary-btn">
                    Salva Impostazioni
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

export default Pomodoro;
