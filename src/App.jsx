import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Clock, Calendar, Bell, TrendingUp, Sun, Moon } from 'lucide-react';
import Grades from './pages/Grades';
import Exams from './pages/Exams';
import Deadlines from './pages/Deadlines';
import Pomodoro from './pages/Pomodoro';
import Notifications from './pages/Notifications';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('esami');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('uniplanner_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('uniplanner_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navItems = [
    { id: 'esami', label: 'Piano di Studi', icon: BookOpen },
    { id: 'voti', label: 'Statistiche', icon: TrendingUp },
    { id: 'scadenze', label: 'Scadenze', icon: Calendar },
    { id: 'pomodoro', label: 'Pomodoro', icon: Clock },
    { id: 'notifiche', label: 'Notifiche', icon: Bell },
  ];

  return (
    <div className="app-container">
      <nav className="sidebar glass-panel">
        <div className="sidebar-top">
          <div className="logo-container">
            <div className="logo-icon">UP</div>
            <h2>UniPlanner</h2>
          </div>
          
          <ul className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <li key={item.id}>
                  <button 
                    className={`nav-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div 
                        layoutId="active-nav-bg"
                        className="nav-active-bg"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="sidebar-footer">
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Passa alla Modalità Chiara' : 'Passa alla Modalità Scura'}
          >
            <div className="theme-toggle-icon">
              {theme === 'dark' ? <Sun size={18} className="sun-icon" /> : <Moon size={18} className="moon-icon" />}
            </div>
            <span className="theme-toggle-label">
              {theme === 'dark' ? 'Tema Chiaro' : 'Tema Scuro'}
            </span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'esami' && (
            <motion.div
              key="esami"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Exams />
            </motion.div>
          )}

          {activeTab === 'voti' && (
            <motion.div
              key="voti"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Grades />
            </motion.div>
          )}

          {activeTab === 'scadenze' && (
            <motion.div
              key="scadenze"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Deadlines />
            </motion.div>
          )}

          {activeTab === 'pomodoro' && (
            <motion.div
              key="pomodoro"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Pomodoro />
            </motion.div>
          )}

          {activeTab === 'notifiche' && (
            <motion.div
              key="notifiche"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="page-wrapper"
            >
              <Notifications />
            </motion.div>
          )}
          
          {activeTab !== 'voti' && activeTab !== 'scadenze' && activeTab !== 'pomodoro' && activeTab !== 'notifiche' && activeTab !== 'esami' && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="placeholder-page glass-panel"
            >
              <h2>{navItems.find(i => i.id === activeTab)?.label}</h2>
              <p>Work in progress...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
