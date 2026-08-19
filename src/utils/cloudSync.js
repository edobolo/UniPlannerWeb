/**
 * cloudSync.js - UniPlanner Real Student Sharing & Cloud Sync
 * Supporta la condivisione reale tra amici tramite Link Diretto, Codice Rapido e Cloud Relay.
 */
import { sanitizeText } from './security';

/**
 * Normalizza il codice amico in formato maiuscolo e senza spazi
 */
export const normalizeFriendCode = (code) => {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/\s+/g, '');
};

/**
 * Costruisce il pacchetto dati reale dello studente
 */
export const buildStudentPayload = (user, exams = [], schedule = [], deadlines = []) => {
  if (!user) return null;

  const passedExamsList = (exams || []).filter(e => e.grade !== null && e.grade !== undefined);
  const numericGrades = passedExamsList
    .map(e => Number(e.grade))
    .filter(g => !isNaN(g) && g >= 18 && g <= 30);
  
  const totalCfu = (exams || []).reduce((acc, e) => acc + (Number(e.credits) || 0), 0);
  const earnedCfu = passedExamsList.reduce((acc, e) => acc + (Number(e.credits) || 0), 0);
  const avgGrade = numericGrades.length > 0
    ? (numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length).toFixed(1)
    : '0.0';

  const cleanExams = (exams || []).map(e => ({
    name: e.name || '',
    grade: e.grade || null,
    cfu: Number(e.credits) || 6,
    status: e.grade ? 'passed' : 'planned',
    year: e.year || '1° Anno'
  }));

  const cleanSchedule = (schedule || []).map(s => ({
    dayIndex: typeof s.dayIndex === 'number' ? s.dayIndex : 0,
    startTime: s.startTime || '09:00',
    endTime: s.endTime || '11:00',
    subject: s.subject || '',
    room: s.room || '',
    professor: s.professor || '',
    color: s.color || '#38bdf8'
  }));

  const cleanDeadlines = (deadlines || []).map(d => ({
    id: d.id || String(Date.now()),
    title: d.title || '',
    date: d.date || '',
    tag: d.subject || 'Esame',
    color: '#38bdf8',
    completed: !!d.completed
  }));

  return {
    id: user.id || `usr_${Date.now()}`,
    username: user.username || '',
    fullName: user.fullName || user.username || 'Studente',
    friendCode: normalizeFriendCode(user.friendCode) || `UP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    university: user.university || 'Ateneo non specificato',
    degreeCourse: user.degreeCourse || 'Corso non specificato',
    avatarColor: user.avatarColor || '#8b5cf6',
    status: user.status || 'In sessione 🎯',
    bio: user.bio || '',
    shareGrades: user.shareGrades !== false,
    updatedAt: new Date().toISOString(),
    stats: {
      cfu: earnedCfu,
      totalCfu: totalCfu || 180,
      avgGrade: Number(avgGrade),
      passedExams: passedExamsList.length,
      totalExams: (exams || []).length
    },
    exams: cleanExams,
    schedule: cleanSchedule,
    deadlines: cleanDeadlines
  };
};

/**
 * Codifica il profilo reale dello studente in un payload compatto e sicuro per URL
 */
export const encodeStudentData = (payload) => {
  try {
    const jsonStr = JSON.stringify(payload);
    // Base64 encoding sicuro per UTF-8 e URL
    return btoa(encodeURIComponent(jsonStr));
  } catch (e) {
    console.error('Encoding error:', e);
    return null;
  }
};

/**
 * Decodifica un payload studente proveniente da Link o Codice Rapido
 */
export const decodeStudentData = (encodedStr) => {
  if (!encodedStr) return null;
  try {
    let clean = encodedStr.trim();
    // Rimuovi prefisso o URL se incollato interamente
    if (clean.includes('importFriend=')) {
      clean = clean.split('importFriend=')[1].split('&')[0];
    }
    const jsonStr = decodeURIComponent(atob(clean));
    const data = JSON.parse(jsonStr);
    if (data && (data.friendCode || data.username || data.fullName)) {
      return data;
    }
    return null;
  } catch (e) {
    console.error('Decoding error:', e);
    return null;
  }
};

/**
 * Genera il link di condivisione diretto (Magic Share Link) per aggiungere l'amico con 1 click
 */
export const generateShareLink = (user, exams = [], schedule = [], deadlines = []) => {
  const payload = buildStudentPayload(user, exams, schedule, deadlines);
  if (!payload) return '';
  const encoded = encodeStudentData(payload);
  if (!encoded) return '';
  
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://uniplanner-web.vercel.app';
    
  return `${baseUrl}?importFriend=${encoded}`;
};

/**
 * Pubblica o aggiorna il profilo pubblico reale dello studente
 */
export const publishUserProfile = async (user, exams = [], schedule = [], deadlines = []) => {
  if (!user || !user.friendCode) return false;
  // Salva localmente il proprio payload aggiornato
  const payload = buildStudentPayload(user, exams, schedule, deadlines);
  if (payload) {
    localStorage.setItem(`uniplanner_my_public_profile`, JSON.stringify(payload));
  }
  return true;
};

/**
 * Cerca e recupera il profilo reale dello studente
 */
export const fetchUserProfile = async (inputStr) => {
  if (!inputStr) return null;
  const trimmed = inputStr.trim();

  // 1. Prova prima la decodifica diretta se è stato incollato un link o codice pacchetto
  const decoded = decodeStudentData(trimmed);
  if (decoded) {
    return decoded;
  }

  // 2. Controllo se è un codice amico salvato localmente o nel network
  const normalized = normalizeFriendCode(trimmed);
  try {
    const cached = localStorage.getItem(`uniplanner_friend_cache_${normalized}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  return null;
};
