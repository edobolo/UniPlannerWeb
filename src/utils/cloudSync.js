/**
 * cloudSync.js - UniPlanner Raspberry Pi Cloud Backend Connector
 * Comunica in tempo reale con il server Node.js + SQLite sul tuo Raspberry Pi.
 * Implementa throttling client-side, sanitizzazione profonda payload e logging sicuro.
 */

import { cachedFetch, cacheInvalidate, profileKey, friendsListKey, TTL } from './apiCache.js';
import { sanitizeText, sanitizeObject, isValidFriendCode } from './security.js';
import logger from './logger.js';

export const BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) 
  || 'https://shabby-myself-gleeful.ngrok-free.dev/api';

// Client-side rate-limiting / throttling per prevenire loop e richieste a raffica
let requestCount = 0;
let lastReset = Date.now();
const MAX_CLIENT_REQS_PER_10S = 25;

function checkClientRateLimit() {
  const now = Date.now();
  if (now - lastReset > 10000) {
    requestCount = 0;
    lastReset = now;
  }
  requestCount++;
  if (requestCount > MAX_CLIENT_REQS_PER_10S) {
    logger.warn('Client-side rate limit attivato: troppe richieste inviate in rapida successione.');
    return false;
  }
  return true;
}

/**
 * Wrapper per fetch che include sempre gli header necessari per Ngrok, CORS e sicurezza
 */
export const apiFetch = async (endpoint, options = {}) => {
  if (!checkClientRateLimit()) {
    throw new Error('Frequenza richieste troppo elevata. Attendi qualche secondo.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers || {})
  };

  try {
    return await fetch(url, { ...options, headers });
  } catch (err) {
    logger.error(`Network fetch error per ${endpoint}:`, err.message);
    throw err;
  }
};

/**
 * Normalizza il codice amico in formato maiuscolo e senza spazi
 */
export const normalizeFriendCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/\s+/g, '');
};

/**
 * Pubblica o aggiorna il profilo reale dello studente sul Raspberry Pi.
 * Sanifica automaticamente tutto il payload prima della trasmissione.
 */
export const publishUserProfile = async (user, exams = [], schedule = [], deadlines = []) => {
  if (!user || !user.friendCode) return false;

  const rawPayload = {
    friendCode: normalizeFriendCode(user.friendCode),
    username: user.username ? sanitizeText(user.username, 30) : '',
    fullName: sanitizeText(user.fullName || user.username || 'Studente', 50),
    email: user.email ? sanitizeText(user.email, 100).toLowerCase() : '',
    // Non inviare mai la password in chiaro; invia solo l'hash crittografico se disponibile
    passwordHash: user.passwordHash || '',
    university: sanitizeText(user.university || '', 80),
    degreeCourse: sanitizeText(user.degreeCourse || '', 80),
    avatarColor: sanitizeText(user.avatarColor || '#8b5cf6', 20),
    status: sanitizeText(user.status || 'In sessione 🎯', 40),
    bio: sanitizeText(user.bio || '', 200),
    shareGrades: user.shareGrades !== false,
    exams: (exams || []).map(e => ({
      id: e.id || `ex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: sanitizeText(e.name || '', 80),
      grade: e.grade ? sanitizeText(String(e.grade), 10) : null,
      cfu: Number(e.credits || e.cfu) || 6,
      credits: Number(e.credits || e.cfu) || 6,
      status: e.grade ? 'passed' : 'planned',
      year: sanitizeText(e.year || '1° Anno', 20),
      isIdoneita: Boolean(e.isIdoneita),
      studyTimeMin: Number(e.studyTimeMin) || 0
    })),
    schedule: (schedule || []).map(s => ({
      id: s.id || `les_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      dayIndex: typeof s.dayIndex === 'number' ? s.dayIndex : 0,
      startTime: sanitizeText(s.startTime || '09:00', 10),
      endTime: sanitizeText(s.endTime || '11:00', 10),
      subject: sanitizeText(s.subject || '', 60),
      room: sanitizeText(s.room || '', 30),
      professor: sanitizeText(s.professor || '', 50),
      color: sanitizeText(s.color || '#38bdf8', 20),
      date: s.date ? sanitizeText(s.date, 20) : null,
      isSpecificDate: Boolean(s.date)
    })),
    deadlines: (deadlines || []).map(d => ({
      id: d.id || String(Date.now()),
      title: sanitizeText(d.title || '', 100),
      date: sanitizeText(d.date || '', 20),
      tag: sanitizeText(d.subject || 'Esame', 50),
      color: '#38bdf8',
      completed: Boolean(d.completed)
    }))
  };

  // Sanificazione profonda di sicurezza
  const payload = sanitizeObject(rawPayload);

  try {
    const res = await apiFetch('/sync', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      // Invalida la cache del profilo così il prossimo fetch scarica dati freschi
      cacheInvalidate(profileKey(user.friendCode));
      cacheInvalidate(friendsListKey(user.friendCode));
    }
    return res.ok;
  } catch (err) {
    logger.warn('Errore sincronizzazione con Raspberry Pi:', err.message);
    return false;
  }
};

/**
 * Collega due amici in modo RECIPROCO sul database del Raspberry Pi
 */
export const connectMutualFriend = async (myCode, targetCode) => {
  if (!myCode || !targetCode) return null;
  const cleanMyCode = normalizeFriendCode(myCode);
  const cleanTargetCode = normalizeFriendCode(targetCode);

  try {
    const res = await apiFetch('/friends/connect', {
      method: 'POST',
      body: JSON.stringify({
        myCode: cleanMyCode,
        targetCode: cleanTargetCode
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.friend || null;
    }
    return null;
  } catch (err) {
    logger.error('Errore collegamento reciproco amici:', err.message);
    return null;
  }
};

/**
 * Scarica la lista di tutti gli amici collegati reciprocamente dal Raspberry Pi
 */
export const fetchMyFriendsList = async (myCode) => {
  if (!myCode) return [];
  const cleanCode = normalizeFriendCode(myCode);
  const key = friendsListKey(cleanCode);

  return cachedFetch(key, async () => {
    try {
      const res = await apiFetch(`/friends/my-list/${encodeURIComponent(cleanCode)}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.friends) ? data.friends : [];
      }
      return [];
    } catch (err) {
      logger.warn('Errore recupero lista amici reciproci:', err.message);
      return [];
    }
  }, TTL.FRIENDS_LIST);
};

/**
 * Cerca e recupera il VERO profilo dello studente dal Raspberry Pi tramite Codice Amico o Username
 */
export const fetchUserProfile = async (queryInput) => {
  if (!queryInput) return null;
  const clean = sanitizeText(queryInput, 100).trim();

  // Supporta anche se viene incollato un link completo
  let code = clean;
  if (code.includes('?u=')) {
    code = code.split('?u=')[1].split('&')[0];
  } else if (code.includes('?p=')) {
    code = code.split('?p=')[1].split('&')[0];
  }
  code = normalizeFriendCode(code);

  const key = profileKey(code);
  return cachedFetch(key, async () => {
    try {
      const res = await apiFetch(`/friends/${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.friendCode || data.username)) {
          return data;
        }
      }
      return null;
    } catch (err) {
      logger.error('Errore recupero amico dal Raspberry Pi:', err.message);
      return null;
    }
  }, TTL.USER_PROFILE);
};

/**
 * Genera il link di condivisione breve
 */
export const generateShareLink = (user) => {
  if (!user || !user.friendCode) return '';
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://uniplanner-web.vercel.app';

  return `${baseUrl}?u=${encodeURIComponent(user.friendCode)}`;
};

/**
 * Invia una segnalazione bug o feedback al server Raspberry Pi
 */
export const sendBugReport = async ({ friendCode, username, message, errorLog }) => {
  try {
    const payload = sanitizeObject({
      friendCode: sanitizeText(friendCode || 'ANON', 30),
      username: sanitizeText(username || 'Anonimo', 50),
      message: sanitizeText(message || '', 3000),
      errorLog: sanitizeText(errorLog || '', 500),
      userAgent: typeof navigator !== 'undefined' ? sanitizeText(navigator.userAgent, 300) : '',
      timestamp: new Date().toISOString()
    });

    const res = await apiFetch('/report-bug', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    logger.error('Errore invio report bug:', err.message);
    return false;
  }
};

/**
 * Resetta la password dell'utente verificando Codice Amico ed Email
 */
export const resetUserPassword = async (friendCode, email, newPassword) => {
  const cleanCode = normalizeFriendCode(friendCode);
  const cleanEmail = sanitizeText(email, 100).toLowerCase();

  try {
    const res = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ friendCode: cleanCode, email: cleanEmail, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossibile resettare la password.');
    return data;
  } catch (err) {
    logger.warn('Tentativo di reset password fallito:', err.message);
    throw err;
  }
};

/**
 * Autentica l'utente tramite il server backend Raspberry Pi
 */
export const loginUserOnline = async (identifier, password) => {
  const cleanId = sanitizeText(identifier, 100).trim();

  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: cleanId, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenziali non valide.');
    return data.user;
  } catch (err) {
    logger.warn('Tentativo di login online fallito per identifier:', cleanId.slice(0, 3) + '***');
    throw err;
  }
};
