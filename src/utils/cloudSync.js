/**
 * cloudSync.js - UniPlanner Raspberry Pi Cloud Backend Connector
 * Comunica in tempo reale con il server Node.js + SQLite sul tuo Raspberry Pi.
 */

export const BACKEND_URL = 'https://shabby-myself-gleeful.ngrok-free.dev/api';

/**
 * Wrapper per fetch che include sempre gli header necessari per Ngrok e CORS
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
};

/**
 * Normalizza il codice amico in formato maiuscolo e senza spazi
 */
export const normalizeFriendCode = (code) => {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/\s+/g, '');
};

/**
 * Pubblica o aggiorna il profilo reale dello studente sul Raspberry Pi
 */
export const publishUserProfile = async (user, exams = [], schedule = [], deadlines = []) => {
  if (!user || !user.friendCode) return false;

  const payload = {
    friendCode: normalizeFriendCode(user.friendCode),
    username: user.username || '',
    fullName: user.fullName || user.username || 'Studente',
    email: user.email || '',
    password: user.password || '',
    university: user.university || '',
    degreeCourse: user.degreeCourse || '',
    avatarColor: user.avatarColor || '#8b5cf6',
    status: user.status || 'In sessione 🎯',
    bio: user.bio || '',
    shareGrades: user.shareGrades !== false,
    exams: (exams || []).map(e => ({
      id: e.id || `ex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: e.name || '',
      grade: e.grade || null,
      cfu: Number(e.credits || e.cfu) || 6,
      credits: Number(e.credits || e.cfu) || 6,
      status: e.grade ? 'passed' : 'planned',
      year: e.year || '1° Anno',
      isIdoneita: Boolean(e.isIdoneita),
      studyTimeMin: Number(e.studyTimeMin) || 0
    })),
    schedule: (schedule || []).map(s => ({
      id: s.id || `les_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      dayIndex: typeof s.dayIndex === 'number' ? s.dayIndex : 0,
      startTime: s.startTime || '09:00',
      endTime: s.endTime || '11:00',
      subject: s.subject || '',
      room: s.room || '',
      professor: s.professor || '',
      color: s.color || '#38bdf8',
      date: s.date || null,
      isSpecificDate: Boolean(s.date)
    })),
    deadlines: (deadlines || []).map(d => ({
      id: d.id || String(Date.now()),
      title: d.title || '',
      date: d.date || '',
      tag: d.subject || 'Esame',
      color: '#38bdf8',
      completed: !!d.completed
    }))
  };

  try {
    const res = await apiFetch('/sync', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return res.ok;
  } catch (err) {
    console.warn('Errore sincronizzazione con Raspberry Pi:', err);
    return false;
  }
};

/**
 * Collega due amici in modo RECIPROCO sul database del Raspberry Pi
 */
export const connectMutualFriend = async (myCode, targetCode) => {
  if (!myCode || !targetCode) return null;
  try {
    const res = await apiFetch('/friends/connect', {
      method: 'POST',
      body: JSON.stringify({
        myCode: normalizeFriendCode(myCode),
        targetCode: normalizeFriendCode(targetCode)
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.friend || null;
    }
    return null;
  } catch (err) {
    console.error('Errore collegamento reciproco amici:', err);
    return null;
  }
};

/**
 * Scarica la lista di tutti gli amici collegati reciprocamente dal Raspberry Pi
 */
export const fetchMyFriendsList = async (myCode) => {
  if (!myCode) return [];
  try {
    const res = await apiFetch(`/friends/my-list/${encodeURIComponent(normalizeFriendCode(myCode))}`);
    if (res.ok) {
      const data = await res.json();
      return data.friends || [];
    }
    return [];
  } catch (err) {
    console.warn('Errore recupero lista amici reciproci:', err);
    return [];
  }
};

/**
 * Cerca e recupera il VERO profilo dello studente dal Raspberry Pi tramite Codice Amico o Username
 */
export const fetchUserProfile = async (queryInput) => {
  if (!queryInput) return null;
  const clean = queryInput.trim();

  // Supporta anche se viene incollato un link completo
  let code = clean;
  if (code.includes('?u=')) {
    code = code.split('?u=')[1].split('&')[0];
  } else if (code.includes('?p=')) {
    code = code.split('?p=')[1].split('&')[0];
  }

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
    console.error('Errore recupero amico dal Raspberry Pi:', err);
    return null;
  }
};

/**
 * Genera il link di condivisione breve
 */
export const generateShareLink = (user) => {
  if (!user || !user.friendCode) return '';
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://uniplanner-web.vercel.app';

  return `${baseUrl}?u=${user.friendCode}`;
};

/**
 * Invia una segnalazione bug o feedback al server Raspberry Pi
 */
export const sendBugReport = async ({ friendCode, username, message, errorLog }) => {
  try {
    const res = await apiFetch('/report-bug', {
      method: 'POST',
      body: JSON.stringify({
        friendCode: friendCode || 'ANON',
        username: username || 'Anonimo',
        message: message || '',
        errorLog: errorLog || '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: new Date().toISOString()
      })
    });
    return res.ok;
  } catch (err) {
    console.error('Errore invio report bug:', err);
    return false;
  }
};

/**
 * Resetta la password dell'utente verificando Codice Amico ed Email
 */
export const resetUserPassword = async (friendCode, email, newPassword) => {
  try {
    const res = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ friendCode, email, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossibile resettare la password.');
    return data;
  } catch (err) {
    throw err;
  }
};

/**
 * Autentica l'utente tramite il server backend Raspberry Pi
 */
export const loginUserOnline = async (identifier, password) => {
  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenziali non valide.');
    return data.user;
  } catch (err) {
    throw err;
  }
};


