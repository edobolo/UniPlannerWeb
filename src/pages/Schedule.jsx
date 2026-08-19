import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { sanitizeText, safeJsonParse } from '../utils/security';
import { parseScheduleExcel, parseScheduleICS, exportScheduleToICS, calculateWeekOffset } from '../utils/scheduleImport';
import { useAuth } from '../context/AuthContext';
import { publishUserProfile } from '../utils/cloudSync';
import './Schedule.css';

const STORAGE_SCHEDULE_KEY = 'uniplanner_schedule_v1';

const START_HOUR = 7; // 07:00
const END_HOUR = 22;  // 22:00
const HOUR_HEIGHT = 64; // px per hour

const PRESET_COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#60a5fa'
];

const Schedule = () => {
  const { currentUser } = useAuth();
  const [lessons, setLessons] = useState(() => {
    const saved = safeJsonParse(localStorage.getItem(STORAGE_SCHEDULE_KEY), []);
    if (!saved || saved.length === 0) return [];
    // Map legacy string days to dayIndex if needed
    return saved.map(l => {
      if (typeof l.dayIndex !== 'number') {
        const map = { lun: 0, mar: 1, mer: 2, gio: 3, ven: 4, sab: 5, dom: 6 };
        return { ...l, dayIndex: map[l.day] !== undefined ? map[l.day] : 0 };
      }
      return l;
    });
  });

  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = this week, +1 next, -1 prev
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);

  // Mobile View Mode ('week' | 'day')
  const [mobileViewMode, setMobileViewMode] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 768 ? 'day' : 'week';
  });
  const [selectedMobileDay, setSelectedMobileDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // 0 = Lun, 6 = Dom
  });

  // Import Modal & Preview State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    subject: '',
    professor: '',
    room: '',
    dayIndex: 0,
    isSpecificDate: false,
    date: '',
    startTime: '09:00',
    endTime: '11:00',
    color: '#38bdf8'
  });

  const gridScrollRef = useRef(null);

  // Update current live time every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_SCHEDULE_KEY, JSON.stringify(lessons));
  }, [lessons]);

  // Auto scroll to daytime or start of morning on mount
  useEffect(() => {
    if (gridScrollRef.current) {
      const now = new Date();
      const currentH = now.getHours();
      let scrollPos = 0;
      if (currentH >= 9 && currentH <= 19) {
        scrollPos = Math.max(0, (currentH - START_HOUR - 1) * HOUR_HEIGHT);
      }
      gridScrollRef.current.scrollTop = scrollPos;
    }
  }, []);

  // Calculate dates of the selected week (Mon - Sun)
  const getWeekDates = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff + (currentWeekOffset * 7));
    monday.setHours(0, 0, 0, 0);

    const weekDays = [];
    const dayNames = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === now.toDateString();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayNum}`;

      weekDays.push({
        date: d,
        dateStr,
        dayNumber: d.getDate(),
        dayName: dayNames[i],
        dayIndex: i,
        isToday
      });
    }
    return weekDays;
  };

  const weekDates = getWeekDates();

  // Format month and year title for header
  const getHeaderMonthYear = () => {
    const firstDay = weekDates[0].date;
    const lastDay = weekDates[6].date;
    const monthNames = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return `${monthNames[firstDay.getMonth()]} ${firstDay.getFullYear()}`;
    }
    return `${monthNames[firstDay.getMonth()]} - ${monthNames[lastDay.getMonth()]} ${lastDay.getFullYear()}`;
  };

  // Convert time "HH:MM" to pixels from top
  const timeToTop = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = (h * 60 + m) - (START_HOUR * 60);
    return Math.max(0, (totalMinutes / 60) * HOUR_HEIGHT);
  };

  // Convert duration to height in pixels
  const timeToHeight = (startTime, endTime) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return Math.max(26, (durationMinutes / 60) * HOUR_HEIGHT);
  };

  // Current Time indicator position (red line)
  const getCurrentTimeIndicatorPosition = () => {
    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    if (h < START_HOUR || h > END_HOUR) return null;
    const minutesFromStart = (h * 60 + m) - (START_HOUR * 60);
    return (minutesFromStart / 60) * HOUR_HEIGHT;
  };

  const currentLineTop = getCurrentTimeIndicatorPosition();

  // Index of today (0 = Mon, ..., 6 = Sun)
  const todayDayIndex = (() => {
    const d = currentTime.getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const isCurrentWeek = currentWeekOffset === 0;

  // Open modal for creating or editing
  const openAddModal = (defaultDayIndex = 0, defaultHour = 9, defaultDateStr = '') => {
    setEditingLesson(null);
    const startStr = `${String(defaultHour).padStart(2, '0')}:00`;
    const endStr = `${String(Math.min(defaultHour + 2, 21)).padStart(2, '0')}:00`;
    setFormData({
      subject: '',
      professor: '',
      room: '',
      dayIndex: defaultDayIndex,
      isSpecificDate: Boolean(defaultDateStr),
      date: defaultDateStr || '',
      startTime: startStr,
      endTime: endStr,
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    });
    setIsModalOpen(true);
  };

  const openEditModal = (lesson, e) => {
    e.stopPropagation();
    setEditingLesson(lesson);
    setFormData({
      subject: lesson.subject,
      professor: lesson.professor || '',
      room: lesson.room || '',
      dayIndex: lesson.dayIndex,
      isSpecificDate: Boolean(lesson.date),
      date: lesson.date || '',
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      color: lesson.color || '#38bdf8'
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const cleanSubject = sanitizeText(formData.subject, 60);
    const cleanProf = sanitizeText(formData.professor, 50);
    const cleanRoom = sanitizeText(formData.room, 30);

    if (!cleanSubject) return;

    const lessonDate = formData.isSpecificDate && formData.date ? formData.date : null;

    if (editingLesson) {
      setLessons(prev => prev.map(l => l.id === editingLesson.id ? {
        ...l,
        subject: cleanSubject,
        professor: cleanProf,
        room: cleanRoom,
        dayIndex: Number(formData.dayIndex),
        date: lessonDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        color: formData.color
      } : l));
    } else {
      const newLesson = {
        id: `les_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        subject: cleanSubject,
        professor: cleanProf,
        room: cleanRoom,
        dayIndex: Number(formData.dayIndex),
        date: lessonDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        color: formData.color
      };
      setLessons(prev => [...prev, newLesson]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteLesson = (id) => {
    if (confirm('Eliminare questa lezione dall\'orario?')) {
      setLessons(prev => prev.filter(l => l.id !== id));
      if (isModalOpen) setIsModalOpen(false);
    }
  };

  // --- Import Handlers ---
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setIsParsing(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsed = null;

      if (ext === 'ics') {
        parsed = await parseScheduleICS(file);
      } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
        parsed = await parseScheduleExcel(file);
      } else {
        throw new Error('Formato file non supportato. Usa un file Excel (.xls, .xlsx, .csv) o iCalendar (.ics).');
      }

      setImportPreview({
        fileName: file.name,
        lessons: parsed.lessons,
        firstDate: parsed.firstDate,
        lastDate: parsed.lastDate,
        totalCount: parsed.totalCount,
        uniqueSubjects: parsed.uniqueSubjects
      });
    } catch (err) {
      setImportError(err.message || 'Errore durante l\'elaborazione del file.');
      setImportPreview(null);
    } finally {
      setIsParsing(false);
    }
  };

  const confirmImport = (replaceExisting = false) => {
    if (!importPreview || !importPreview.lessons) return;

    if (replaceExisting) {
      setLessons(importPreview.lessons);
    } else {
      // Merge unique
      setLessons(prev => {
        const existingKeys = new Set(prev.map(l => `${l.date || l.dayIndex}_${l.startTime}_${l.endTime}_${l.subject.toLowerCase()}`));
        const newToAdd = importPreview.lessons.filter(l => !existingKeys.has(`${l.date || l.dayIndex}_${l.startTime}_${l.endTime}_${l.subject.toLowerCase()}`));
        return [...prev, ...newToAdd];
      });
    }

    // Automatically navigate to the start of the semester!
    if (importPreview.firstDate) {
      const startWeekOffset = calculateWeekOffset(importPreview.firstDate);
      setCurrentWeekOffset(startWeekOffset);
    }

    setIsImportModalOpen(false);
    setImportPreview(null);
  };

  // Hours array for rows
  const hours = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hours.push(h);
  }

  const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  // Format date helper for preview
  const formatDateDisplay = (dateStr, fallbackDayIdx) => {
    if (dateStr) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return DAY_NAMES[fallbackDayIdx];
  };

  return (
    <div className="gcal-schedule-container glass-panel">
      {/* Top Google Calendar Header */}
      <div className="gcal-header">
        <div className="gcal-header-left">
          <button 
            className={`gcal-today-btn ${isCurrentWeek ? 'active' : ''}`}
            onClick={() => setCurrentWeekOffset(0)}
          >
            Oggi
          </button>
          
          <div className="gcal-nav-arrows">
            <button 
              className="icon-btn gcal-nav-btn" 
              onClick={() => setCurrentWeekOffset(prev => prev - 1)}
              title="Settimana precedente"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              className="icon-btn gcal-nav-btn" 
              onClick={() => setCurrentWeekOffset(prev => prev + 1)}
              title="Settimana successiva"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <h2 className="gcal-month-title">{getHeaderMonthYear()}</h2>
        </div>

        <div className="gcal-header-right">
          {/* Export to ICS */}
          <button 
            className="gcal-action-btn" 
            onClick={() => exportScheduleToICS(lessons)}
            title="Esporta orario in formato standard .ics per calendari e app esterne"
          >
            <Download size={15} />
            <span>Esporta .ics</span>
          </button>

          {/* Import from Excel / ICS */}
          <button 
            className="gcal-action-btn import-btn"
            onClick={() => {
              setImportError('');
              setImportPreview(null);
              setIsImportModalOpen(true);
            }}
            title="Importa orario da file Excel (.xls, .xlsx, .csv) o .ics scaricato dal portale universitario"
          >
            <Upload size={15} />
            <span>Importa Orario</span>
          </button>

          <button 
            className="primary-btn gcal-create-btn" 
            onClick={() => openAddModal(todayDayIndex, 10, weekDates[todayDayIndex]?.dateStr)}
          >
            <Plus size={18} />
            <span>Aggiungi Lezione</span>
          </button>
        </div>
      </div>

      {/* Main Calendar Viewport */}
      <div className="gcal-viewport">
        {/* Mobile View Switcher (Settimana vs Giorno) */}
        <div className="gcal-mobile-view-switcher">
          <button 
            className={`gcal-view-tab ${mobileViewMode === 'day' ? 'active' : ''}`}
            onClick={() => setMobileViewMode('day')}
          >
            <Clock size={15} />
            <span>Vista Giorno per Giorno</span>
          </button>
          <button 
            className={`gcal-view-tab ${mobileViewMode === 'week' ? 'active' : ''}`}
            onClick={() => setMobileViewMode('week')}
          >
            <CalendarDays size={15} />
            <span>Griglia Settimanale</span>
          </button>
        </div>

        {/* Mobile Single Day View */}
        {mobileViewMode === 'day' ? (
          <div className="gcal-mobile-day-container">
            {/* Horizontal Day Selector Pills */}
            <div className="gcal-mobile-days-strip">
              {weekDates.map((day) => {
                const dayLessonsCount = lessons.filter(l => l.date ? l.date === day.dateStr : l.dayIndex === day.dayIndex).length;
                const isSelected = selectedMobileDay === day.dayIndex;
                return (
                  <button 
                    key={day.dayIndex}
                    className={`mobile-day-pill ${isSelected ? 'selected' : ''} ${day.isToday ? 'is-today' : ''}`}
                    onClick={() => setSelectedMobileDay(day.dayIndex)}
                  >
                    <span className="mob-day-name">{day.dayName}</span>
                    <span className="mob-day-num">{day.dayNumber}</span>
                    {dayLessonsCount > 0 && <span className="mob-lesson-badge">{dayLessonsCount}</span>}
                  </button>
                );
              })}
            </div>

            {/* Selected Day Header & Add Button */}
            <div className="mobile-day-content-header">
              <div>
                <h3>{weekDates[selectedMobileDay]?.dayNameFull || 'Giorno'} {weekDates[selectedMobileDay]?.dayNumber} {getHeaderMonthYear()}</h3>
                <span className="mobile-day-sub">
                  {lessons.filter(l => l.date ? l.date === weekDates[selectedMobileDay]?.dateStr : l.dayIndex === selectedMobileDay).length} lezioni in programma
                </span>
              </div>
              <button 
                className="primary-btn sm-btn"
                onClick={() => openAddModal(selectedMobileDay, 9, weekDates[selectedMobileDay]?.dateStr)}
              >
                <Plus size={16} />
                <span>Aggiungi</span>
              </button>
            </div>

            {/* Lessons List for Selected Day */}
            <div className="mobile-day-lessons-list">
              {(() => {
                const dayObj = weekDates[selectedMobileDay];
                const dayLessons = lessons
                  .filter(l => l.date ? l.date === dayObj?.dateStr : l.dayIndex === selectedMobileDay)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                if (dayLessons.length === 0) {
                  return (
                    <div className="mobile-empty-day">
                      <Clock size={36} className="empty-day-icon" />
                      <h4>Nessuna lezione programmata</h4>
                      <p>Non ci sono lezioni per {dayObj?.dayNameFull}. Tocca "Aggiungi" per inserire un corso.</p>
                      <button 
                        className="secondary-btn"
                        onClick={() => openAddModal(selectedMobileDay, 9, dayObj?.dateStr)}
                      >
                        <Plus size={15} />
                        <span>Aggiungi lezione a {dayObj?.dayName}</span>
                      </button>
                    </div>
                  );
                }

                return dayLessons.map(lesson => (
                  <motion.div 
                    key={lesson.id} 
                    className="mobile-lesson-card"
                    style={{ borderLeftColor: lesson.color || '#38bdf8' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="mob-lesson-time-row">
                      <span className="mob-time-tag" style={{ background: `${lesson.color || '#38bdf8'}22`, color: lesson.color || '#38bdf8' }}>
                        <Clock size={13} /> {lesson.startTime} - {lesson.endTime}
                      </span>
                      <div className="mob-lesson-actions">
                        <button className="icon-btn" onClick={(e) => openEditModal(lesson, e)} title="Modifica">
                          <Edit3 size={15} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDeleteLesson(lesson.id)} title="Elimina">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="mob-lesson-title">{lesson.subject}</h4>
                    
                    <div className="mob-lesson-meta">
                      {lesson.room && (
                        <span className="mob-meta-item">
                          <MapPin size={14} /> Aula: <strong>{lesson.room}</strong>
                        </span>
                      )}
                      {lesson.professor && (
                        <span className="mob-meta-item">
                          <User size={14} /> Prof: <strong>{lesson.professor}</strong>
                        </span>
                      )}
                    </div>
                  </motion.div>
                ));
              })()}
            </div>
          </div>
        ) : (
          /* Full Grid View with Synced Header and Touch Scroll Track */
          <div className="gcal-horizontal-scroll-track">
            <div className="gcal-track-inner">
              {/* Days of Week Header Bar */}
              <div className="gcal-days-header-row">
                <div className="gcal-time-gutter-header" />
                
                <div className="gcal-days-grid-header">
                  {weekDates.map((day) => (
                    <div 
                      key={day.dayIndex} 
                      className={`gcal-day-col-header ${day.isToday ? 'is-today' : ''}`}
                      onClick={() => openAddModal(day.dayIndex, 9, day.dateStr)}
                    >
                      <span className="gcal-day-name">{day.dayName}</span>
                      <div className={`gcal-day-number-bubble ${day.isToday ? 'active-today' : ''}`}>
                        {day.dayNumber}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scrollable Time Grid */}
              <div className="gcal-grid-scroll-area" ref={gridScrollRef}>
                <div className="gcal-grid-inner" style={{ height: hours.length * HOUR_HEIGHT }}>
                  
                  {/* Left Time Column Gutter */}
                  <div className="gcal-time-gutter">
                    {hours.map((h) => (
                      <div key={h} className="gcal-time-cell" style={{ height: HOUR_HEIGHT }}>
                        <span className="gcal-time-label">{String(h).padStart(2, '0')}:00</span>
                      </div>
                    ))}
                  </div>

                  {/* Week Columns Grid */}
                  <div className="gcal-columns-container">
                    {/* Horizontal Background Hour Lines */}
                    <div className="gcal-horizontal-lines">
                      {hours.map((h, i) => (
                        <div 
                          key={h} 
                          className="gcal-hour-line" 
                          style={{ top: i * HOUR_HEIGHT }}
                        />
                      ))}
                    </div>

                    {/* 7 Days Vertical Columns */}
                    {weekDates.map((day) => {
                      // Filter lessons for this exact calendar date or repeating weekday
                      const dayLessons = lessons.filter(l => {
                        if (l.date) {
                          return l.date === day.dateStr;
                        }
                        return l.dayIndex === day.dayIndex;
                      });

                      const isTodayCol = day.isToday && isCurrentWeek;

                      return (
                        <div 
                          key={day.dayIndex} 
                          className={`gcal-day-column ${isTodayCol ? 'is-today-col' : ''}`}
                          onClick={(e) => {
                            // Calculate clicked hour
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickY = e.clientY - rect.top;
                            const clickedHour = Math.floor(clickY / HOUR_HEIGHT) + START_HOUR;
                            openAddModal(day.dayIndex, Math.min(Math.max(clickedHour, START_HOUR), END_HOUR - 1), day.dateStr);
                          }}
                        >
                          {/* Live Current Time Red Line */}
                          {isTodayCol && currentLineTop !== null && (
                            <div 
                              className="gcal-current-time-line" 
                              style={{ top: currentLineTop }}
                            >
                              <div className="gcal-current-time-dot" />
                            </div>
                          )}

                          {/* Render Lesson Event Cards */}
                          {dayLessons.map((lesson) => {
                            const top = timeToTop(lesson.startTime);
                            const height = timeToHeight(lesson.startTime, lesson.endTime);

                            return (
                              <div
                                key={lesson.id}
                                className="gcal-event-card"
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  background: lesson.color || '#38bdf8',
                                  borderColor: lesson.color || '#38bdf8'
                                }}
                                onClick={(e) => openEditModal(lesson, e)}
                                title={`${lesson.subject} (${lesson.startTime} - ${lesson.endTime})`}
                              >
                                <div className="gcal-event-time">
                                  {lesson.startTime} - {lesson.endTime}
                                </div>
                                <div className="gcal-event-title">{lesson.subject}</div>
                                {height > 44 && lesson.room && (
                                  <div className="gcal-event-location">
                                    <MapPin size={11} /> {lesson.room}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Lesson Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content glass-panel lesson-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="modal-header">
                <h2>{editingLesson ? 'Modifica Lezione' : 'Aggiungi Nuova Lezione'}</h2>
                <button className="icon-btn" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="lesson-form">
                <div className="form-group">
                  <label>Materia / Corso *</label>
                  <input 
                    type="text" 
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Es. Algoritmi e Strutture Dati, Basi di Dati..."
                    maxLength={60}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Docente</label>
                    <input 
                      type="text" 
                      value={formData.professor}
                      onChange={(e) => setFormData({ ...formData, professor: e.target.value })}
                      placeholder="Es. Prof. Rossi"
                      maxLength={50}
                    />
                  </div>
                  <div className="form-group">
                    <label>Aula / Edificio</label>
                    <input 
                      type="text" 
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      placeholder="Es. Aula Magna, Delta 3"
                      maxLength={30}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Giorno della Settimana</label>
                    <select 
                      value={formData.dayIndex}
                      onChange={(e) => {
                        const newIdx = Number(e.target.value);
                        setFormData({ 
                          ...formData, 
                          dayIndex: newIdx,
                          date: formData.isSpecificDate ? (weekDates[newIdx]?.dateStr || formData.date) : ''
                        });
                      }}
                    >
                      {DAY_NAMES.map((name, idx) => (
                        <option key={idx} value={idx}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Data Specifica (Opzionale)</label>
                    <input 
                      type="date"
                      value={formData.date || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const [y, m, d] = val.split('-').map(Number);
                          const dateObj = new Date(y, m - 1, d);
                          const newDayIdx = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
                          setFormData({ ...formData, date: val, isSpecificDate: true, dayIndex: newDayIdx });
                        } else {
                          setFormData({ ...formData, date: '', isSpecificDate: false });
                        }
                      }}
                      placeholder="Lascia vuoto per ripetere ogni settimana"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Orario Inizio</label>
                    <input 
                      type="time" 
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Orario Fine</label>
                    <input 
                      type="time" 
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Colore Evento</label>
                  <div className="color-picker-row">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-choice ${formData.color === color ? 'selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>

                <div className="modal-actions-custom">
                  {editingLesson && (
                    <button 
                      type="button" 
                      className="ghost-btn delete-btn"
                      onClick={() => handleDeleteLesson(editingLesson.id)}
                    >
                      <Trash2 size={16} />
                      <span>Elimina</span>
                    </button>
                  )}
                  <div className="right-btns">
                    <button type="button" className="ghost-btn" onClick={() => setIsModalOpen(false)}>
                      Annulla
                    </button>
                    <button type="submit" className="primary-btn">
                      {editingLesson ? 'Salva Modifiche' : 'Aggiungi all\'Orario'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMPORT MODAL */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content glass-panel schedule-import-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="modal-header">
                <div className="import-title-wrap">
                  <div className="import-icon-badge">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h2>Importa Orario Universitario</h2>
                    <p className="import-sub">Supporta file Excel (.xls, .xlsx, .csv) e iCalendar (.ics)</p>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setIsImportModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="import-modal-body">
                {/* File Dropzone */}
                {!importPreview && (
                  <div 
                    className="import-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }}
                      accept=".xls,.xlsx,.csv,.ics"
                      onChange={handleFileSelect}
                    />
                    
                    <div className="dropzone-content">
                      <div className="upload-circle">
                        <Upload size={28} />
                      </div>
                      <h3>Trascina qui il file o fai clic per sfogliare</h3>
                      <p>File Excel (.xls, .xlsx) scaricato dal portale dell'università o file .ics</p>
                      
                      <div className="supported-formats-pills">
                        <span className="format-pill">
                          <FileSpreadsheet size={12} />
                          Excel (.xls / .xlsx)
                        </span>
                        <span className="format-pill">
                          <FileText size={12} />
                          iCalendar (.ics)
                        </span>
                        <span className="format-pill">CSV (.csv)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Parsing Loader */}
                {isParsing && (
                  <div className="import-loader">
                    <div className="spinner" />
                    <p>Analisi delle lezioni in corso...</p>
                  </div>
                )}

                {/* Error Banner */}
                {importError && (
                  <div className="import-error-banner">
                    <AlertCircle size={18} />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Preview Table */}
                {importPreview && (
                  <div className="import-preview-box">
                    <div className="preview-top-bar">
                      <div className="preview-file-info">
                        <FileSpreadsheet size={16} />
                        <strong>{importPreview.fileName}</strong>
                        <span className="preview-count-tag">
                          {importPreview.lessons.length} lezioni rilevate
                        </span>
                        {importPreview.firstDate && importPreview.lastDate && (
                          <span className="preview-range-tag">
                            📅 {formatDateDisplay(importPreview.firstDate)} → {formatDateDisplay(importPreview.lastDate)}
                          </span>
                        )}
                      </div>
                      <button 
                        className="change-file-btn" 
                        onClick={() => {
                          setImportPreview(null);
                          setImportError('');
                        }}
                      >
                        Cambia file
                      </button>
                    </div>

                    <div className="preview-lessons-table-wrap">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Data / Giorno</th>
                            <th>Orario</th>
                            <th>Insegnamento / Materia</th>
                            <th>Docente</th>
                            <th>Aula</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.lessons.map((les, idx) => (
                            <tr key={idx}>
                              <td>
                                <span className="preview-day-pill">
                                  {les.date ? `${formatDateDisplay(les.date)} (${DAY_NAMES[les.dayIndex].substring(0, 3)})` : DAY_NAMES[les.dayIndex]}
                                </span>
                              </td>
                              <td className="preview-time-cell">
                                {les.startTime} - {les.endTime}
                              </td>
                              <td className="preview-subject-cell">
                                <span className="subj-dot" style={{ background: les.color }} />
                                <strong>{les.subject}</strong>
                              </td>
                              <td>{les.professor || '-'}</td>
                              <td>{les.room || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="import-choice-actions">
                      <p className="choice-prompt">Come desideri importare le lezioni?</p>
                      
                      <div className="choice-buttons-row">
                        <button 
                          className="secondary-btn merge-btn"
                          onClick={() => confirmImport(false)}
                        >
                          <Plus size={16} />
                          <span>Aggiungi alle lezioni attuali</span>
                        </button>
                        
                        <button 
                          className="primary-btn replace-btn"
                          onClick={() => confirmImport(true)}
                        >
                          <Sparkles size={16} />
                          <span>Sostituisci tutto l'orario</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Schedule;



