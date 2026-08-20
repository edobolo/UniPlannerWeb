import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Award, 
  BookOpen, 
  Edit2, 
  Sparkles, 
  Sliders, 
  GraduationCap, 
  Compass,
  CheckCircle2
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { exportLibrettoToPDF } from '../utils/pdfExport';
import { safeJsonParse } from '../utils/security';
import { 
  UNIVERSITY_DEGREE_PRESETS, 
  calculateDegreeProjection, 
  calculateRequiredAverageForTarget 
} from '../utils/degreeMath';
import './Grades.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Grades = ({ exams: propExams }) => {
  const { currentUser } = useAuth();

  const [exams, setExams] = useState(() => {
    if (propExams && propExams.length > 0) return propExams;
    const saved = localStorage.getItem('uniplanner_exams');
    return saved ? safeJsonParse(saved, []) : [];
  });

  useEffect(() => {
    if (propExams && propExams.length > 0) {
      setExams(propExams);
    } else {
      const loadExams = () => {
        const saved = localStorage.getItem('uniplanner_exams');
        setExams(saved ? safeJsonParse(saved, []) : []);
      };
      loadExams();
      window.addEventListener('storage', loadExams);
      return () => window.removeEventListener('storage', loadExams);
    }
  }, [propExams]);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('uniplanner_settings');
    return saved ? safeJsonParse(saved, { targetGrade: 28, targetCfu: 180, lodeBonus: 0.5 }) : { targetGrade: 28, targetCfu: 180, lodeBonus: 0.5 };
  });

  // Degree Simulator State (Totalmente Aperto per Tutti)
  const [selectedPresetId, setSelectedPresetId] = useState('dm270_standard');
  const [degreeConfig, setDegreeConfig] = useState(UNIVERSITY_DEGREE_PRESETS[0]);
  const [thesisPoints, setThesisPoints] = useState(4);
  const [hasInCorso, setHasInCorso] = useState(true);
  const [hasErasmus, setHasErasmus] = useState(false);
  const [hasSperimentale, setHasSperimentale] = useState(false);
  const [simTargetGrade, setSimTargetGrade] = useState(110);

  useEffect(() => {
    localStorage.setItem('uniplanner_settings', JSON.stringify(settings));
  }, [settings]);

  const [currentTheme, setCurrentTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [currentAccent, setCurrentAccent] = useState(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#3b82f6';
  });

  useEffect(() => {
    const updateThemeState = () => {
      const t = document.documentElement.getAttribute('data-theme') || 'dark';
      const c = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#3b82f6';
      setCurrentTheme(t);
      setCurrentAccent(c);
    };

    updateThemeState();
    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
    return () => observer.disconnect();
  }, []);

  const handlePresetChange = (presetId) => {
    setSelectedPresetId(presetId);
    const found = UNIVERSITY_DEGREE_PRESETS.find(p => p.id === presetId);
    if (found) {
      setDegreeConfig({ ...found });
      if (thesisPoints > found.thesisPointsMax) {
        setThesisPoints(found.thesisPointsMax);
      }
    }
  };

  // Calculations
  const completedExams = exams.filter(e => e.grade !== null && e.grade !== undefined && e.grade !== '');
  const gradedExams = completedExams.filter(e => e.grade !== 'IDONEO');

  const totalCfu = completedExams.reduce((acc, curr) => acc + (Number(curr.credits || curr.cfu) || 0), 0);
  const gradedCfu = gradedExams.reduce((acc, curr) => acc + (Number(curr.credits || curr.cfu) || 0), 0);
  
  const lodeCount = gradedExams.filter(e => e.grade === '30L' || e.grade === '30 e lode' || e.grade === '30 e Lode').length;
  
  const sumPonderata = gradedExams.reduce((acc, curr) => {
    const isLode = (curr.grade === '30L' || curr.grade === '30 e lode' || curr.grade === '30 e Lode');
    const val = isLode ? 31 : Number(curr.grade);
    return acc + (val * (Number(curr.credits || curr.cfu) || 0));
  }, 0);

  const sumAritmetica = gradedExams.reduce((acc, curr) => {
    const isLode = (curr.grade === '30L' || curr.grade === '30 e lode' || curr.grade === '30 e Lode');
    const val = isLode ? 30 : Number(curr.grade);
    return acc + val;
  }, 0);

  const mediaPonderata = gradedCfu > 0 ? (sumPonderata / gradedCfu).toFixed(2) : 0;
  const mediaAritmetica = gradedExams.length > 0 ? (sumAritmetica / gradedExams.length).toFixed(2) : 0;

  const baseLaurea = gradedCfu > 0 
    ? ((sumPonderata / gradedCfu) * 110 / 30 + (lodeCount * settings.lodeBonus)).toFixed(2) 
    : 0;

  const isLight = currentTheme === 'light';

  // Degree Simulator Calculations
  const degreeResult = calculateDegreeProjection(exams, degreeConfig, {
    thesisPoints,
    hasInCorso,
    hasErasmus,
    hasSperimentale
  });

  const targetAnalysis = calculateRequiredAverageForTarget(
    exams, 
    simTargetGrade, 
    degreeConfig, 
    { thesisPoints, hasInCorso, hasErasmus }, 
    settings.targetCfu
  );

  // Chart Data
  const chartData = {
    labels: gradedExams.map(e => e.name.substring(0, 12) + (e.name.length > 12 ? '...' : '')),
    datasets: [
      {
        fill: true,
        label: 'Andamento Voti',
        data: gradedExams.map(e => (e.grade === '30L' || e.grade === '30 e lode' || e.grade === '30 e Lode') ? 31 : Number(e.grade)),
        borderColor: currentAccent,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 280);
          gradient.addColorStop(0, currentAccent + '40');
          gradient.addColorStop(1, currentAccent + '05');
          return gradient;
        },
        tension: 0.35,
        pointBackgroundColor: currentAccent,
        pointBorderColor: isLight ? '#ffffff' : '#1e293b',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 18,
        max: 31,
        ticks: {
          stepSize: 1,
          color: isLight ? '#475569' : 'rgba(255, 255, 255, 0.65)',
          font: { weight: 600, size: 11 },
          callback: (value) => value === 31 ? '30L' : value
        },
        grid: {
          color: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)',
          drawBorder: false
        }
      },
      x: {
        ticks: { 
          color: isLight ? '#475569' : 'rgba(255, 255, 255, 0.65)',
          font: { weight: 600, size: 11 }
        },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isLight ? '#ffffff' : '#0f172a',
        titleColor: isLight ? '#0f172a' : '#f8fafc',
        bodyColor: isLight ? '#334155' : '#e2e8f0',
        borderColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => context.raw === 31 ? ' Voto: 30 e Lode 🌟' : ` Voto: ${context.raw}`
        }
      }
    }
  };

  const updateTargetGrade = () => {
    const val = prompt('Inserisci il tuo obiettivo di media (18-30):', settings.targetGrade);
    if (val && !isNaN(val) && val >= 18 && val <= 30) {
      setSettings({ ...settings, targetGrade: Number(val) });
    }
  };

  const updateTargetCfu = () => {
    const val = prompt('Inserisci il target totale di CFU per la tua laurea (es. 180 Triennale, 120 Magistrale):', settings.targetCfu);
    if (val && !isNaN(val) && val > 0) {
      setSettings({ ...settings, targetCfu: Number(val) });
    }
  };

  return (
    <div className="grades-container">
      <header className="grades-header">
        <div>
          <h1 className="page-title">Statistiche e Andamento</h1>
          <p className="page-subtitle">Monitora i tuoi progressi verso la laurea</p>
        </div>
        <button 
          className="secondary-btn" 
          onClick={() => exportLibrettoToPDF(exams, mediaPonderata, mediaAritmetica, baseLaurea)}
        >
          <BookOpen size={18} />
          <span>Esporta PDF</span>
        </button>
      </header>

      {/* Main Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card glass-panel main-stat">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-primary)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <h3>Media Ponderata</h3>
            <div className="stat-value highlight">{mediaPonderata}</div>
            <div className="stat-sub">Aritmetica: {mediaAritmetica}</div>
          </div>
        </div>

        <div className="stat-card glass-panel main-stat">
          <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>
            <Award size={24} />
          </div>
          <div className="stat-info">
            <h3>Base Laurea Base</h3>
            <div className="stat-value highlight-purple">{baseLaurea} <span className="text-sm">/ 110</span></div>
            <div className="stat-sub">{lodeCount} Lodi ottenute</div>
          </div>
        </div>
      </div>

      <div className="goals-grid">
        <div className="stat-card glass-panel goal-card" onClick={updateTargetGrade}>
          <div className="stat-info">
            <div className="goal-header">
              <h3>Obiettivo Media</h3>
              <Edit2 size={14} className="edit-icon" />
            </div>
            <div className="stat-value">{settings.targetGrade}</div>
            {mediaPonderata > 0 && (
              <div className={`goal-diff ${mediaPonderata >= settings.targetGrade ? 'positive' : 'negative'}`}>
                {mediaPonderata >= settings.targetGrade ? '+' : ''}
                {(mediaPonderata - settings.targetGrade).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        <div className="stat-card glass-panel goal-card" onClick={updateTargetCfu}>
          <div className="stat-info">
            <div className="goal-header">
              <h3>Progresso CFU</h3>
              <Edit2 size={14} className="edit-icon" />
            </div>
            <div className="stat-value">{totalCfu} <span className="text-sm">/ {settings.targetCfu}</span></div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${Math.min(100, (totalCfu / settings.targetCfu) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 🎓 ADVANCED DEGREE SIMULATOR (LIBERO E COMPLETO PER TUTTI) */}
      <div className="degree-simulator-card glass-panel">
        <div className="sim-header">
          <div className="sim-title-group">
            <div className="sim-badge-pro">
              <Sparkles size={14} />
              <span>Simulatore Ufficiale Atenei</span>
            </div>
            <h2>Simulatore di Laurea & Calcolo Tesi</h2>
            <p className="sim-subtitle">
              Calcolo esatto secondo i Regolamenti Didattici d'Ateneo (D.M. 270/04), scarto crediti e punteggio commissione
            </p>
          </div>
        </div>

        <div className="sim-content">
          {/* Presets Row */}
          <div className="sim-presets-section">
            <label className="sim-label">
              <Compass size={16} />
              <span>Regolamento Didattico Ateneo:</span>
            </label>
            <div className="sim-presets-grid">
              {UNIVERSITY_DEGREE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-btn ${selectedPresetId === p.id ? 'active' : ''}`}
                  onClick={() => handlePresetChange(p.id)}
                >
                  <strong>{p.name}</strong>
                  <span>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Config & Sliders Grid */}
          <div className="sim-controls-grid">
            {/* Tesi Slider */}
            <div className="sim-control-box">
              <div className="control-header">
                <label>Punti Tesi / Prova Finale</label>
                <span className="control-value">+{thesisPoints} pt</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={degreeConfig.thesisPointsMax || 7} 
                step="1"
                value={thesisPoints} 
                onChange={(e) => setThesisPoints(Number(e.target.value))}
                className="sim-slider"
              />
              <div className="slider-limits">
                <span>0 pt (Min)</span>
                <span>Max {degreeConfig.thesisPointsMax} pt ({degreeConfig.name})</span>
              </div>
            </div>

            {/* Bonus Carriera Checkboxes */}
            <div className="sim-control-box">
              <label className="control-title-box">Bonus Carriera & Ateneo</label>
              <div className="sim-checkboxes">
                <label className="sim-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={hasInCorso} 
                    onChange={(e) => setHasInCorso(e.target.checked)} 
                  />
                  <span>Laurea in Corso (+{degreeConfig.inCorsoBonus} pt)</span>
                </label>

                <label className="sim-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={hasErasmus} 
                    onChange={(e) => setHasErasmus(e.target.checked)} 
                  />
                  <span>Erasmus / Estero (+{degreeConfig.erasmusBonus} pt)</span>
                </label>

                <label className="sim-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={hasSperimentale} 
                    onChange={(e) => setHasSperimentale(e.target.checked)} 
                  />
                  <span>Tesi Sperimentale (+1 pt)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Degree Results Projection Board */}
          <div className="sim-results-board">
            <div className="result-metric">
              <span className="metric-label">Voto Base di Partenza</span>
              <span className="metric-number">{degreeResult.baseGrade}</span>
              <span className="metric-hint">Media Ponderata × 110/30</span>
            </div>

            <div className="result-metric highlight-box">
              <span className="metric-label">Voto Finale Proiettato</span>
              <span className="metric-number primary">
                {degreeResult.finalRounded}
                <span className="metric-sub"> / 110</span>
              </span>
              <span className="metric-hint">
                {degreeResult.isLodePossible ? '🌟 110 e Lode Possibile!' : `Esatto: ${degreeResult.finalProjected}/110`}
              </span>
            </div>

            <div className="result-metric">
              <span className="metric-label">Fascia di Merito ECTS</span>
              <span className="metric-number ects">{degreeResult.ectsGrade.split(' ')[0]}</span>
              <span className="metric-hint">{degreeResult.ectsGrade}</span>
            </div>
          </div>

          {/* Target Calculator: "Cosa mi serve per..." */}
          <div className="sim-target-solver">
            <div className="solver-header">
              <GraduationCap size={20} style={{ color: 'var(--accent-primary)' }} />
              <h3>Simulatore a Ritroso: Cosa ti serve per il tuo voto target?</h3>
            </div>
            <div className="solver-inputs">
              <label>Seleziona il voto finale desiderato:</label>
              <div className="target-pills">
                {[100, 102, 105, 108, 110].map((tg) => (
                  <button
                    key={tg}
                    type="button"
                    className={`target-pill ${simTargetGrade === tg ? 'active' : ''}`}
                    onClick={() => setSimTargetGrade(tg)}
                  >
                    {tg}/110
                  </button>
                ))}
              </div>
            </div>
            <div className={`solver-verdict ${targetAnalysis.achievable ? 'achievable' : 'unachievable'}`}>
              <strong>{targetAnalysis.achievable ? '✅ Obiettivo Raggiungibile' : '⚠️ Obiettivo Matematicamente Difficile'}</strong>
              <p>{targetAnalysis.message}</p>
            </div>
          </div>
        </div>
      </div>

      {/* High Contrast Chart */}
      <div className="chart-container glass-panel">
        <h3 className="chart-title">Andamento Voti</h3>
        <div className="chart-wrapper">
          {gradedExams.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="empty-chart">Nessun voto registrato per mostrare il grafico.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Grades;
