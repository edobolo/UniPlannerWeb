/**
 * logger.js — UniPlanner Secure Client-Side Logger
 * 
 * Garantisce che:
 * 1. I log di debug non appaiano nella console del browser in produzione
 * 2. Password, token, chiavi API ed email vengano mascherati automaticamente
 * 3. Gli eventi di sicurezza vengano tracciati in modo pulito e sicuro
 */

import { maskSensitiveData } from './security';

const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;

export const logger = {
  /**
   * Log di debug (attivo solo in sviluppo)
   */
  debug(...args) {
    if (isProd) return;
    const sanitizedArgs = args.map(arg => typeof arg === 'object' ? maskSensitiveData(arg) : arg);
    console.debug('[UP DEBUG]', ...sanitizedArgs);
  },

  /**
   * Log informativo generale
   */
  info(...args) {
    if (isProd) return;
    const sanitizedArgs = args.map(arg => typeof arg === 'object' ? maskSensitiveData(arg) : arg);
    console.info('[UP INFO]', ...sanitizedArgs);
  },

  /**
   * Log di avviso
   */
  warn(...args) {
    const sanitizedArgs = args.map(arg => typeof arg === 'object' ? maskSensitiveData(arg) : arg);
    console.warn('[UP WARN]', ...sanitizedArgs);
  },

  /**
   * Log di errore (maschera dati sensibili, non espone credenziali)
   */
  error(...args) {
    const sanitizedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return isProd ? arg.message : arg;
      }
      return typeof arg === 'object' ? maskSensitiveData(arg) : arg;
    });
    console.error('[UP ERROR]', ...sanitizedArgs);
  },

  /**
   * Log specifico per eventi di sicurezza (tentativi di file injection, XSS o auth errati)
   */
  security(event, details = {}) {
    const safeDetails = maskSensitiveData(details);
    console.warn(`[UP SECURITY ALERT] ${event}`, safeDetails);
  }
};

export default logger;
