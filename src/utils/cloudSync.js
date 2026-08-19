/**
 * cloudSync.js - UniPlanner Real Cloud Sync Relay
 * Permette la sincronizzazione reale dei profili, orari ed esami tra amici online tramite Codice Amico.
 */

// Utilizziamo un cloud storage JSON REST pubblico e veloce dedicato a UniPlanner
const CLOUD_SYNC_ENDPOINT = 'https://uniplanner-cloud-sync-default-rtdb.europe-west1.firebasedatabase.app/students';

/**
 * Normalizza il codice amico in formato maiuscolo e senza spazi
 */
export const normalizeFriendCode = (code) => {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/\s+/g, '');
};

/**
 * Pubblica o aggiorna il profilo pubblico reale dello studente nel cloud
 */
export const publishUserProfile = async (user, exams = [], schedule = [], deadlines = []) => {
  if (!user || !user.friendCode) return false;

  const normalizedCode = normalizeFriendCode(user.friendCode);

  // Calcola statistiche reali basate sugli esami effettivi dello studente
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

  const profilePayload = {
    id: user.id || usr_,
    username: user.username || '',
    fullName: user.fullName || user.username || 'Studente',
    friendCode: normalizedCode,
    university: user.university || 'Ateneo non specificato',
    degreeCourse: user.degreeCourse || 'Corso non specificato',
    avatarColor: user.avatarColor || '#8b5cf6',
    status: user.status || 'Libero ☕',
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

  try {
    const url = `${CLOUD_SYNC_ENDPOINT}/${normalizedCode}.json`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profilePayload)
    });

    if (!response.ok) {
      console.warn('Cloud sync warning:', response.statusText);
    }
    return true;
  } catch (err) {
    console.warn('Errore pubblicazione profilo cloud:', err);
    return false;
  }
};

/**
 * Cerca e scarica in tempo reale il VERO profilo di uno studente dal cloud tramite il suo Codice Amico o Username
 */
export const fetchUserProfile = async (friendCodeOrUsername) => {
  if (!friendCodeOrUsername) return null;
  const query = normalizeFriendCode(friendCodeOrUsername);

  try {
    // 1. Ricerca diretta per Codice Amico
    const directUrl = `${CLOUD_SYNC_ENDPOINT}/${query}.json`;
    const directRes = await fetch(directUrl);
    if (directRes.ok) {
      const data = await directRes.json();
      if (data && data.friendCode) {
        return data;
      }
    }

    // 2. Ricerca per Username in caso sia stato inserito l'username invece del codice
    const allUrl = `${CLOUD_SYNC_ENDPOINT}.json?shallow=false`;
    const allRes = await fetch(allUrl);
    if (allRes.ok) {
      const allProfiles = await allRes.json();
      if (allProfiles && typeof allProfiles === 'object') {
        const found = Object.values(allProfiles).find(p => 
          p && (
            p.friendCode?.toUpperCase() === query ||
            p.username?.toUpperCase() === query ||
            p.username?.toUpperCase() === query.replace('@', '')
          )
        );
        if (found) return found;
      }
    }

    return null;
  } catch (err) {
    console.error('Errore ricerca amico nel cloud:', err);
    return null;
  }
};
