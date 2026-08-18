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
  const [exams, setExams] = useState(() => {
    const saved = localStorage.getItem('uniplanner_exams');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('uniplanner_settings');
    return saved ? JSON.parse(saved) : { targetGrade: 28, targetCfu: 180, lodeBonus: 0.5 };
  });

  useEffect(() => {
    localStorage.setItem('uniplanner_settings', JSON.stringify(settings));
  }, [settings]);

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

  // Chart Data
  const chartData = {
    labels: gradedExams.map(e => e.name.substring(0, 10) + (e.name.length > 10 ? '...' : '')),
    datasets: [
      {
        fill: true,
        label: 'Andamento Voti',
        data: gradedExams.map(e => e.grade === '30L' ? 31 : Number(e.grade)),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.4,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
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
          color: 'rgba(255, 255, 255, 0.5)',
          callback: (value) => value === 31 ? '30L' : value
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        }
      },
      x: {
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => context.raw === 31 ? 'Voto: 30L' : `Voto: ${context.raw}`
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
