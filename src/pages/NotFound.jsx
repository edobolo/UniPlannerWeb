import React from 'react';
import { Compass, BookOpen, Home } from 'lucide-react';
import './NotFound.css';

export default function NotFound({ onNavigate }) {
  return (
    <div className="notfound-container">
      <div className="notfound-card">
        <div className="notfound-code-badge">
          <span>STATUS: 404 NOT FOUND</span>
        </div>

        <div className="notfound-icon-wrap">
          <Compass size={36} />
        </div>

        <h1 className="notfound-title">
          Pagina Non Trovata nell'Archivio
        </h1>

        <p className="notfound-desc">
          La sezione o il documento accademico a cui stai tentando di accedere non esiste, 
          è stato archiviato oppure il percorso specificato contiene refusi.
        </p>

        <div className="notfound-actions">
          <button 
            type="button" 
            className="notfound-btn-primary" 
            onClick={() => onNavigate ? onNavigate('esami') : window.location.assign('/')}
          >
            <Home size={16} />
            <span>Torna al Piano Esami</span>
          </button>

          <button 
            type="button" 
            className="notfound-btn-secondary" 
            onClick={() => onNavigate ? onNavigate('benvenuto') : window.location.assign('/?tab=benvenuto')}
          >
            <BookOpen size={16} />
            <span>Guida Introduttiva</span>
          </button>
        </div>
      </div>
    </div>
  );
}
