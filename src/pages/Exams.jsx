import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Clock, 
  ChevronDown, 
  CheckCircle2, 
  GraduationCap, 
  LayoutGrid, 
  List, 
  GripHorizontal,
  HardDrive,
  FileText,
  BookOpen,
  Cloud,
  Folder,
  Code,
  Layout,
  ExternalLink,
  X,
  Link2,
  Sparkles
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
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
import { detectResourceType, sanitizeResourceUrl } from '../utils/resourceHelper';
import './Exams.css';

const YEAR_OPTIONS = ["1° Anno", "2° Anno", "3° Anno", "4° Anno", "5° Anno", "Opzionale", "N/D"];
const SORT_OPTIONS = [
  { id: 'YEAR_ASC', label: 'Per Anno (Standard)' },
  { id: 'NAME', label: 'Alfabetico (A-Z)' },
  { id: 'GRADE_DESC', label: 'Voto (Migliori)' },
  { id: 'RECENT', label: 'Aggiunti di recente' },
  { id: 'MANUAL', label: 'Personalizzato (Trascina Desktop)' }
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

const getResourceIconComponent = (iconName) => {
  switch (iconName) {
    case 'HardDrive': return HardDrive;
    case 'FileText': return FileText;
    case 'BookOpen': return BookOpen;
    case 'Cloud': return Cloud;
    case 'Folder': return Folder;
    case 'Code': return Code;
    case 'Layout': return Layout;
    default: return ExternalLink;
  }
};

// Exam Card Content Presentation
const ExamCardContent = ({ 
  exam, 
  handleDelete, 
  setRecordGrade, 
  setRecordCredits, 
  setRecordingId, 
  setTimeRecordingId, 
  setActiveResourceExamId,
  handleRemoveResource,
  isOverlay = false, 
  dragHandleProps = {} 
}) => {
  const isDone = exam.grade !== null;
  const yearColor = getYearColor(exam.year);
  const hasDragHandle = dragHandleProps && Object.keys(dragHandleProps).length > 0;
  const resources = Array.isArray(exam.resources) ? exam.resources : [];

  return (
    <div 
      className={`modern-exam-card glass-panel ${isDone ? 'is-completed' : ''} ${isOverlay ? 'is-floating-overlay' : ''}`}
      style={{ '--theme-color': yearColor }}
    >
      <div className="card-top-accent"></div>
      
      <div className="card-header">
        <div className="header-left">
          {hasDragHandle && (
            <div className="drag-handle" title="Trascina per riordinare" {...dragHandleProps}>
              <GripHorizontal size={18} />
            </div>
          )}
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

        {/* 📂 Smart Link Hub: Materiali, Drive, Notion */}
        <div className="exam-resources-container">
          <div className="resources-pills-wrap">
            {resources.map(res => {
              const typeInfo = detectResourceType(res.url);
              const IconComp = getResourceIconComponent(typeInfo.iconName);
              return (
                <div 
                  key={res.id} 
                  className="resource-badge-pill"
                  style={{
                    color: typeInfo.color,
                    background: typeInfo.bgColor,
                    borderColor: typeInfo.borderColor
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isOverlay && res.url) {
                      window.open(res.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  title={`Apri ${res.title || typeInfo.label}: ${res.url}`}
                >
                  <IconComp size={12} className="res-icon" />
                  <span className="res-title">{res.title || typeInfo.label}</span>
                  {!isOverlay && (
                    <button 
                      type="button" 
                      className="res-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (handleRemoveResource) handleRemoveResource(exam.id, res.id);
                      }}
                      title="Rimuovi link"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}

            {!isOverlay && (
              <button 
                type="button" 
                className="add-resource-pill-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (setActiveResourceExamId) setActiveResourceExamId(exam.id);
                }}
                title="Collega cartella Drive, Notion, dispense o link appunti"
              >
                <Plus size={12} />
                <span>Link Appunti</span>
              </button>
            )}
          </div>
        </div>
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
    >
      <ExamCardContent {...props} dragHandleProps={listeners} />
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

  // 📂 Smart Link Hub: State per aggiungere risorse & appunti
  const [activeResourceExamId, setActiveResourceExamId] = useState(null);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Long-press to drag on touch, allowing normal vertical scrolling
        tolerance: 8,
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

  const handleAddResourceSubmit = (e) => {
    e.preventDefault();
    if (!activeResourceExamId || !resourceUrl.trim()) return;

    const cleanUrl = sanitizeResourceUrl(resourceUrl);
    const detected = detectResourceType(cleanUrl);
    const title = resourceTitle.trim() || detected.label;

    const newResource = {
      id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title,
      url: cleanUrl,
      type: detected.id,
      createdAt: new Date().toISOString()
    };

    setExams(prev => prev.map(ex => {
      if (ex.id === activeResourceExamId) {
        const cur = Array.isArray(ex.resources) ? ex.resources : [];
        return { ...ex, resources: [...cur, newResource] };
      }
      return ex;
    }));

    setActiveResourceExamId(null);
    setResourceTitle('');
    setResourceUrl('');
  };

  const handleRemoveResource = (examId, resourceId) => {
    setExams(prev => prev.map(ex => {
      if (ex.id === examId) {
        const cur = Array.isArray(ex.resources) ? ex.resources : [];
        return { ...ex, resources: cur.filter(r => r.id !== resourceId) };
      }
      return ex;
    }));
  };

  const activeResourceExam = activeResourceExamId ? exams.find(e => e.id === activeResourceExamId) : null;
  const detectedTypePreview = resourceUrl ? detectResourceType(sanitizeResourceUrl(resourceUrl)) : null;

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
          <select 
            value={newYear} 
            onChange={e => setNewYear(e.target.value)}
            className="modern-select"
          >
            {YEAR_OPTIONS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <label className="checkbox-pill">
            <input 
              type="checkbox" 
              checked={newIsIdoneita} 
              onChange={e => setNewIsIdoneita(e.target.checked)} 
            />
            <span>Idoneità</span>
          </label>

          <button type="submit" className="primary-btn add-btn">
            <Plus size={18} />
            <span>Aggiungi</span>
          </button>
        </div>
      </motion.form>

      {/* Controls Bar: Sort, View Toggle */}
      <div className="exams-toolbar">
        <div className="sort-wrapper">
          <button 
            className="toolbar-btn"
            onClick={() => setIsSortOpen(!isSortOpen)}
          >
            <span>Ordina: {SORT_OPTIONS.find(s => s.id === sortMethod)?.label}</span>
            <ChevronDown size={16} />
          </button>

          <AnimatePresence>
            {isSortOpen && (
              <motion.div 
                className="dropdown-menu glass-panel"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    className={`dropdown-item ${sortMethod === opt.id ? 'active' : ''}`}
                    onClick={() => {
                      setSortMethod(opt.id);
                      setIsSortOpen(false);
                    }}
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
            className={`icon-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Vista a Griglia"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            className={`icon-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Vista a Lista"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Main Exams List / Grid */}
      <div className="exams-content-area">
        {exams.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="empty-state-modern"
          >
            <div className="empty-icon-blob"><GraduationCap size={48} /></div>
            <h3>Nessun Esame Programmato</h3>
            <p>Inizia ad aggiungere gli esami del tuo corso di laurea usando la barra qui sopra.</p>
          </motion.div>
        ) : sortMethod === 'MANUAL' ? (
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
                    setActiveResourceExamId={setActiveResourceExamId}
                    handleRemoveResource={handleRemoveResource}
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
                  setActiveResourceExamId={setActiveResourceExamId}
                  handleRemoveResource={handleRemoveResource}
                  isOverlay={true}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className={`exams-layout ${viewMode === 'grid' ? 'layout-grid' : 'layout-list'}`}>
            {sortedExams.map(exam => (
              <ExamCardContent 
                key={exam.id}
                exam={exam}
                handleDelete={handleDelete}
                setRecordGrade={setRecordGrade}
                setRecordCredits={setRecordCredits}
                setRecordingId={setRecordingId}
                setTimeRecordingId={setTimeRecordingId}
                setActiveResourceExamId={setActiveResourceExamId}
                handleRemoveResource={handleRemoveResource}
              />
            ))}
          </div>
        )}
      </div>

      {/* 📂 Add Resource Link Modal */}
      <AnimatePresence>
        {activeResourceExamId && (
          <div className="modal-overlay" onClick={() => setActiveResourceExamId(null)}>
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="modal-content glass-panel modern-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-title-with-badge">
                <h2>Collega Risorse & Appunti</h2>
                {activeResourceExam && (
                  <span className="exam-target-badge">{activeResourceExam.name}</span>
                )}
              </div>
              <p className="modal-subtitle">
                Incolla il link della tua cartella Google Drive, pagina Notion, OneDrive o dispense online.
              </p>

              <form onSubmit={handleAddResourceSubmit}>
                <div className="form-group">
                  <label>Link / URL del Materiale *</label>
                  <div className="url-input-container">
                    <Link2 size={16} className="url-input-icon" />
                    <input 
                      type="url" 
                      required 
                      autoFocus
                      value={resourceUrl} 
                      onChange={e => setResourceUrl(e.target.value)}
                      placeholder="https://drive.google.com/... o https://notion.so/..."
                    />
                  </div>
                </div>

                {/* Real-time Service Detection Pill */}
                {detectedTypePreview && resourceUrl.trim() && (
                  <div className="detected-service-box">
                    <span className="detected-label">Servizio Riconosciuto:</span>
                    <span 
                      className="detected-pill"
                      style={{ 
                        color: detectedTypePreview.color, 
                        background: detectedTypePreview.bgColor,
                        borderColor: detectedTypePreview.borderColor 
                      }}
                    >
                      <Sparkles size={13} />
                      <strong>{detectedTypePreview.label}</strong>
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label>Nome / Descrizione (Opzionale)</label>
                  <input 
                    type="text" 
                    value={resourceTitle} 
                    onChange={e => setResourceTitle(e.target.value)}
                    placeholder={detectedTypePreview ? `Es. Cartella ${detectedTypePreview.label}` : "Es. Riassunto Teoremi, Slide Docente..."}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={() => setActiveResourceExamId(null)}>Annulla</button>
                  <button type="submit" className="primary-btn">
                    <Plus size={16} />
                    <span>Aggiungi Risorsa</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Grade Modal */}
      <AnimatePresence>
        {recordingId && (
          <div className="modal-overlay" onClick={() => setRecordingId(null)}>
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="modal-content glass-panel modern-modal"
              onClick={e => e.stopPropagation()}
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
          <div className="modal-overlay" onClick={() => setTimeRecordingId(null)}>
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="modal-content glass-panel modern-modal"
              onClick={e => e.stopPropagation()}
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
