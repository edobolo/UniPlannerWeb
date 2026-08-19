import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Clock, ChevronDown, CheckCircle2, GraduationCap, LayoutGrid, List, GripHorizontal } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../context/AuthContext';
import { publishUserProfile } from '../utils/cloudSync';
import { safeJsonParse } from '../utils/security';
import './Exams.css';

const YEAR_OPTIONS = ["1° Anno", "2° Anno", "3° Anno", "4° Anno", "5° Anno", "Opzionale", "N/D"];
const SORT_OPTIONS = [
  { id: 'MANUAL', label: 'Personalizzato' },
  { id: 'YEAR_ASC', label: 'Per Anno (Standard)' },
  { id: 'RECENT', label: 'Aggiunti di recente' },
  { id: 'NAME', label: 'Alfabetico (A-Z)' },
  { id: 'GRADE_DESC', label: 'Voto (Migliori)' }
];

const formatTime = (mins) => {
  if (!mins) return "0h 0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 0 ? h + 'h ' : ''}${m}m`;
};

const getYearColor = (year) => {
  if (year.startsWith('1')) return '#10b981';
  if (year.startsWith('2')) return '#f59e0b';
  if (year.startsWith('3')) return '#f43f5e';
  if (year.startsWith('4')) return '#8b5cf6';
  if (year.startsWith('5')) return '#ec4899';
  return '#64748b';
};

const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
  duration: 280,
  easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Spring snap bounce
};

// Exam Card Content Presentation
const ExamCardContent = ({ exam, handleDelete, setRecordGrade, setRecordCredits, setRecordingId, setTimeRecordingId, isOverlay = false }) => {
  const isDone = exam.grade !== null;
  const yearColor = getYearColor(exam.year);

  return (
    <div 
      className={`modern-exam-card glass-panel ${isDone ? 'is-completed' : ''} ${isOverlay ? 'is-floating-overlay' : ''}`}
      style={{ '--theme-color': yearColor }}
    >
      <div className="card-top-accent"></div>
      
      <div className="card-header">
        <div className="header-left">
          <div className="drag-handle" title="Trascina per riordinare">
            <GripHorizontal size={18} />
          </div>
          <span className="modern-badge">{exam.year}</span>
        </div>
        {!isOverlay && (
          <button className="delete-icon" onClick={(e) => { e.stopPropagation(); handleDelete(exam.id); }}>
            <Trash2 size={16}/>
          </button>
        )}
      </div>

      <div className="card-body">
        <h3 className="exam-name">{exam.name}</h3>
        {exam.isIdoneita && <span className="idoneita-tag">Idoneità</span>}
      </div>

      <div className="card-footer">
        {isDone ? (
          <div className="completed-area">
            <div className="grade-pill" onClick={() => {
              if (isOverlay) return;
              setRecordGrade(exam.grade === 'IDONEO' ? '' : exam.grade);
              setRecordCredits(exam.credits.toString());
              setRecordingId(exam.id);
            }}>
              <CheckCircle2 size={16} />
              <span>{exam.grade}</span>
              <span className="cfu-muted">({exam.credits} CFU)</span>
            </div>
            <button className="time-pill" onClick={() => !isOverlay && setTimeRecordingId(exam.id)}>
              <Clock size={14} /> {formatTime(exam.studyTimeMin)}
            </button>
          </div>
        ) : (
          <div className="pending-area">
            <button className="primary-btn sm-btn" onClick={() => {
              if (isOverlay) return;
              setRecordGrade('18');
              setRecordCredits('6');
              setRecordingId(exam.id);
            }}>
              Registra Voto
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SortableExamCard = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.exam.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 260ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease',
    opacity: isDragging ? 0.25 : 1,
    transformOrigin: '50% 50%',
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`sortable-card-wrapper ${isDragging ? 'placeholder-active' : ''}`}
      {...attributes}
      {...listeners}
    >
      <ExamCardContent {...props} />
    </div>
  );
};

const Exams = () => {
  const [exams, setExams] = useState(() => {
    const saved = localStorage.getItem('uniplanner_exams');
    return saved ? JSON.parse(saved) : [];
  });

  const [newName, setNewName] = useState('');
  const [newYear, setNewYear] = useState('1° Anno');
  const [newIsIdoneita, setNewIsIdoneita] = useState(false);
  
  const [sortMethod, setSortMethod] = useState('YEAR_ASC');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [activeId, setActiveId] = useState(null);

  const [recordingId, setRecordingId] = useState(null);
  const [recordGrade, setRecordGrade] = useState('18');
  const [recordCredits, setRecordCredits] = useState('6');

  const [timeRecordingId, setTimeRecordingId] = useState(null);
  const [studyTimeInput, setStudyTimeInput] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // Instant responsive drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { currentUser } = useAuth();

  // Reset or load exams on user change / logout
  useEffect(() => {
    if (!currentUser) {
      setExams([]);
    } else {
      const saved = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);
      setExams(saved);
    }
  }, [currentUser?.friendCode]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('uniplanner_exams', JSON.stringify(exams));
      if (currentUser.friendCode) {
        const savedSchedule = safeJsonParse(localStorage.getItem('uniplanner_schedule_v1'), []);
        const savedDeadlines = safeJsonParse(localStorage.getItem('uniplanner_deadlines'), []);
        publishUserProfile(currentUser, exams, savedSchedule, savedDeadlines);
      }
    }
  }, [exams, currentUser]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (newName.trim()) {
      const newExam = {
        id: Date.now(),
        name: newName.trim(),
        year: newYear,
        isIdoneita: newIsIdoneita,
        grade: null,
        credits: null,
        studyTimeMin: 0
      };
      setExams([newExam, ...exams]);
      setNewName('');
      setNewIsIdoneita(false);
    }
  };

  const handleDelete = (id) => {
    setExams(exams.filter(e => e.id !== id));
  };

  const handleRecordGradeSubmit = (e) => {
    e.preventDefault();
    setExams(exams.map(ex => {
      if (ex.id === recordingId) {
        if (ex.isIdoneita) {
          return { ...ex, grade: 'IDONEO', credits: Number(recordCredits) };
        } else {
          return { ...ex, grade: recordGrade.toUpperCase(), credits: Number(recordCredits) };
        }
      }
      return ex;
    }));
    setRecordingId(null);
  };

  const handleRecordTimeSubmit = (e) => {
    e.preventDefault();
    let mins = 0;
    if (studyTimeInput.includes(':')) {
      const [h, m] = studyTimeInput.split(':');
      mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    } else {
      mins = Number(studyTimeInput) || 0;
    }
    setExams(exams.map(ex => ex.id === timeRecordingId ? { ...ex, studyTimeMin: (ex.studyTimeMin || 0) + mins } : ex));
    setTimeRecordingId(null);
    setStudyTimeInput('');
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      if (sortMethod !== 'MANUAL') {
        setSortMethod('MANUAL');
      }
      
      setExams((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const sortedExams = [...exams].sort((a, b) => {
    if (sortMethod === 'MANUAL') return 0;
    if (sortMethod === 'NAME') return a.name.localeCompare(b.name);
    if (sortMethod === 'YEAR_ASC') {
      if (a.year === 'N/D') return 1;
      if (b.year === 'N/D') return -1;
      return a.year.localeCompare(b.year);
    }
    const getGradeVal = (grade) => {
      if (grade === null) return -1;
      if (grade === 'IDONEO') return 0;
      if (grade === '30L') return 31;
      return Number(grade);
    };
    if (sortMethod === 'GRADE_DESC') return getGradeVal(b.grade) - getGradeVal(a.grade);
    return 0;
  });

  const activeExam = activeId ? exams.find(e => e.id === activeId) : null;

  return (
    <div className="exams-modern-container">
      <header className="exams-modern-header">
        <div className="header-title-area">
          <div className="title-icon"><GraduationCap size={28} /></div>
          <div>
            <h1 className="page-title">Piano di Studi</h1>
            <p className="page-subtitle">Organizza e riordina liberamente i tuoi esami</p>
          </div>
        </div>
      </header>

      {/* Modern Add Bar */}
      <motion.form 
        className="modern-add-bar glass-panel"
        onSubmit={handleAdd}
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="input-wrapper">
          <input 
            type="text" 
            placeholder="Aggiungi un nuovo esame..." 
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
            className="borderless-input"
          />
        </div>
        <div className="add-controls">
          <select value={newYear} onChange={e => setNewYear(e.target.value)} className="minimal-select">
            {YEAR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label className="modern-checkbox">
            <input type="checkbox" checked={newIsIdoneita} onChange={e => setNewIsIdoneita(e.target.checked)} />
            <span className="checkmark"></span>
            Idoneità
          </label>
          <button type="submit" className="action-fab" title="Aggiungi esame">
            <Plus size={20} />
          </button>
        </div>
      </motion.form>

      {/* Toolbar */}
      <div className="exams-toolbar">
        <div className="sort-dropdown-container">
          <button className="ghost-btn sort-trigger" onClick={() => setIsSortOpen(!isSortOpen)}>
            Ordina: {SORT_OPTIONS.find(s => s.id === sortMethod)?.label} <ChevronDown size={16}/>
          </button>
          <AnimatePresence>
            {isSortOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="sort-menu glass-panel"
              >
                {SORT_OPTIONS.map(opt => (
                  <button 
                    key={opt.id} 
                    className={`sort-item ${sortMethod === opt.id ? 'active' : ''}`}
                    onClick={() => { setSortMethod(opt.id); setIsSortOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="view-toggles">
          <button 
            className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`} 
            onClick={() => setViewMode('grid')}
            title="Vista a griglia"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`} 
            onClick={() => setViewMode('list')}
            title="Vista ad elenco"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Main Content with DndContext & DragOverlay */}
      <div className="exams-content-scroll">
        {sortedExams.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="empty-state-modern"
          >
            <div className="empty-icon-blob"><GraduationCap size={48} /></div>
            <h3>Nessun Esame Programmato</h3>
            <p>Inizia ad aggiungere gli esami del tuo corso di laurea usando la barra qui sopra.</p>
          </motion.div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext 
              items={sortedExams.map(e => e.id)}
              strategy={rectSortingStrategy}
            >
              <div className={`exams-layout ${viewMode === 'grid' ? 'layout-grid' : 'layout-list'}`}>
                {sortedExams.map(exam => (
                  <SortableExamCard 
                    key={exam.id}
                    exam={exam}
                    handleDelete={handleDelete}
                    setRecordGrade={setRecordGrade}
                    setRecordCredits={setRecordCredits}
                    setRecordingId={setRecordingId}
                    setTimeRecordingId={setTimeRecordingId}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Anime.js-style Floating Spring Drag Overlay */}
            <DragOverlay dropAnimation={dropAnimation}>
              {activeExam ? (
                <ExamCardContent 
                  exam={activeExam}
                  handleDelete={handleDelete}
                  setRecordGrade={setRecordGrade}
                  setRecordCredits={setRecordCredits}
                  setRecordingId={setRecordingId}
                  setTimeRecordingId={setTimeRecordingId}
                  isOverlay={true}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Record Grade Modal */}
      <AnimatePresence>
        {recordingId && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="modal-content glass-panel modern-modal"
            >
              <h2>Esito Esame</h2>
              <p className="modal-subtitle">Complimenti! Quanto hai preso?</p>
              <form onSubmit={handleRecordGradeSubmit}>
                <div className="form-row">
                  {!exams.find(e => e.id === recordingId)?.isIdoneita && (
                    <div className="form-group">
                      <label>Voto</label>
                      <input 
                        type="text" 
                        required 
                        value={recordGrade} 
                        onChange={e => setRecordGrade(e.target.value)}
                        placeholder="28, 30L..."
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>CFU</label>
                    <input 
                      type="number" 
                      required 
                      min="1" max="30"
                      value={recordCredits} 
                      onChange={e => setRecordCredits(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={() => setRecordingId(null)}>Annulla</button>
                  <button type="submit" className="primary-btn">Salva Risultato</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Time Modal */}
      <AnimatePresence>
        {timeRecordingId && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="modal-content glass-panel modern-modal"
            >
              <h2>Sessione di Studio</h2>
              <p className="modal-subtitle">Traccia le tue ore di studio.</p>
              <form onSubmit={handleRecordTimeSubmit}>
                <div className="form-group">
                  <label>Tempo (minuti o HH:MM)</label>
                  <input 
                    type="text" 
                    required 
                    autoFocus
                    value={studyTimeInput} 
                    onChange={e => setStudyTimeInput(e.target.value)}
                    placeholder="Es. 120 o 2:30"
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={() => setTimeRecordingId(null)}>Annulla</button>
                  <button type="submit" className="primary-btn">Aggiungi Tempo</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Exams;
