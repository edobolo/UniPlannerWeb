import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Send, X, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendBugReport } from '../utils/cloudSync';
import './BugReportModal.css';

const BugReportModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    setErrorMsg('');

    try {
      const errorLog = includeLogs 
        ? `UserAgent: ${navigator.userAgent} | Screen: ${window.innerWidth}x${window.innerHeight}` 
        : '';

      const ok = await sendBugReport({
        friendCode: currentUser?.friendCode || 'GUEST',
        username: currentUser?.fullName || currentUser?.username || 'Ospite',
        message: message.trim(),
        errorLog
      });

      if (ok) {
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          setMessage('');
          onClose();
        }, 2200);
      } else {
        throw new Error('Impossibile inviare la segnalazione. Riprova più tardi.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Errore di connessione al server.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay">
        <motion.div 
          className="modal-content glass-panel bug-modal"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
        >
          <div className="bug-modal-header">
            <div className="bug-header-title">
              <div className="bug-icon-bubble">
                <Bug size={20} />
              </div>
              <div>
                <h3>Segnala un Bug o Feedback</h3>
                <p>Aiutaci a migliorare UniPlanner inviando suggerimenti o errori</p>
              </div>
            </div>
            <button className="icon-btn close-btn" onClick={onClose} title="Chiudi">
              <X size={18} />
            </button>
          </div>

          {isSuccess ? (
            <div className="bug-success-state">
              <CheckCircle2 size={48} className="success-icon" />
              <h4>Segnalazione Inviata con Successo! 🎉</h4>
              <p>Grazie per il tuo contributo. Il team riceverà subito il report sul Raspberry Pi.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bug-form">
              {errorMsg && (
                <div className="bug-error-alert">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="form-group">
                <label>Descrivi il problema o il suggerimento:</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Es. Non riesco a trascinare le lezioni su Safari mobile, oppure: sarebbe bello aggiungere..."
                  required
                />
              </div>

              <div className="form-checkbox-row">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={includeLogs} 
                    onChange={(e) => setIncludeLogs(e.target.checked)} 
                  />
                  <span>Includi dettagli tecnici del dispositivo per facilitare la risoluzione</span>
                </label>
              </div>

              <div className="bug-form-actions">
                <button type="button" className="ghost-btn" onClick={onClose}>
                  Annulla
                </button>
                <button type="submit" className="primary-btn" disabled={isSending || !message.trim()}>
                  <Send size={16} />
                  <span>{isSending ? 'Invio in corso...' : 'Invia Segnalazione'}</span>
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BugReportModal;
