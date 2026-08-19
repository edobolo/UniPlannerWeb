import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('UniPlanner crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#0f172a', color: '#f8fafc',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px', fontFamily: 'monospace',
          gap: '16px', zIndex: 9999
        }}>
          <div style={{ fontSize: '36px' }}>💥</div>
          <h2 style={{ color: '#ef4444', fontSize: '20px', margin: 0 }}>UniPlanner — Errore di Avvio</h2>
          <pre style={{
            background: '#1e293b', padding: '20px', borderRadius: '12px',
            fontSize: '13px', maxWidth: '800px', overflowX: 'auto',
            whiteSpace: 'pre-wrap', border: '1px solid #ef4444'
          }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.info?.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 600
            }}
          >
            Ricarica App
          </button>
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
