// api/calendar.js - Vercel Serverless Function per Live iCalendar Feed (RFC 5545)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Estrai il codice da req.query o dal path /api/calendar/CODE.ics
  let code = req.query.code || req.query.friendCode || req.query.id || '';
  if (!code && req.url) {
    const match = req.url.match(/\/calendar\/([^?&/]+)/i);
    if (match && match[1]) {
      code = match[1];
    }
  }
  code = String(code).replace(/\.ics$/i, '').toUpperCase().trim();

  let studentData = {
    friendCode: code || 'UNIPLANNER',
    fullName: 'Studente UniPlanner',
    schedule: [],
    exams: [],
    deadlines: []
  };

  if (code) {
    try {
      // Interroga l'endpoint /api/friends/:code attivo sul backend Raspberry Pi
      const searchRes = await fetch(`https://shabby-myself-gleeful.ngrok-free.dev/api/friends/${encodeURIComponent(code)}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (searchRes.ok) {
        const found = await searchRes.json();
        if (found && !found.error) {
          studentData = {
            ...studentData,
            ...found,
            schedule: Array.isArray(found.schedule) ? found.schedule : [],
            exams: Array.isArray(found.exams) ? found.exams : [],
            deadlines: Array.isArray(found.deadlines) ? found.deadlines : []
          };
        }
      }
    } catch (err) {
      console.warn('Errore lettura dati studente da Raspberry Pi:', err);
    }
  }

  // Genera il file .ics conforme a RFC 5545
  const icsString = buildIcsContent(studentData);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="uniplanner.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(icsString);
}

function buildIcsContent(student) {
  const DAY_MAP = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const pad = (n) => String(n).padStart(2, '0');
  const formatUtc = (d) => {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };
  const escapeIcs = (str) => {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  };

  const now = new Date();
  const dtstamp = formatUtc(now);
  const untilDate = new Date(now);
  untilDate.setMonth(untilDate.getMonth() + 6);
  const untilStr = formatUtc(untilDate);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniPlanner//IT//UniPlanner Web App//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:UniPlanner - ${escapeIcs(student.fullName || student.username || 'Orario Lezioni')}`,
    'X-WR-TIMEZONE:Europe/Rome',
    'X-WR-CALDESC:Sincronizzazione automatica orario lezioni ed esami UniPlanner',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H'
  ];

  const schedule = Array.isArray(student.schedule) ? student.schedule : [];
  const exams = Array.isArray(student.exams) ? student.exams : [];
  const deadlines = Array.isArray(student.deadlines) ? student.deadlines : [];

  let eventsCount = 0;

  // 1. LEZIONI SETTIMANALI & A DATA SPECIFICA
  schedule.forEach((l, idx) => {
    const subject = l.subject || 'Lezione Universitaria';
    const room = l.room ? `Aula: ${l.room}` : '';
    const prof = l.professor ? `Docente: ${l.professor}` : '';
    const desc = [prof, room].filter(Boolean).join('\n');
    const [startH, startM] = (l.startTime || '09:00').split(':').map(Number);
    const [endH, endM] = (l.endTime || '11:00').split(':').map(Number);

    if (l.date) {
      const d = new Date(l.date);
      const dtStart = new Date(d);
      dtStart.setHours(startH || 9, startM || 0, 0, 0);
      const dtEnd = new Date(d);
      dtEnd.setHours(endH || 11, endM || 0, 0, 0);

      lines.push(
        'BEGIN:VEVENT',
        `UID:les_single_${l.id || idx}_${dtStart.getTime()}@uniplanner.it`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatUtc(dtStart)}`,
        `DTEND:${formatUtc(dtEnd)}`,
        `SUMMARY:${escapeIcs(subject)}`,
        l.room ? `LOCATION:${escapeIcs(l.room)}` : '',
        desc ? `DESCRIPTION:${escapeIcs(desc)}` : '',
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
      eventsCount++;
    } else {
      const dayIdx = typeof l.dayIndex === 'number' ? l.dayIndex : 0;
      const currentDay = (now.getDay() + 6) % 7;
      let diff = dayIdx - currentDay;
      if (diff < 0) diff += 7;
      const startTarget = new Date(now);
      startTarget.setDate(now.getDate() + diff);
      const dtStart = new Date(startTarget);
      dtStart.setHours(startH || 9, startM || 0, 0, 0);
      const dtEnd = new Date(startTarget);
      dtEnd.setHours(endH || 11, endM || 0, 0, 0);

      lines.push(
        'BEGIN:VEVENT',
        `UID:les_rec_${l.id || idx}_${dayIdx}@uniplanner.it`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatUtc(dtStart)}`,
        `DTEND:${formatUtc(dtEnd)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${DAY_MAP[dayIdx] || 'MO'};UNTIL=${untilStr}`,
        `SUMMARY:${escapeIcs(subject)}`,
        l.room ? `LOCATION:${escapeIcs(l.room)}` : '',
        desc ? `DESCRIPTION:${escapeIcs(desc)}` : '',
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Promemoria: Lezione di ${escapeIcs(subject)}`,
        'END:VALARM',
        'END:VEVENT'
      );
      eventsCount++;
    }
  });

  // 2. APPELLI D'ESAME
  exams.forEach((ex, idx) => {
    if (!ex.date) return;
    const d = new Date(ex.date);
    if (isNaN(d.getTime())) return;
    const dtStart = new Date(d);
    if (ex.time) {
      const [h, m] = ex.time.split(':').map(Number);
      dtStart.setHours(h || 9, m || 0, 0, 0);
    } else {
      dtStart.setHours(9, 0, 0, 0);
    }
    const dtEnd = new Date(dtStart);
    dtEnd.setHours(dtStart.getHours() + 2);

    lines.push(
      'BEGIN:VEVENT',
      `UID:exam_${ex.id || idx}_${dtStart.getTime()}@uniplanner.it`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatUtc(dtStart)}`,
      `DTEND:${formatUtc(dtEnd)}`,
      `SUMMARY:🎯 Esame: ${escapeIcs(ex.name || 'Esame')}`,
      ex.classroom ? `LOCATION:${escapeIcs(ex.classroom)}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
    eventsCount++;
  });

  // 3. SCADENZE & CONSEGNE
  deadlines.forEach((dead, idx) => {
    if (!dead.date || dead.completed) return;
    const d = new Date(dead.date);
    if (isNaN(d.getTime())) return;
    const dtStart = new Date(d);
    dtStart.setHours(18, 0, 0, 0);
    const dtEnd = new Date(d);
    dtEnd.setHours(19, 0, 0, 0);

    lines.push(
      'BEGIN:VEVENT',
      `UID:deadline_${dead.id || idx}_${dtStart.getTime()}@uniplanner.it`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatUtc(dtStart)}`,
      `DTEND:${formatUtc(dtEnd)}`,
      `SUMMARY:⏳ Scadenza: ${escapeIcs(dead.title || 'Consegna')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
    eventsCount++;
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}
