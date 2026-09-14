import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import logger from './utils/logger'

const isDev = Boolean(import.meta.env?.DEV);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorId: null,
      safeMessage: 'Si è verificato un errore inaspettato.' 
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      errorId: `ERR_${Date.now().toString(36).toUpperCase()}`,
      safeMessage: isDev 
        ? error?.message || 'Errore di runtime' 
        : 'Si è verificato un errore inatteso. L\'applicazione è stata isolata per proteggere la tua sessione.'
    };
  }

  componentDidCatch(error, info) {
    // Log sicuro interno: non espone credenziali o percorsi all'utente finale
    logger.error('UniPlanner application error boundary caught exception:', {
      message: error?.message,
      stack: isDev ? error?.stack : undefined,
      componentStack: isDev ? info?.componentStack : undefined
    });
  }

  handleRestart = () => {
    window.location.reload();
  };

  handleSafeMode = () => {
    // Pulisce cache temporanea non essenziale per ripristinare il corretto funzionamento
    try {
      sessionStorage.clear();
      const keysToClean = ['uniplanner_theme_cache', 'uniplanner_temp_state'];
      keysToClean.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignora errori di storage
    }
    window.location.href = window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#0f172a', color: '#f8fafc',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '30px', fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: '20px', zIndex: 9999, textAlign: 'center'
        }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' 
          }}>
            🛡️
          </div>

          <div>
            <h2 style={{ color: '#f8fafc', fontSize: '22px', margin: '0 0 8px 0', fontWeight: 700 }}>
              Sessione Protetta da UniPlanner
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '520px', margin: 0, lineHeight: 1.6 }}>
              {this.state.safeMessage}
            </p>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.04)', padding: '10px 18px', borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '12px', color: '#64748b'
          }}>
            ID Diagnostico: <strong style={{ color: '#94a3b8' }}>{this.state.errorId}</strong>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleRestart}
              style={{
                padding: '10px 22px', background: '#3b82f6', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '14px', fontWeight: 600, transition: 'background 0.2s'
              }}
            >
              Riavvia UniPlanner
            </button>
            <button
              onClick={this.handleSafeMode}
              style={{
                padding: '10px 22px', background: 'transparent', color: '#94a3b8',
                border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer',
                fontSize: '14px', fontWeight: 500
              }}
            >
              Riavvia in Modalità Provvisoria
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
