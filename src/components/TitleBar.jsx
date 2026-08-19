import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import './TitleBar.css';

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  useEffect(() => {
    if (!isElectron) return;
    const checkMaximized = async () => {
      if (window.electronAPI.isMaximized) {
        const max = await window.electronAPI.isMaximized();
        setIsMaximized(max);
      }
    };
    checkMaximized();
  }, [isElectron]);

  if (!isElectron) return null;

  const handleMinimize = () => {
    window.electronAPI.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI.maximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.electronAPI.close();
  };

  return (
    <header className="electron-titlebar">
      <div className="titlebar-drag-region">
        <div className="titlebar-brand">
          <div className="titlebar-logo">UP</div>
          <span className="titlebar-title">UniPlanner Desktop</span>
        </div>
      </div>

      <div className="titlebar-controls">
        <button 
          className="titlebar-btn minimize-btn" 
          onClick={handleMinimize}
          title="Riduci a icona"
          type="button"
        >
          <Minus size={15} strokeWidth={2.2} />
        </button>
        <button 
          className="titlebar-btn maximize-btn" 
          onClick={handleMaximize}
          title={isMaximized ? "Ripristina" : "Ingrandisci"}
          type="button"
        >
          {isMaximized ? <Copy size={13} strokeWidth={2.2} /> : <Square size={13} strokeWidth={2.2} />}
        </button>
        <button 
          className="titlebar-btn close-btn" 
          onClick={handleClose}
          title="Chiudi"
          type="button"
        >
          <X size={16} strokeWidth={2.4} />
        </button>
      </div>
    </header>
  );
};

export default TitleBar;
