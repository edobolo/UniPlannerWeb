/**
 * cloudSync.js - UniPlanner Raspberry Pi Cloud Backend Connector
 * Comunica in tempo reale con il server Node.js + SQLite sul tuo Raspberry Pi.
 */

export const BACKEND_URL = 'https://kentucky-dates-concord-ssl.trycloudflare.com/api';

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
    university: user.university || '',
    degreeCourse: user.degreeCourse || '',
    avatarColor: user.avatarColor || '#8b5cf6',
    status: user.status || 'In sessione 🎯',
    bio: user.bio || '',
    shareGrades: user.shareGrades !== false,
    exams: (exams || []).map(e => ({
      name: e.name || '',
      grade: e.grade || null,
      cfu: Number(e.credits || e.cfu) || 6,
      status: e.grade ? 'passed' : 'planned',
      year: e.year || '1° Anno'
    })),
    schedule: (schedule || []).map(s => ({
      dayIndex: typeof s.dayIndex === 'number' ? s.dayIndex : 0,
      startTime: s.startTime || '09:00',
      endTime: s.endTime || '11:00',
      subject: s.subject || '',
      room: s.room || '',
      professor: s.professor || '',
      color: s.color || '#38bdf8'
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
    const res = await fetch(`${BACKEND_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
    const res = await fetch(`${BACKEND_URL}/friends/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
    const res = await fetch(`${BACKEND_URL}/friends/my-list/${encodeURIComponent(normalizeFriendCode(myCode))}`);
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
    const res = await fetch(`${BACKEND_URL}/friends/${encodeURIComponent(code)}`);
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


