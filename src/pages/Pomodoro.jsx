import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';
import './Pomodoro.css';

const Pomodoro = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('pomodoro'); // pomodoro, shortBreak, longBreak

  const MODES = {
    pomodoro: { label: 'Pomodoro', time: 25 * 60, color: '#ef4444' },
    shortBreak: { label: 'Pausa Corta', time: 5 * 60, color: '#3b82f6' },
    longBreak: { label: 'Pausa Lunga', time: 15 * 60, color: '#8b5cf6' }
  };

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      // Play sound notification
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log("Audio play blocked"));
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

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

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = ((MODES[mode].time - timeLeft) / MODES[mode].time) * 100;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="pomodoro-container">
      <header className="pomodoro-header">
        <div>
          <h1 className="page-title">Pomodoro Timer</h1>
          <p className="page-subtitle">Massimizza la concentrazione, gestisci le pause</p>
        </div>
      </header>

      <div className="pomodoro-content">
        <div className="pomodoro-card glass-panel">
          <div className="mode-selector">
            {Object.entries(MODES).map(([key, val]) => (
              <button 
                key={key} 
                className={`mode-btn ${mode === key ? 'active' : ''}`}
                onClick={() => switchMode(key)}
              >
                {val.label}
              </button>
            ))}
          </div>

          <div className="timer-wrapper">
            <svg className="timer-svg" width="300" height="300" viewBox="0 0 300 300">
              <circle
                className="timer-track"
                cx="150" cy="150" r={radius}
                strokeWidth="12"
              />
              <motion.circle
                className="timer-progress"
                cx="150" cy="150" r={radius}
                strokeWidth="12"
                stroke={MODES[mode].color}
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: "linear" }}
                style={{ strokeLinecap: 'round' }}
              />
            </svg>
            <div className="timer-display">
              <span className="time-text">{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="timer-controls">
            <button className="control-btn primary-btn" onClick={toggleTimer} style={{ background: MODES[mode].color }}>
              {isActive ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: 4 }} />}
            </button>
            <button className="control-btn ghost-btn" onClick={resetTimer}>
              <RotateCcw size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pomodoro;
