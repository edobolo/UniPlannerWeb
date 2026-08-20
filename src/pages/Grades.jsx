import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, Target, BookOpen, Edit2 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { exportLibrettoToPDF } from '../utils/pdfExport';
import { useAuth } from '../context/AuthContext';
import { safeJsonParse } from '../utils/security';
import './Grades.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const Grades = () => {
  const { currentUser } = useAuth();
  const [exams, setExams] = useState(() => {
    const saved = localStorage.getItem('uniplanner_exams');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('uniplanner_settings');
    return saved ? JSON.parse(saved) : { targetGrade: 28, targetCfu: 180, lodeBonus: 0.5 };
  });

  // Reset data if logged out
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
      localStorage.setItem('uniplanner_settings', JSON.stringify(settings));
    }
  }, [settings, currentUser]);

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

  // Calculations
  const completedExams = exams.filter(e => e.grade !== null);
  const gradedExams = completedExams.filter(e => e.grade !== 'IDONEO');

  const totalCfu = completedExams.reduce((acc, curr) => acc + (curr.credits || 0), 0);
  const gradedCfu = gradedExams.reduce((acc, curr) => acc + (curr.credits || 0), 0);
  
  const lodeCount = gradedExams.filter(e => e.grade === '30L').length;
  
  const sumPonderata = gradedExams.reduce((acc, curr) => {
    const val = curr.grade === '30L' ? 31 : Number(curr.grade);
    return acc + (val * (curr.credits || 0));
  }, 0);

  const sumAritmetica = gradedExams.reduce((acc, curr) => {
    const val = curr.grade === '30L' ? 30 : Number(curr.grade);
    return acc + val;
  }, 0);

  const mediaPonderata = gradedCfu > 0 ? (sumPonderata / gradedCfu).toFixed(2) : 0;
  const mediaAritmetica = gradedExams.length > 0 ? (sumAritmetica / gradedExams.length).toFixed(2) : 0;

  const baseLaurea = gradedCfu > 0 
    ? ((sumPonderata / gradedCfu) * 110 / 30 + (lodeCount * settings.lodeBonus)).toFixed(2) 
    : 0;

  const isLight = currentTheme === 'light';

  // Chart Data
  const chartData = {
    labels: gradedExams.map(e => e.name.substring(0, 12) + (e.name.length > 12 ? '...' : '')),
    datasets: [
      {
        fill: true,
        label: 'Andamento Voti',
        data: gradedExams.map(e => e.grade === '30L' ? 31 : Number(e.grade)),
        borderColor: currentAccent,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 280);
          gradient.addColorStop(0, currentAccent + '40'); // 25% opacity
          gradient.addColorStop(1, currentAccent + '05'); // 2% opacity
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
    const val = prompt('Inserisci il target totale di CFU per la tua laurea:', settings.targetCfu);
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

      <div className="stats-grid">
        <div className="stat-card glass-panel main-stat">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
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
            <h3>Base Laurea</h3>
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
