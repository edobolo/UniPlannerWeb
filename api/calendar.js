export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const queryCode = req.query.code || req.query.friendCode || req.query.id || '';
  const code = String(queryCode).replace(/\.ics$/i, '').toUpperCase().trim();

  if (!code) {
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.status(200).send('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UniPlanner//IT\r\nX-WR-CALNAME:UniPlanner\r\nEND:VCALENDAR');
  }

  try {
    const backendRes = await fetch(`https://shabby-myself-gleeful.ngrok-free.dev/api/calendar/${code}.ics`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });

    if (backendRes.ok) {
      const icsData = await backendRes.text();
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="uniplanner.ics"');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).send(icsData);
    }
  } catch (err) {
    console.error('Errore proxy calendar Raspberry Pi:', err);
  }

  // Fallback iCal se il Raspberry Pi è offline
  const fallbackIcs = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniPlanner//IT//UniPlanner Web//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:UniPlanner (${code})`,
    'X-WR-TIMEZONE:Europe/Rome',
    'X-WR-CALDESC:Sincronizzazione orario UniPlanner',
    'END:VCALENDAR'
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="uniplanner.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(fallbackIcs);
}
