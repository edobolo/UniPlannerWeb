/**
 * calendarGenerator.js - Generatore iCalendar (RFC 5545) per UniPlanner
 * Crea feed .ics validi e URL per sottoscrizioni live su Apple Calendar, Google Calendar e Outlook.
 */

import { BACKEND_URL } from './cloudSync';

const DAY_MAP = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/**
 * Formatta una data in stringa iCal UTC (es. 20260915T083000Z)
 */
function formatIcalDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Formatta una data solo giorno (es. 20260915)
 */
function formatIcalDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * Pulisce e fa l'escape dei caratteri speciali iCal
 */
function escapeIcalText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Trova la data del prossimo giorno della settimana specificato (0 = Lunedì, ..., 6 = Domenica)
 */
function getNextWeekdayDate(dayIndex) {
  const now = new Date();
  const currentDay = (now.getDay() + 6) % 7; // Converti 0=Dom in 0=Lun
  let diff = dayIndex - currentDay;
  if (diff < 0) diff += 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return target;
}

/**
 * Genera il contenuto completo di un file .ics conforme a RFC 5545
 */
export function generateIcsString({
  schedule = [],
  exams = [],
  deadlines = [],
  options = { includeSchedule: true, includeExams: true, includeDeadlines: true }
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniPlanner//IT//UniPlanner Web App//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:UniPlanner - Orario & Esami',
    'X-WR-TIMEZONE:Europe/Rome',
    'X-WR-CALDESC:Sincronizzazione orario lezioni, appelli d\'esame e scadenze universitarie da UniPlanner'
  ];

  const now = new Date();
  const dtstamp = formatIcalDateTime(now);

  // Calcola data fine semestre (6 mesi nel futuro di default)
  const semesterEnd = new Date(now);
  semesterEnd.setMonth(semesterEnd.getMonth() + 6);
  const untilStr = formatIcalDateTime(semesterEnd);

  // 1. LEZIONI (ORARIO SETTIMANALE)
  if (options.includeSchedule && Array.isArray(schedule)) {
    schedule.forEach((lesson, idx) => {
      const subject = lesson.subject || 'Lezione Universitaria';
      const room = lesson.room ? `Aula: ${lesson.room}` : '';
      const prof = lesson.professor ? `Docente: ${lesson.professor}` : '';
      const notes = [prof, room].filter(Boolean).join('\n');

      const startParts = (lesson.startTime || '09:00').split(':').map(Number);
      const endParts = (lesson.endTime || '11:00').split(':').map(Number);

      if (lesson.date) {
        // Lezione in data specifica singola
        const singleDate = new Date(lesson.date);
        const dtStart = new Date(singleDate);
        dtStart.setHours(startParts[0] || 9, startParts[1] || 0, 0, 0);
        const dtEnd = new Date(singleDate);
        dtEnd.setHours(endParts[0] || 11, endParts[1] || 0, 0, 0);

        lines.push(
          'BEGIN:VEVENT',
          `UID:lesson_single_${lesson.id || idx}_${dtStart.getTime()}@uniplanner.it`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${formatIcalDateTime(dtStart)}`,
          `DTEND:${formatIcalDateTime(dtEnd)}`,
          `SUMMARY:${escapeIcalText(subject)}`,
          lesson.room ? `LOCATION:${escapeIcalText(lesson.room)}` : '',
          notes ? `DESCRIPTION:${escapeIcalText(notes)}` : '',
          'STATUS:CONFIRMED',
          'END:VEVENT'
        );
      } else {
        // Lezione settimanale ricorrente
        const dayIdx = typeof lesson.dayIndex === 'number' ? lesson.dayIndex : 0;
        const startDate = getNextWeekdayDate(dayIdx);
        const dtStart = new Date(startDate);
        dtStart.setHours(startParts[0] || 9, startParts[1] || 0, 0, 0);
        const dtEnd = new Date(startDate);
        dtEnd.setHours(endParts[0] || 11, endParts[1] || 0, 0, 0);

        const rruleDay = DAY_MAP[dayIdx] || 'MO';

        lines.push(
          'BEGIN:VEVENT',
          `UID:lesson_rec_${lesson.id || idx}_${dayIdx}@uniplanner.it`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${formatIcalDateTime(dtStart)}`,
          `DTEND:${formatIcalDateTime(dtEnd)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};UNTIL=${untilStr}`,
          `SUMMARY:${escapeIcalText(subject)}`,
          lesson.room ? `LOCATION:${escapeIcalText(lesson.room)}` : '',
          notes ? `DESCRIPTION:${escapeIcalText(notes)}` : '',
          'STATUS:CONFIRMED',
          'BEGIN:VALARM',
          'TRIGGER:-PT15M',
          'ACTION:DISPLAY',
          `DESCRIPTION:Promemoria: Lezione di ${escapeIcalText(subject)}`,
          'END:VALARM',
          'END:VEVENT'
        );
      }
    });
  }

  // 2. APPELLI D'ESAME
  if (options.includeExams && Array.isArray(exams)) {
    exams.forEach((exam, idx) => {
      if (!exam.date) return;
      const examDate = new Date(exam.date);
      if (isNaN(examDate.getTime())) return;

      const dtStart = new Date(examDate);
      if (exam.time) {
        const [h, m] = exam.time.split(':').map(Number);
        dtStart.setHours(h || 9, m || 0, 0, 0);
      } else {
        dtStart.setHours(9, 0, 0, 0);
      }

      const dtEnd = new Date(dtStart);
      dtEnd.setHours(dtStart.getHours() + 2); // Durata stimata 2h

      const cfuStr = exam.credits || exam.cfu ? `(${exam.credits || exam.cfu} CFU)` : '';
      const summary = `🎯 Esame: ${exam.name || 'Esame'} ${cfuStr}`;
      const desc = [
        exam.professor ? `Docente: ${exam.professor}` : '',
        exam.classroom ? `Aula: ${exam.classroom}` : '',
        exam.notes ? `Note: ${exam.notes}` : ''
      ].filter(Boolean).join('\n');

      lines.push(
        'BEGIN:VEVENT',
        `UID:exam_${exam.id || idx}_${dtStart.getTime()}@uniplanner.it`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatIcalDateTime(dtStart)}`,
        `DTEND:${formatIcalDateTime(dtEnd)}`,
        `SUMMARY:${escapeIcalText(summary)}`,
        exam.classroom ? `LOCATION:${escapeIcalText(exam.classroom)}` : '',
        desc ? `DESCRIPTION:${escapeIcalText(desc)}` : '',
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Domani hai l'esame di ${escapeIcalText(exam.name || '')}!`,
        'END:VALARM',
        'END:VEVENT'
      );
    });
  }

  // 3. SCADENZE & CONSEGNE
  if (options.includeDeadlines && Array.isArray(deadlines)) {
    deadlines.forEach((d, idx) => {
      if (!d.date || d.completed) return;
      const deadDate = new Date(d.date);
      if (isNaN(deadDate.getTime())) return;

      const dtStart = new Date(deadDate);
      dtStart.setHours(18, 0, 0, 0);
      const dtEnd = new Date(deadDate);
      dtEnd.setHours(19, 0, 0, 0);

      const summary = `⏳ Scadenza: ${d.title || 'Consegna'}`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:deadline_${d.id || idx}_${dtStart.getTime()}@uniplanner.it`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatIcalDateTime(dtStart)}`,
        `DTEND:${formatIcalDateTime(dtEnd)}`,
        `SUMMARY:${escapeIcalText(summary)}`,
        `DESCRIPTION:Scadenza UniPlanner: ${escapeIcalText(d.title || '')}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT2H',
        'ACTION:DISPLAY',
        `DESCRIPTION:Promemoria Scadenza: ${escapeIcalText(d.title || '')}`,
        'END:VALARM',
        'END:VEVENT'
      );
    });
  }

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

/**
 * Scarica il file .ics direttamente nel browser dell'utente
 */
export function downloadIcsFile(data) {
  const icsString = generateIcsString(data);
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'uniplanner-orario.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Restituisce i link di iscrizione live (WebCal, Google Calendar, HTTPS)
 */
export function getLiveCalendarUrls(friendCode) {
  if (!friendCode) return { httpsUrl: '', webcalUrl: '', googleCalendarUrl: '' };

  const cleanCode = encodeURIComponent(friendCode.trim().toUpperCase());
  
  // Utilizziamo il dominio di produzione Vercel che evita qualsiasi blocco/warning di Ngrok
  const baseUrl = typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
    ? window.location.origin
    : 'https://uniplanner-web-app.vercel.app';

  const httpsUrl = `${baseUrl}/api/calendar?code=${cleanCode}`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://');
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(httpsUrl)}`;

  return { httpsUrl, webcalUrl, googleCalendarUrl };
}
