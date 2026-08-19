/**
 * cloudSync.js - UniPlanner Ultra-Compact Student Profile Sharing
 * Genera link di condivisione ultra-corti ed eleganti per collegare gli amici con 1 clic.
 */

/**
 * Comprime il profilo dello studente in una struttura ultra-compatta
 */
export const compressProfile = (user, exams = [], schedule = [], deadlines = []) => {
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

  // Schema compatto:
  // n: fullName, u: username, uni: university, deg: degreeCourse, col: avatarColor, stat: status, bio: bio
  // ex: [ [name, grade, cfu, status] ]
  // sc: [ [dayIndex, startTime, endTime, subject, room, professor, color] ]
  // dl: [ [title, date, tag] ]
  return {
    n: user.fullName || user.username || 'Studente',
    u: user.username || '',
    uni: user.university || '',
    deg: user.degreeCourse || '',
    col: user.avatarColor || '#8b5cf6',
    stat: user.status || 'In sessione 🎯',
    bio: user.bio || '',
    sg: user.shareGrades !== false ? 1 : 0,
    st: [earnedCfu, totalCfu || 180, Number(avgGrade), passedExamsList.length, (exams || []).length],
    ex: (exams || []).map(e => [
      e.name || '',
      e.grade || '',
      Number(e.credits) || 6,
      e.grade ? 1 : 0
    ]),
    sc: (schedule || []).map(s => [
      typeof s.dayIndex === 'number' ? s.dayIndex : 0,
      s.startTime || '',
      s.endTime || '',
      s.subject || '',
      s.room || '',
      s.professor || '',
      s.color || '#38bdf8'
    ]),
    dl: (deadlines || []).map(d => [
      d.title || '',
      d.date || '',
      d.subject || 'Studio'
    ])
  };
};

/**
 * Decomprime il payload ultra-compatto nel formato completo di UniPlanner
 */
export const decompressProfile = (compact) => {
  if (!compact || (!compact.n && !compact.u)) return null;

  const exams = (compact.ex || []).map((e, idx) => ({
    id: `ex_${idx}`,
    name: e[0] || '',
    grade: e[1] !== '' ? e[1] : null,
    cfu: Number(e[2]) || 6,
    status: e[3] === 1 ? 'passed' : 'planned'
  }));

  const schedule = (compact.sc || []).map((s, idx) => ({
    id: `sc_${idx}`,
    dayIndex: Number(s[0]) || 0,
    startTime: s[1] || '09:00',
    endTime: s[2] || '11:00',
    subject: s[3] || '',
    room: s[4] || '',
    professor: s[5] || '',
    color: s[6] || '#38bdf8'
  }));

  const deadlines = (compact.dl || []).map((d, idx) => ({
    id: `dl_${idx}`,
    title: d[0] || '',
    date: d[1] || '',
    tag: d[2] || 'Studio',
    color: '#38bdf8',
    completed: false
  }));

  const statsArr = compact.st || [0, 180, 0, 0, exams.length];

  return {
    id: `fr_${compact.u || Date.now()}`,
    username: compact.u || '',
    fullName: compact.n || compact.u || 'Studente',
    university: compact.uni || 'Università',
    degreeCourse: compact.deg || 'Corso di Studi',
    avatarColor: compact.col || '#8b5cf6',
    status: compact.stat || 'Libero ☕',
    bio: compact.bio || '',
    shareGrades: compact.sg !== 0,
    stats: {
      cfu: statsArr[0] || 0,
      totalCfu: statsArr[1] || 180,
      avgGrade: statsArr[2] || 0,
      passedExams: statsArr[3] || 0,
      totalExams: statsArr[4] || exams.length
    },
    exams,
    schedule,
    deadlines
  };
};

/**
 * Codifica il profilo compatto in una stringa URL-safe corta
 */
export const encodeCompactString = (compactObj) => {
  try {
    const json = JSON.stringify(compactObj);
    return btoa(encodeURIComponent(json))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    console.error('Encoding compact err:', e);
    return '';
  }
};

/**
 * Decodifica una stringa URL-safe corta
 */
export const decodeCompactString = (str) => {
  if (!str) return null;
  try {
    let clean = str.trim();
    // Estrai il parametro p= o importFriend= se l'utente ha incollato l'intero link
    if (clean.includes('?p=')) {
      clean = clean.split('?p=')[1].split('&')[0];
    } else if (clean.includes('importFriend=')) {
      clean = clean.split('importFriend=')[1].split('&')[0];
    } else if (clean.includes('&p=')) {
      clean = clean.split('&p=')[1].split('&')[0];
    }

    // Ripristina padding Base64 standard
    clean = clean.replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4) clean += '=';

    const json = decodeURIComponent(atob(clean));
    const parsed = JSON.parse(json);
    
    // Supporta sia il nuovo schema compatto che il legacy
    if (parsed.n || parsed.u) {
      return decompressProfile(parsed);
    } else if (parsed.fullName || parsed.username) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.error('Decoding compact err:', e);
    return null;
  }
};

/**
 * Genera il link di invito corto
 */
export const generateShareLink = (user, exams = [], schedule = [], deadlines = []) => {
  const compact = compressProfile(user, exams, schedule, deadlines);
  if (!compact) return '';
  const token = encodeCompactString(compact);
  if (!token) return '';

  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://uniplanner-web.vercel.app';

  return `${baseUrl}?p=${token}`;
};

/**
 * Decodifica i dati dello studente da un link o codice incollato
 */
export const decodeStudentData = (inputStr) => {
  return decodeCompactString(inputStr);
};

