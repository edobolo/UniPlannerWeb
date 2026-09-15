import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg-primary, #0c1017)',
          color: 'var(--text-primary, #f1f5f9)',
          fontFamily: 'Plus Jakarta Sans, sans-serif'
        }}>
          <div style={{
            maxWidth: '540px',
            width: '100%',
            background: 'var(--bg-secondary, #141b26)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            borderRadius: '16px',
            padding: '36px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{
              fontFamily: 'Newsreader, Georgia, serif',
              fontSize: '28px',
              fontWeight: 600,
              margin: '0 0 12px',
              letterSpacing: '-0.02em'
            }}>
              Si è verificato un errore imprevisto
            </h2>

            <p style={{
              color: 'var(--text-secondary, #94a3b8)',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: '0 0 24px'
            }}>
              La pagina ha riscontrato un'anomalia di esecuzione. I tuoi dati salvati rimangono al sicuro nel database e nel cloud.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'var(--primary, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} />
                <span>Ricarica Applicazione</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
