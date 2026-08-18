import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, Info, AlertCircle, X, Trash2 } from 'lucide-react';
import './Notifications.css';

const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'info', title: 'Benvenuto in UniPlanner', message: 'Inizia a pianificare il tuo semestre aggiungendo le tue prime materie.', date: new Date().toISOString() },
  { id: 2, type: 'success', title: 'Sessione di Studio', message: 'Ottimo lavoro! Hai completato 4 Pomodori oggi.', date: new Date(Date.now() - 86400000).toISOString() },
  { id: 3, type: 'alert', title: 'Scadenza Imminente', message: 'Ricorda la consegna del progetto di Ingegneria del Software tra 2 giorni!', date: new Date(Date.now() - 172800000).toISOString() }
];

const Notifications = () => {
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('uniplanner_notifications');
    return saved ? JSON.parse(saved) : MOCK_NOTIFICATIONS;
  });

  const clearAll = () => {
    setNotifications([]);
    localStorage.setItem('uniplanner_notifications', JSON.stringify([]));
  };

  const removeNotification = (id) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem('uniplanner_notifications', JSON.stringify(updated));
  };

  const getIcon = (type) => {
    switch(type) {
      case 'success': return <CheckCircle2 className="notif-icon success" />;
      case 'alert': return <AlertCircle className="notif-icon alert" />;
      default: return <Info className="notif-icon info" />;
    }
  };

  const formatDate = (dateString) => {
    const options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('it-IT', options);
  };

  return (
    <div className="notifications-container">
      <header className="notifications-header">
        <div>
          <h1 className="page-title">Centro Notifiche</h1>
          <p className="page-subtitle">Rimani aggiornato su scadenze ed eventi</p>
        </div>
        {notifications.length > 0 && (
          <button className="ghost-btn danger-text" onClick={clearAll}>
            <Trash2 size={18} />
            <span>Pulisci Tutto</span>
          </button>
        )}
      </header>

      <div className="notifications-list">
        <AnimatePresence>
          {notifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="empty-state glass-panel"
            >
              <Bell size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <p>Nessuna nuova notifica.</p>
            </motion.div>
          ) : (
            notifications.map(notif => (
              <motion.div 
                key={notif.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                layout
                className="notification-card glass-panel"
              >
                <div className="notif-icon-wrapper">
                  {getIcon(notif.type)}
                </div>
                <div className="notif-content">
                  <div className="notif-header">
                    <h3>{notif.title}</h3>
                    <span className="notif-date">{formatDate(notif.date)}</span>
                  </div>
                  <p className="notif-message">{notif.message}</p>
                </div>
                <button className="icon-btn close-btn" onClick={() => removeNotification(notif.id)}>
                  <X size={18} />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Notifications;
