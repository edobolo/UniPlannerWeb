import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CalendarClock, CheckCircle2, Clock, List, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { scheduleDeadlineAlerts } from '../utils/nativeNotificationService';
import { safeJsonParse } from '../utils/security';
import './Deadlines.css';

const Deadlines = () => {
  const [deadlines, setDeadlines] = useState(() => {
    const saved = localStorage.getItem('uniplanner_deadlines');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [newDeadline, setNewDeadline] = useState({ 
    title: '', 
    subject: '', 
    date: new Date().toISOString().split('T')[0],
    completed: false 
  });

  useEffect(() => {
    localStorage.setItem('uniplanner_deadlines', JSON.stringify(deadlines));
    const savedExams = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);
    scheduleDeadlineAlerts(deadlines, savedExams);
  }, [deadlines]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (newDeadline.title.trim() && newDeadline.date) {
      setDeadlines([...deadlines, { ...newDeadline, id: Date.now() }]);
      setIsModalOpen(false);
      setNewDeadline({ title: '', subject: '', date: new Date().toISOString().split('T')[0], completed: false });
    }
  };

  const handleDelete = (id) => {
    setDeadlines(deadlines.filter(d => d.id !== id));
  };

  const toggleComplete = (id) => {
    setDeadlines(deadlines.map(d => 
      d.id === id ? { ...d, completed: !d.completed } : d
    ));
  };

  const sortedDeadlines = [...deadlines].sort((a, b) => new Date(a.date) - new Date(b.date));
  const pendingCount = deadlines.filter(d => !d.completed).length;
  const completedCount = deadlines.filter(d => d.completed).length;

  const formatDateStr = (dateString) => {
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('it-IT', options);
  };

  // Calendar Helpers
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        
        // Find deadlines for this day
        const dayDeadlines = deadlines.filter(d => isSameDay(parseISO(d.date), cloneDay));

        days.push(
          <div 
            className={`calendar-cell ${!isSameMonth(day, monthStart) ? 'disabled' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
            key={day}
          >
            <span className="calendar-day-number">{formattedDate}</span>
            <div className="calendar-day-events">
              {dayDeadlines.map(d => (
                <div key={d.id} className={`calendar-event ${d.completed ? 'completed' : ''}`} title={d.title}>
                  {d.title}
                </div>
              ))}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="calendar-row" key={day}>
          {days}
        </div>
      );
      days = [];
    }
    return rows;
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="deadlines-container">
      <header className="deadlines-header">
        <div>
          <h1 className="page-title">Scadenze & Task</h1>
          <p className="page-subtitle">Pianifica consegne, progetti ed appelli d'esame</p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              type="button" 
              className={viewMode === 'list' ? 'active' : ''} 
              onClick={() => setViewMode('list')}
              title="Vista Elenco"
            >
              <List size={17} />
            </button>
            <button 
              type="button" 
              className={viewMode === 'calendar' ? 'active' : ''} 
              onClick={() => setViewMode('calendar')}
              title="Vista Calendario Mensile"
            >
              <CalendarIcon size={17} />
            </button>
          </div>
          <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>Nuova Scadenza</span>
          </button>
        </div>
      </header>

      {viewMode === 'list' && (
        <div className="deadlines-stats-grid">
          <div className="stat-card-deadline">
            <div className="stat-icon-deadline" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <CalendarClock size={22} />
            </div>
            <div className="stat-info-deadline">
              <h3>Da Completare</h3>
              <div className="stat-value-deadline">{pendingCount}</div>
            </div>
          </div>
          <div className="stat-card-deadline">
            <div className="stat-icon-deadline" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
              <CheckCircle2 size={22} />
            </div>
            <div className="stat-info-deadline">
              <h3>Completati</h3>
              <div className="stat-value-deadline">{completedCount}</div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="deadlines-list">
          <AnimatePresence mode="popLayout">
            {sortedDeadlines.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="empty-state-deadline"
              >
                <Sparkles size={32} style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
                <span>Nessuna scadenza in programma. Ottimo lavoro! 🎉</span>
              </motion.div>
            ) : (
              sortedDeadlines.map((item) => {
                const isPast = new Date(item.date) < new Date(new Date().setHours(0,0,0,0)) && !item.completed;
                return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                    className={`deadline-card ${item.completed ? 'completed' : ''} ${isPast ? 'overdue' : ''}`}
                  >
                    <div className="deadline-left-group">
                      <button 
                        type="button"
                        className={`checkbox-btn ${item.completed ? 'checked' : ''}`}
                        onClick={() => toggleComplete(item.id)}
                        title={item.completed ? 'Segna come non completato' : 'Segna come completato'}
                      >
                        <CheckCircle2 size={22} />
                      </button>
                      
                      <div className="deadline-content">
                        <h3 className="deadline-title">{item.title}</h3>
                        <div className="deadline-meta">
                          {item.subject && <span className="meta-subject">{item.subject}</span>}
                          <span className="meta-date">
                            <Clock size={13} />
                            {formatDateStr(item.date)}
                          </span>
                          {isPast && <span className="meta-overdue">Scaduto!</span>}
                        </div>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      className="delete-btn" 
                      onClick={() => handleDelete(item.id)}
                      title="Elimina scadenza"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div 
          className="calendar-container"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="calendar-header-nav">
            <button type="button" className="ghost-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <h2>{format(currentMonth, 'MMMM yyyy', { locale: it }).replace(/^\w/, c => c.toUpperCase())}</h2>
            <button type="button" className="ghost-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>
          <div className="calendar-days-header">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {renderCalendar()}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="modal-content"
              onClick={e => e.stopPropagation()}
            >
              <h2>Nuova Scadenza</h2>
              <form onSubmit={handleAdd}>
                <div className="form-group">
                  <label>Titolo Scadenza / Esame</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="es. Consegna Progetto Web, Appello Orale..."
                    value={newDeadline.title} 
                    onChange={e => setNewDeadline({...newDeadline, title: e.target.value})} 
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Materia o Corso (Opzionale)</label>
                  <input 
                    type="text" 
                    placeholder="es. Ingegneria del Software"
                    value={newDeadline.subject} 
                    onChange={e => setNewDeadline({...newDeadline, subject: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>Data di Scadenza</label>
                  <input 
                    type="date" 
                    required 
                    value={newDeadline.date} 
                    onChange={e => setNewDeadline({...newDeadline, date: e.target.value})} 
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={() => setIsModalOpen(false)}>Annulla</button>
                  <button type="submit" className="primary-btn">Aggiungi</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Deadlines;
