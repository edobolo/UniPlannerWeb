import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { safeJsonParse } from './security';

const LESSON_CHANNEL_ID = 'uniplanner_lessons_channel';
const DEADLINE_CHANNEL_ID = 'uniplanner_deadlines_channel';

/**
 * Inizializza i canali di notifica nativi e richiede i permessi all'utente
 */
export async function initNativeNotifications() {
  if (!Capacitor.isNativePlatform()) {
    console.log('[NativeNotifications] Web platform: skipping native notification init');
    return false;
  }

  try {
    // 1. Controlla e richiedi i permessi (Android 13+ POST_NOTIFICATIONS)
    let permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      permStatus = await LocalNotifications.requestPermissions();
    }

    if (permStatus.display !== 'granted') {
      console.warn('[NativeNotifications] Permesso notifiche non concesso');
      return false;
    }

    // 2. Crea i canali di notifica su Android (Heads-up alert & suono prioritario)
    await LocalNotifications.createChannel({
      id: LESSON_CHANNEL_ID,
      name: 'Promemoria Lezioni (15 min prima)',
      description: 'Notifiche intelligenti prima dell\'inizio delle lezioni universitarie',
      importance: 5, // MAX importance (Heads-up banner & sound)
      visibility: 1, // Public on lockscreen
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#3b82f6'
    });

    await LocalNotifications.createChannel({
      id: DEADLINE_CHANNEL_ID,
      name: 'Scadenze & Appelli Esami (24 ore prima)',
      description: 'Avvisi per chiusura iscrizioni appelli e consegne importanti',
      importance: 5,
      visibility: 1,
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#f59e0b'
    });

    console.log('✅ [NativeNotifications] Canali Android inizializzati con successo!');
    return true;
  } catch (err) {
    console.error('[NativeNotifications] Errore inizializzazione notifiche:', err);
    return false;
  }
}

/**
 * Programma le notifiche per le lezioni universitarie (15 minuti prima)
 * Rispetta le date di inizio lezioni effettive evitando avvisi fuori periodo
 */
export async function scheduleLessonAlerts(scheduleList) {
  if (!Capacitor.isNativePlatform() || !Array.isArray(scheduleList)) return;

  try {
    const notificationsToSchedule = [];
    const now = new Date();
    const nowMs = now.getTime();
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Lunedì, 6 = Domenica

    // 1. Cancella TUTTE le notifiche di lezione pendenti (IDs 1000 - 1999)
    try {
      const pending = await LocalNotifications.getPending();
      if (pending && Array.isArray(pending.notifications)) {
        const lessonPendingIds = pending.notifications
          .filter(n => n.id >= 1000 && n.id < 2000)
          .map(n => ({ id: n.id }));

        if (lessonPendingIds.length > 0) {
          await LocalNotifications.cancel({ notifications: lessonPendingIds });
        }
      }
    } catch (cancelErr) {
      console.warn('[NativeNotifications] Warning cancellazione notifiche pregresse:', cancelErr);
    }

    let notifIdCounter = 1000;

    for (const item of scheduleList) {
      if (!item) continue;
      const rawTime = item.startTime || (item.time ? item.time.split(' - ')[0] : '09:00');
      const [hours, minutes] = rawTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;

      // Caso A: La lezione ha una data specifica (es. 2026-09-28)
      if (item.isSpecificDate || (item.date && item.date.length >= 10)) {
        const [y, m, d] = item.date.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const specificLessonDate = new Date(y, m - 1, d, hours, minutes, 0, 0);
          const alertTime = new Date(specificLessonDate.getTime() - 15 * 60 * 1000);

          // Pianifica SOLO se la data è futura di almeno 2 minuti rispetto ad ora
          if (alertTime.getTime() > nowMs + 120000) {
            const roomText = item.room ? ` in Aula ${item.room}` : '';
            const profText = item.professor ? ` (${item.professor})` : '';

            notificationsToSchedule.push({
              id: notifIdCounter++,
              title: `🏃‍♂️ Tra 15 min: ${item.subject || 'Lezione'}`,
              body: `Lezione alle ${rawTime}${roomText}${profText}. Preparati!`,
              schedule: { at: alertTime, allowWhileIdle: true },
              channelId: LESSON_CHANNEL_ID,
              extra: { type: 'lesson', subject: item.subject }
            });
          }
        }
        continue;
      }

      // Caso B: Orario settimanale ricorrente (senza data specifica)
      let targetDayIndex = 0;
      if (item.dayIndex !== undefined && typeof item.dayIndex === 'number') {
        targetDayIndex = item.dayIndex;
      } else {
        const dayStr = String(item.day || '').toLowerCase();
        if (dayStr.includes('lun')) targetDayIndex = 0;
        else if (dayStr.includes('mar')) targetDayIndex = 1;
        else if (dayStr.includes('mer')) targetDayIndex = 2;
        else if (dayStr.includes('gio')) targetDayIndex = 3;
        else if (dayStr.includes('ven')) targetDayIndex = 4;
        else if (dayStr.includes('sab')) targetDayIndex = 5;
        else if (dayStr.includes('dom')) targetDayIndex = 6;
      }

      // Programma per i prossimi 7 giorni (settimana corrente / successiva)
      const daysUntil = (targetDayIndex - currentDayOfWeek + 7) % 7;
      const scheduleDate = new Date();
      scheduleDate.setDate(now.getDate() + daysUntil);
      scheduleDate.setHours(hours, minutes, 0, 0);

      const alertTime = new Date(scheduleDate.getTime() - 15 * 60 * 1000);

      // Pianifica solo se la lezione è nel futuro di almeno 2 minuti (evita trigger a raffica)
      if (alertTime.getTime() > nowMs + 120000) {
        const roomText = item.room ? ` in Aula ${item.room}` : '';
        const profText = item.professor ? ` (${item.professor})` : '';

        notificationsToSchedule.push({
          id: notifIdCounter++,
          title: `🏃‍♂️ Tra 15 min: ${item.subject || 'Lezione'}`,
          body: `Lezione alle ${rawTime}${roomText}${profText}. Preparati!`,
          schedule: { at: alertTime, allowWhileIdle: true },
          channelId: LESSON_CHANNEL_ID,
          extra: { type: 'lesson', subject: item.subject }
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      // Limita a max 30 notifiche per evitare spam del sistema operativo
      const batch = notificationsToSchedule.slice(0, 30);
      await LocalNotifications.schedule({ notifications: batch });
      console.log(`✅ [NativeNotifications] Programmati ${batch.length} promemoria lezioni!`);
    }
  } catch (err) {
    console.error('[NativeNotifications] Errore programmazione lezioni:', err);
  }
}

/**
 * Programma gli avvisi per appelli e scadenze (24 ore prima)
 */
export async function scheduleDeadlineAlerts(deadlinesList, examsList) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const notificationsToSchedule = [];
    const now = new Date();
    const nowMs = now.getTime();

    // Elimina vecchi allarmi scadenze (IDs 2000 - 2999)
    try {
      const pending = await LocalNotifications.getPending();
      if (pending && Array.isArray(pending.notifications)) {
        const deadlinePendingIds = pending.notifications
          .filter(n => n.id >= 2000 && n.id < 3000)
          .map(n => ({ id: n.id }));

        if (deadlinePendingIds.length > 0) {
          await LocalNotifications.cancel({ notifications: deadlinePendingIds });
        }
      }
    } catch (cancelErr) {
      console.warn('[NativeNotifications] Warning cancellazione scadenze:', cancelErr);
    }

    let notifIdCounter = 2000;

    // 1. Scadenze da Deadlines
    if (Array.isArray(deadlinesList)) {
      for (const dl of deadlinesList) {
        if (!dl || !dl.date) continue;
        const targetDate = new Date(dl.date);
        if (isNaN(targetDate.getTime())) continue;

        // 24 ore prima (alle 09:00 del giorno precedente)
        const alertDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
        alertDate.setHours(9, 0, 0, 0);

        if (alertDate.getTime() > nowMs + 120000) {
          notificationsToSchedule.push({
            id: notifIdCounter++,
            title: `⚠️ Domani Scadenza: ${dl.title || 'Promemoria'}`,
            body: `Tag: ${dl.tag || 'Università'}. Ricordati di completare l'attività!`,
            schedule: { at: alertDate, allowWhileIdle: true },
            channelId: DEADLINE_CHANNEL_ID,
            extra: { type: 'deadline', id: dl.id }
          });
        }
      }
    }

    // 2. Appelli Esami programmati
    if (Array.isArray(examsList)) {
      for (const ex of examsList) {
        if (!ex || !ex.date || ex.grade) continue;
        const examDate = new Date(ex.date);
        if (isNaN(examDate.getTime())) continue;

        // Avviso 48h prima
        const alert48h = new Date(examDate.getTime() - 48 * 60 * 60 * 1000);
        alert48h.setHours(10, 0, 0, 0);

        if (alert48h.getTime() > nowMs + 120000) {
          notificationsToSchedule.push({
            id: notifIdCounter++,
            title: `📚 Mancano 2 giorni all'appello di ${ex.name}`,
            body: `Appello previsto per il ${ex.date}. Controlla iscrizioni e materiale!`,
            schedule: { at: alert48h, allowWhileIdle: true },
            channelId: DEADLINE_CHANNEL_ID,
            extra: { type: 'exam', id: ex.id }
          });
        }
      }
    }

    if (notificationsToSchedule.length > 0) {
      const batch = notificationsToSchedule.slice(0, 30);
      await LocalNotifications.schedule({ notifications: batch });
      console.log(`✅ [NativeNotifications] Programmati ${batch.length} promemoria scadenze/esami!`);
    }
  } catch (err) {
    console.error('[NativeNotifications] Errore programmazione scadenze:', err);
  }
}

/**
 * Sincronizza tutti gli allarmi nativi leggendo da localStorage
 */
export async function syncAllNativeAlerts() {
  if (!Capacitor.isNativePlatform()) return;

  const schedule = safeJsonParse(localStorage.getItem('uniplanner_schedule_v1'), []);
  const deadlines = safeJsonParse(localStorage.getItem('uniplanner_deadlines'), []);
  const exams = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);

  await scheduleLessonAlerts(schedule);
  await scheduleDeadlineAlerts(deadlines, exams);
}
