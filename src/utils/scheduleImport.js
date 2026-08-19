import * as XLSX from 'xlsx';
import { sanitizeText } from './security';

const PRESET_COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#60a5fa', '#10b981', '#f97316',
  '#06b6d4', '#e879f9', '#4ade80', '#facc15', '#f87171'
];

/**
 * Universal University Schedule Parser
 * Supports any Italian and international university export format (.xls, .xlsx, .csv, .ics)
 * (Esse3, Cineca, Polimi, UniMi, UniPd, UniTo, Sapienza, UniFi, Bocconi, Luiss, etc.)
 */
export const parseScheduleExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Il file caricato non contiene fogli di calcolo.');
        }

        // Take the first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays (raw rows)
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawRows || rawRows.length === 0) {
          throw new Error('Il file caricato è vuoto.');
        }

        // Clean HTML tags and excessive whitespace across all raw cells
        const cleanedRows = rawRows.map(row => {
          if (!Array.isArray(row)) return [];
          return row.map(cell => cleanCellHtml(cell));
        });

        // 1. Detect layout: Tabular (row per lecture) vs Grid (Days in columns, Hours in rows)
        const isGrid = detectGridLayout(cleanedRows);

        let parsedResult = null;
        if (isGrid) {
          parsedResult = parseGridSchedule(cleanedRows);
        } else {
          parsedResult = parseTabularSchedule(cleanedRows);
        }

        if (!parsedResult || parsedResult.lessons.length === 0) {
          throw new Error('Nessuna lezione valida trovata nel file. Verifica che il file contenga orari, date e materie.');
        }

        resolve(parsedResult);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Errore durante la lettura del file Excel/CSV.'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Tabular Layout Parser (Standard row-per-lecture format)
 */
function parseTabularSchedule(rawRows) {
  // Find the header row by analyzing headers and scoring column types
  let headerRowIndex = 0;
  let maxHeaderScore = -1;

  for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    let score = 0;
    const lowerRow = row.map(c => String(c).trim().toLowerCase());
    
    if (lowerRow.some(c => c.includes('giorno') || c.includes('data') || c === 'date' || c === 'day')) score += 3;
    if (lowerRow.some(c => c.includes('ora') || c.includes('orario') || c.includes('time') || c.includes('fascia'))) score += 3;
    if (lowerRow.some(c => c.includes('insegnamento') || c.includes('materia') || c.includes('corso') || c.includes('subject') || c.includes('modulo') || c.includes('attività'))) score += 3;
    if (lowerRow.some(c => c.includes('docente') || c.includes('prof') || c.includes('teacher') || c.includes('titolare'))) score += 2;
    if (lowerRow.some(c => c.includes('aula') || c.includes('sede') || c.includes('edificio') || c.includes('luogo') || c.includes('ubicazione') || c.includes('room') || c.includes('spazio'))) score += 2;

    if (score > maxHeaderScore) {
      maxHeaderScore = score;
      headerRowIndex = r;
    }
  }

  const headerRow = rawRows[headerRowIndex].map(c => String(c).trim().toLowerCase());
  const maxCols = Math.max(...rawRows.map(r => r.length));

  // Build semantic column mapping using both headers and sample data rows
  const colMap = resolveSemanticColumns(headerRow, rawRows.slice(headerRowIndex + 1, headerRowIndex + 15), maxCols);

  const parsedLessons = [];
  const subjectColorMap = new Map();
  let colorIdx = 0;
  const seenSlots = new Set();
  let earliestDate = null;
  let latestDate = null;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawDay = colMap.day !== -1 ? row[colMap.day] : '';
    const rawTime = colMap.time !== -1 ? String(row[colMap.time] || '').trim() : '';
    const rawSubject = colMap.subject !== -1 ? String(row[colMap.subject] || '').trim() : '';
    const rawProf = colMap.professor !== -1 ? String(row[colMap.professor] || '').trim() : '';
    const rawRoom = colMap.room !== -1 ? String(row[colMap.room] || '').trim() : '';

    if (!rawSubject || (!rawDay && !rawTime)) continue;

    // Parse date & dayIndex (0 = Lun, ..., 6 = Dom)
    const dateInfo = parseDateString(rawDay);
    if (!dateInfo) continue;

    // Parse start and end time
    const timeRange = parseTimeRange(rawTime);
    if (!timeRange) continue;

    // Extract classroom cleanly (checking dedicated column, then inspecting all row cells)
    const cleanRoom = extractCleanRoom(rawRoom, row, colMap);

    // Clean strings
    const cleanSubject = sanitizeSubjectString(rawSubject);
    const cleanProf = sanitizeProfessorString(rawProf);

    if (!cleanSubject) continue;

    // Unique slot key to avoid duplicates
    const slotKey = `${dateInfo.dateStr || dateInfo.dayIndex}_${timeRange.startTime}_${timeRange.endTime}_${cleanSubject.toLowerCase()}`;
    if (seenSlots.has(slotKey)) continue;
    seenSlots.add(slotKey);

    // Track date boundaries
    if (dateInfo.dateStr) {
      if (!earliestDate || dateInfo.dateStr < earliestDate) earliestDate = dateInfo.dateStr;
      if (!latestDate || dateInfo.dateStr > latestDate) latestDate = dateInfo.dateStr;
    }

    if (!subjectColorMap.has(cleanSubject)) {
      subjectColorMap.set(cleanSubject, PRESET_COLORS[colorIdx % PRESET_COLORS.length]);
      colorIdx++;
    }

    parsedLessons.push({
      id: `les_imp_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
      subject: cleanSubject,
      professor: cleanProf,
      room: cleanRoom,
      date: dateInfo.dateStr,
      dayIndex: dateInfo.dayIndex,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      color: subjectColorMap.get(cleanSubject)
    });
  }

  // Sort lessons chronologically
  parsedLessons.sort((a, b) => {
    if (a.date && b.date) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
    } else if (a.dayIndex !== b.dayIndex) {
      return a.dayIndex - b.dayIndex;
    }
    return a.startTime.localeCompare(b.startTime);
  });

  return {
    lessons: parsedLessons,
    firstDate: earliestDate,
    lastDate: latestDate,
    totalCount: parsedLessons.length,
    uniqueSubjects: Array.from(subjectColorMap.keys())
  };
}

/**
 * Matrix / Grid Layout Parser (When Days are Columns, and Time is in rows)
 */
function parseGridSchedule(rawRows) {
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r].map(c => String(c).trim().toLowerCase());
    const dayMatches = row.filter(c => parseDayName(c) !== null);
    if (dayMatches.length >= 3) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = rawRows[headerRowIndex].map(c => String(c).trim().toLowerCase());
  const dayColMap = [];

  headerRow.forEach((colHeader, colIdx) => {
    const dayIdx = parseDayName(colHeader);
    if (dayIdx !== null) {
      dayColMap.push({ colIdx, dayIndex: dayIdx });
    }
  });

  // Time column is usually col 0 or 1
  let timeColIdx = headerRow.findIndex(c => c.includes('ora') || c.includes('time') || c.includes('fascia'));
  if (timeColIdx === -1) timeColIdx = 0;

  const parsedLessons = [];
  const subjectColorMap = new Map();
  let colorIdx = 0;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const timeRange = parseTimeRange(String(row[timeColIdx] || ''));
    if (!timeRange) continue;

    dayColMap.forEach(({ colIdx, dayIndex }) => {
      const cellVal = String(row[colIdx] || '').trim();
      if (!cellVal || cellVal.length < 2) return;

      const details = parseLessonCellDetails(cellVal);
      if (!details.subject) return;

      if (!subjectColorMap.has(details.subject)) {
        subjectColorMap.set(details.subject, PRESET_COLORS[colorIdx % PRESET_COLORS.length]);
        colorIdx++;
      }

      parsedLessons.push({
        id: `les_grid_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
        subject: details.subject,
        professor: details.professor,
        room: details.room,
        date: null,
        dayIndex,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        color: subjectColorMap.get(details.subject)
      });
    });
  }

  return {
    lessons: parsedLessons,
    firstDate: null,
    lastDate: null,
    totalCount: parsedLessons.length,
    uniqueSubjects: Array.from(subjectColorMap.keys())
  };
}

/**
 * Intelligent Semantic Column Resolver (Probabilistic multi-column matching)
 */
function resolveSemanticColumns(headerRow, sampleRows, maxCols) {
  const scores = Array.from({ length: maxCols }, () => ({
    day: 0,
    time: 0,
    subject: 0,
    professor: 0,
    room: 0,
    track: 0
  }));

  // Score based on header text
  headerRow.forEach((hdr, idx) => {
    if (!hdr) return;
    if (hdr.includes('giorno') || hdr.includes('data') || hdr === 'date' || hdr === 'day') scores[idx].day += 80;
    if (hdr.includes('ora') || hdr.includes('orario') || hdr.includes('time') || hdr.includes('fascia')) scores[idx].time += 80;
    if (hdr.includes('insegnamento') || hdr.includes('materia') || hdr.includes('corso') || hdr.includes('subject') || hdr.includes('modulo')) scores[idx].subject += 80;
    if (hdr.includes('docente') || hdr.includes('prof') || hdr.includes('teacher') || hdr.includes('titolare')) scores[idx].professor += 80;
    
    // Explicit classroom/location headers
    if (
      hdr.includes('aula') || hdr.includes('sede') || hdr.includes('edificio') || 
      hdr.includes('luogo') || hdr.includes('ubicazione') || hdr.includes('spazio') || 
      hdr.includes('polo') || hdr.includes('stanza') || hdr.includes('room') || 
      hdr.includes('location') || hdr.includes('plesso')
    ) {
      scores[idx].room += 95; // Highest priority for room
    }

    if (hdr.includes('percorso') || hdr.includes('laurea') || hdr.includes('cdl') || hdr.includes('curriculum')) {
      scores[idx].track += 70;
    }
  });

  // Score based on sample data rows
  sampleRows.forEach(row => {
    row.forEach((cell, idx) => {
      if (idx >= maxCols) return;
      const str = String(cell || '').trim();
      if (!str) return;

      // Date pattern test
      if (parseDateString(str) !== null) scores[idx].day += 15;
      // Time pattern test
      if (parseTimeRange(str) !== null) scores[idx].time += 15;
      // Room keywords test (e.g. "H3 [HUB]", "Aula 3", "Lab. 1")
      if (/^(?:[a-zA-Z]\d{1,3}\b|aula|lab|edificio|polo|stanza|room|\[hub\]|\[edificio)/i.test(str) || /\[(?:hub|edificio|polo|aula)[^\]]*\]/i.test(str)) {
        scores[idx].room += 15;
      }
      // Degree track keywords test
      if (str.toLowerCase().includes('laurea') || str.toLowerCase().includes('corso di laurea') || str.includes('[IN') || str.includes('canale')) {
        scores[idx].track += 15;
      }
    });
  });

  // Pick highest scoring column for each attribute
  const colMap = {
    day: getBestColumn(scores, 'day', []),
    time: -1,
    subject: -1,
    professor: -1,
    room: -1
  };

  colMap.time = getBestColumn(scores, 'time', [colMap.day]);
  colMap.room = getBestColumn(scores, 'room', [colMap.day, colMap.time]);
  colMap.professor = getBestColumn(scores, 'professor', [colMap.day, colMap.time, colMap.room]);
  colMap.subject = getBestColumn(scores, 'subject', [colMap.day, colMap.time, colMap.room, colMap.professor]);

  // Fallbacks if columns were not found
  if (colMap.day === -1) colMap.day = 0;
  if (colMap.time === -1) colMap.time = 1;
  if (colMap.subject === -1) colMap.subject = 2;
  if (colMap.professor === -1) colMap.professor = 3;
  if (colMap.room === -1) colMap.room = 5 < maxCols ? 5 : (4 < maxCols ? 4 : -1);

  return colMap;
}

function getBestColumn(scores, key, excludedIndices) {
  let bestIdx = -1;
  let bestScore = 0;
  scores.forEach((col, idx) => {
    if (excludedIndices.includes(idx)) return;
    if (col[key] > bestScore) {
      bestScore = col[key];
      bestIdx = idx;
    }
  });
  return bestScore >= 10 ? bestIdx : -1;
}

/**
 * Parse standard iCalendar (.ics) format with recurring rule expansion
 */
export const parseScheduleICS = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n|\r/);
        
        const rawEvents = [];
        let inEvent = false;
        let currentEvent = {};

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          
          // Folded lines handling
          while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
            line += lines[i + 1].slice(1);
            i++;
          }

          if (line.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            currentEvent = {};
          } else if (line.startsWith('END:VEVENT')) {
            if (inEvent && currentEvent.summary && currentEvent.dtstart) {
              rawEvents.push(currentEvent);
            }
            inEvent = false;
          } else if (inEvent) {
            const separatorIdx = line.indexOf(':');
            if (separatorIdx !== -1) {
              const rawKey = line.substring(0, separatorIdx);
              const val = line.substring(separatorIdx + 1).trim();
              const key = rawKey.split(';')[0].toUpperCase();

              if (key === 'SUMMARY') currentEvent.summary = val;
              else if (key === 'LOCATION') currentEvent.location = val;
              else if (key === 'DESCRIPTION') currentEvent.description = val;
              else if (key === 'DTSTART') currentEvent.dtstart = val;
              else if (key === 'DTEND') currentEvent.dtend = val;
              else if (key === 'RRULE') currentEvent.rrule = val;
            }
          }
        }

        if (rawEvents.length === 0) {
          throw new Error('Nessun evento o lezione trovata nel file .ics');
        }

        const parsedLessons = [];
        const seenSlots = new Set();
        const subjectColorMap = new Map();
        let colorIdx = 0;
        let earliestDate = null;
        let latestDate = null;

        for (const ev of rawEvents) {
          const parsedStart = parseICSDateTime(ev.dtstart);
          const parsedEnd = ev.dtend ? parseICSDateTime(ev.dtend) : null;

          if (!parsedStart) continue;

          const cleanSubject = sanitizeSubjectString(ev.summary);
          let cleanRoom = sanitizeRoomString(ev.location || '');
          let cleanProf = sanitizeProfessorString(ev.description || '');

          // Check if description has explicit Room or Prof tag
          if (!cleanRoom && ev.description) {
            const roomMatch = ev.description.match(/(?:aula|sede|luogo|edificio|polo|room|stanza)[:\s]+([^\r\n,;]+)/i);
            if (roomMatch) cleanRoom = sanitizeRoomString(roomMatch[1]);
          }

          if (!subjectColorMap.has(cleanSubject)) {
            subjectColorMap.set(cleanSubject, PRESET_COLORS[colorIdx % PRESET_COLORS.length]);
            colorIdx++;
          }
          const color = subjectColorMap.get(cleanSubject);

          const startTime = parsedStart.timeStr;
          const endTime = parsedEnd ? parsedEnd.timeStr : addHoursToTimeStr(startTime, 2);

          // Handle RRULE
          if (ev.rrule && ev.rrule.includes('FREQ=WEEKLY')) {
            let repeatCount = 14;
            const countMatch = ev.rrule.match(/COUNT=(\d+)/);
            if (countMatch) repeatCount = parseInt(countMatch[1], 10);

            let untilDate = null;
            const untilMatch = ev.rrule.match(/UNTIL=([0-9T]+)/);
            if (untilMatch) {
              const u = parseICSDateTime(untilMatch[1]);
              if (u) untilDate = u.dateStr;
            }

            for (let w = 0; w < repeatCount; w++) {
              const curDateObj = new Date(parsedStart.dateObj);
              curDateObj.setDate(parsedStart.dateObj.getDate() + (w * 7));
              
              const dateStr = formatDateToStr(curDateObj);
              if (untilDate && dateStr > untilDate) break;

              const dayIndex = curDateObj.getDay() === 0 ? 6 : curDateObj.getDay() - 1;
              const slotKey = `${dateStr}_${startTime}_${endTime}_${cleanSubject.toLowerCase()}`;
              if (seenSlots.has(slotKey)) continue;
              seenSlots.add(slotKey);

              if (!earliestDate || dateStr < earliestDate) earliestDate = dateStr;
              if (!latestDate || dateStr > latestDate) latestDate = dateStr;

              parsedLessons.push({
                id: `les_ics_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
                subject: cleanSubject,
                professor: cleanProf,
                room: cleanRoom,
                date: dateStr,
                dayIndex,
                startTime,
                endTime,
                color
              });
            }
          } else {
            const dateStr = parsedStart.dateStr;
            const dayIndex = parsedStart.dayIndex;
            const slotKey = `${dateStr}_${startTime}_${endTime}_${cleanSubject.toLowerCase()}`;
            if (seenSlots.has(slotKey)) continue;
            seenSlots.add(slotKey);

            if (dateStr) {
              if (!earliestDate || dateStr < earliestDate) earliestDate = dateStr;
              if (!latestDate || dateStr > latestDate) latestDate = dateStr;
            }

            parsedLessons.push({
              id: `les_ics_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
              subject: cleanSubject,
              professor: cleanProf,
              room: cleanRoom,
              date: dateStr,
              dayIndex,
              startTime,
              endTime,
              color
            });
          }
        }

        if (parsedLessons.length === 0) {
          throw new Error('Impossibile estrarre le lezioni dal file .ics.');
        }

        parsedLessons.sort((a, b) => {
          if (a.date && b.date) {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
          } else if (a.dayIndex !== b.dayIndex) {
            return a.dayIndex - b.dayIndex;
          }
          return a.startTime.localeCompare(b.startTime);
        });

        resolve({
          lessons: parsedLessons,
          firstDate: earliestDate,
          lastDate: latestDate,
          totalCount: parsedLessons.length,
          uniqueSubjects: Array.from(subjectColorMap.keys())
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Errore durante la lettura del file .ics.'));
    reader.readAsText(file);
  });
};

/**
 * Export current lessons into a standard .ics file for Google / Apple Calendar
 */
export const exportScheduleToICS = (lessons, semesterWeeks = 14) => {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() + diff);
  currentMonday.setHours(0, 0, 0, 0);

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniPlanner//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Orario Lezioni UniPlanner'
  ];

  lessons.forEach((l) => {
    let lessonDate;
    if (l.date) {
      const [y, m, d] = l.date.split('-').map(Number);
      lessonDate = new Date(y, m - 1, d);
    } else {
      lessonDate = new Date(currentMonday);
      lessonDate.setDate(currentMonday.getDate() + (l.dayIndex || 0));
    }

    const [startH, startM] = l.startTime.split(':').map(Number);
    const [endH, endM] = l.endTime.split(':').map(Number);

    const startDate = new Date(lessonDate);
    startDate.setHours(startH, startM, 0, 0);

    const endDate = new Date(lessonDate);
    endDate.setHours(endH, endM, 0, 0);

    const formatICSDate = (d) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${l.id}@uniplanner.app`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`
    );

    if (!l.date) {
      icsContent.push(`RRULE:FREQ=WEEKLY;COUNT=${semesterWeeks}`);
    }

    icsContent.push(
      `SUMMARY:${l.subject}`,
      `LOCATION:${l.room || ''}`,
      `DESCRIPTION:${l.professor ? 'Docente: ' + l.professor : ''}`,
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'orario_lezioni_uniplanner.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Calculate the week offset from today for a given target YYYY-MM-DD date
 */
export const calculateWeekOffset = (targetDateStr) => {
  if (!targetDateStr) return 0;
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  if (isNaN(targetDate.getTime())) return 0;
  
  const now = new Date();
  const currentDay = now.getDay();
  const currentDiff = (currentDay === 0 ? -6 : 1) - currentDay;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() + currentDiff);
  currentMonday.setHours(0, 0, 0, 0);

  const targetDay = targetDate.getDay();
  const targetDiff = (targetDay === 0 ? -6 : 1) - targetDay;
  const targetMonday = new Date(targetDate);
  targetMonday.setDate(targetDate.getDate() + targetDiff);
  targetMonday.setHours(0, 0, 0, 0);

  const diffTime = targetMonday.getTime() - currentMonday.getTime();
  const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks;
};

// --- Helper Functions & Sanitizers ---

function cleanCellHtml(val) {
  if (val === undefined || val === null) return '';
  let str = String(val);
  // Replace HTML line breaks with newlines
  str = str.replace(/<br\s*\/?>/gi, '\n');
  // Strip all other HTML tags
  str = str.replace(/<[^>]*>/g, '');
  // Unescape standard HTML entities
  str = str.replace(/&nbsp;/gi, ' ')
           .replace(/&amp;/gi, '&')
           .replace(/&lt;/gi, '<')
           .replace(/&gt;/gi, '>')
           .replace(/&quot;/gi, '"');
  return str.trim();
}

function detectGridLayout(rows) {
  if (!rows || rows.length < 2) return false;
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const row = rows[r].map(c => String(c).trim().toLowerCase());
    const dayMatches = row.filter(c => parseDayName(c) !== null);
    if (dayMatches.length >= 3) return true;
  }
  return false;
}

function parseDayName(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  if (s.includes('lun') || s.includes('mon')) return 0;
  if (s.includes('mar') || s.includes('tue')) return 1;
  if (s.includes('mer') || s.includes('wed')) return 2;
  if (s.includes('gio') || s.includes('thu')) return 3;
  if (s.includes('ven') || s.includes('fri')) return 4;
  if (s.includes('sab') || s.includes('sat')) return 5;
  if (s.includes('dom') || s.includes('sun')) return 6;
  return null;
}

function parseDateString(rawDay) {
  if (rawDay === undefined || rawDay === null || rawDay === '') return null;
  const s = String(rawDay).trim();

  // 1. Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const itMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (itMatch) {
    const day = parseInt(itMatch[1], 10);
    const month = parseInt(itMatch[2], 10);
    const year = parseInt(itMatch[3], 10);
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
      return { dateStr, dayIndex, dateObj: d };
    }
  }

  // 2. Match ISO: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
      return { dateStr, dayIndex, dateObj: d };
    }
  }

  // 3. Excel numeric date code (e.g. 46293)
  if (!isNaN(rawDay) && Number(rawDay) > 30000 && Number(rawDay) < 70000) {
    const parsedDate = XLSX.SSF.parse_date_code(Number(rawDay));
    if (parsedDate) {
      const year = parsedDate.y;
      const month = parsedDate.m;
      const day = parsedDate.d;
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
        return { dateStr, dayIndex, dateObj: d };
      }
    }
  }

  // 4. Text day name
  const dayIdx = parseDayName(s);
  if (dayIdx !== null) {
    return { dateStr: null, dayIndex: dayIdx, dateObj: null };
  }

  return null;
}

function parseTimeRange(rawTime) {
  if (!rawTime) return null;
  const s = String(rawTime).trim();

  // Match range: "16:30 - 18:30", "08.30-10.30", "16:30/18:30", "16:30 - 18:00"
  const match = s.match(/(\d{1,2})[:.](\d{2})\s*[-–/aA]\s*(\d{1,2})[:.](\d{2})/);
  if (match) {
    const startH = String(match[1]).padStart(2, '0');
    const startM = match[2];
    const endH = String(match[3]).padStart(2, '0');
    const endM = match[4];
    return {
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${endM}`
    };
  }

  // Single hour match: "16:30"
  const singleMatch = s.match(/(\d{1,2})[:.](\d{2})/);
  if (singleMatch) {
    const startH = String(singleMatch[1]).padStart(2, '0');
    const startM = singleMatch[2];
    const endH = String(Math.min(parseInt(startH, 10) + 2, 21)).padStart(2, '0');
    return {
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${startM}`
    };
  }

  return null;
}

function extractCleanRoom(rawRoom, row, colMap) {
  // 1. If explicit room cell value exists, sanitize and return
  if (rawRoom && rawRoom.trim()) {
    const direct = sanitizeRoomString(rawRoom);
    if (direct && !direct.toLowerCase().includes('corso di laurea')) {
      return direct;
    }
  }

  // 2. Scan all other columns in this row
  for (let c = 0; c < row.length; c++) {
    if (c === colMap.day || c === colMap.time || c === colMap.subject) continue;
    const val = String(row[c] || '').trim();
    if (!val) continue;

    // Pattern e.g. "H3 [HUB]", "Aula 3 [Edificio A]", "Polo Didattico"
    const roomMatch = val.match(/(?:aula|lab(?:oratorio)?|edificio|polo|stanza|settore|padiglione|palazzina|room)\b[^\r\n]*/i);
    if (roomMatch) {
      return sanitizeRoomString(roomMatch[0]);
    }

    // Bracketed hub pattern: e.g. "[HUB]", "[Edificio A]"
    const hubMatch = val.match(/[A-Z0-9]+\s*\[[^\]]+\]/);
    if (hubMatch) {
      return sanitizeRoomString(hubMatch[0]);
    }
  }

  return '';
}

function sanitizeSubjectString(str) {
  if (!str) return '';
  let clean = String(str).replace(/<[^>]*>/g, '').trim();
  clean = clean.replace(/\s+/g, ' ');
  return sanitizeText(clean, 60);
}

function sanitizeProfessorString(str) {
  if (!str) return '';
  let clean = String(str).replace(/<[^>]*>/g, '').trim();
  // Strip "Docente:" prefix if present
  clean = clean.replace(/^(?:docente|prof(?:essore)?|titolare)[:\s-]+/i, '');
  clean = clean.replace(/\s+/g, ' ');

  // If ALL UPPERCASE e.g. "PELLEGRINA LEONARDO", title-case nicely -> "Pellegrina Leonardo"
  if (clean === clean.toUpperCase() && clean.length > 3) {
    clean = clean.replace(/\b([A-Z])([A-Z]+)\b/g, (match, p1, p2) => p1 + p2.toLowerCase());
  }

  return sanitizeText(clean, 50);
}

function sanitizeRoomString(str) {
  if (!str) return '';
  let clean = String(str).replace(/<[^>]*>/g, '').trim();
  
  // Strip leading/trailing punctuation
  clean = clean.replace(/^[\s\-–:;,]+/, '').replace(/[\s\-–:;,]+$/, '');
  clean = clean.replace(/\s+/g, ' ');

  // If multi-line, take the line with the room code
  if (clean.includes('\n')) {
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
    const roomLine = lines.find(l => !l.toLowerCase().includes('corso di laurea') && !l.toLowerCase().includes('ingegneria'));
    if (roomLine) clean = roomLine;
  }

  return sanitizeText(clean, 40);
}

function parseLessonCellDetails(cellText) {
  // Parses a multi-attribute cell like "Algoritmi\nProf. Rossi\nAula 3"
  const lines = cellText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { subject: '', professor: '', room: '' };

  let subject = lines[0];
  let professor = '';
  let room = '';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(?:prof|docente)/i.test(line)) {
      professor = sanitizeProfessorString(line);
    } else if (/(?:aula|lab|edificio|polo|room|\[hub\])/i.test(line) || /^[a-z]\d{1,3}/i.test(line)) {
      room = sanitizeRoomString(line);
    } else if (!professor) {
      professor = sanitizeProfessorString(line);
    } else if (!room) {
      room = sanitizeRoomString(line);
    }
  }

  return {
    subject: sanitizeSubjectString(subject),
    professor,
    room
  };
}

function parseICSDateTime(icsDateStr) {
  if (!icsDateStr) return null;
  const clean = icsDateStr.replace(/[^0-9T]/g, '');
  if (clean.length < 8) return null;

  const y = parseInt(clean.substring(0, 4), 10);
  const m = parseInt(clean.substring(4, 6), 10);
  const d = parseInt(clean.substring(6, 8), 10);

  let hour = '09';
  let min = '00';

  if (clean.includes('T') && clean.length >= 13) {
    const timePart = clean.split('T')[1];
    hour = timePart.substring(0, 2);
    min = timePart.substring(2, 4);
  }

  const dateObj = new Date(y, m - 1, d);
  const dayIndex = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return {
    dateStr,
    dayIndex,
    timeStr: `${hour}:${min}`,
    dateObj
  };
}

function formatDateToStr(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addHoursToTimeStr(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const newH = Math.min(h + hours, 22);
  return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}


