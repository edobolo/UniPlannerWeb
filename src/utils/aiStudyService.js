import { apiFetch } from './cloudSync';

const PROMPT_TEMPLATE = `
Sei un Professore Universitario emerito ed esaminatore accademico di altissimo livello.
Il tuo compito è analizzare approfonditamente il seguente materiale didattico (appunti di lezione, slide, dispense o capitoli di libro) e creare un KIT DI PREPARAZIONE ESAME COMPLETO E RIGOROSO.

DEVI RESTITUIRE ESCLUSIVAMENTE UN OGGETTO JSON VALIDO (senza markdown aggiuntivo, senza blocchi di codice non richiesti, solo il JSON grezzo) con questa esatta struttura:

{
  "subject": "Titolo/Materia rilevata",
  "summary": "Sintesi strategica in 3-4 frasi dei concetti chiave da sapere per l'esame",
  "quizzes": [
    {
      "id": 1,
      "question": "Testo della domanda d'esame (precisa e accademica)",
      "options": [
        "Opzione A",
        "Opzione B",
        "Opzione C",
        "Opzione D"
      ],
      "correctIndex": 0,
      "explanation": "Spiegazione chiara del perché questa è corretta e perché le altre sono errate"
    }
  ],
  "flashcards": [
    {
      "id": 1,
      "front": "Concetto chiave / Formula / Principio / Data o Termine",
      "back": "Definizione rigorosa, significato o soluzione sintetica",
      "category": "Teoria / Formule / Definizioni"
    }
  ],
  "oralQuestions": [
    {
      "id": 1,
      "question": "Domanda insidiosa tipica dell'esame orale posta dai docenti",
      "idealAnswer": "Risposta modello strutturata 'da 30 e Lode' che dimostra padronanza",
      "trapTip": "Il trabocchetto del professore da evitare"
    }
  ]
}

REGOLE TASSATIVE:
1. Genera ESATTAMENTE 20 domande a risposta multipla ('quizzes') variegate per difficoltà (da base ad avanzate).
2. Genera tra 12 e 20 'flashcards' ideali per memorizzazione rapida a ripetizione spaziata.
3. Genera ESATTAMENTE 5 'oralQuestions' focalizzate sui collegamenti concettuali tipici degli esami orali.
4. 'correctIndex' deve essere un numero intero da 0 a 3 corrispondente all'indice corretto in 'options'.
5. Rispondi in lingua ITALIANA formale e universitaria.

TESTO DEL MATERIALE DIDATTICO:
`;

/**
 * Genera il kit di studio completo via AI
 * @param {string} rawText - Testo estratto da PDF o incollato dallo studente
 * @param {string} customApiKey - Chiave API opzionale dell'utente (Google Gemini)
 * @returns {Promise<Object>} Kit di studio generato
 */
export async function generateStudyKit(rawText, customApiKey = '') {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Il testo fornito è troppo breve. Inserisci almeno qualche paragrafo di appunti o una dispensa.');
  }

  // Tronca se eccede la lunghezza massima supportata per singolo prompt (~80.000 caratteri)
  const trimmedText = rawText.slice(0, 80000);
  const userKey = customApiKey || localStorage.getItem('uniplanner_gemini_api_key') || '';

  // 1. Se l'utente ha configurato una chiave Gemini personale
  if (userKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${userKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT_TEMPLATE + '\n\n' + trimmedText }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json"
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Errore durante la chiamata a Gemini');
      }

      const generatedJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return parseAiJsonResponse(generatedJsonText);
    } catch (err) {
      console.warn('Chiamata diretta Gemini fallita, provo con il backend:', err);
    }
  }

  // 2. Chiamata al Backend Raspberry Pi / Cloud Proxy (Completamente gratuito)
  try {
    const res = await apiFetch('/ai/generate-study-material', {
      method: 'POST',
      body: JSON.stringify({
        text: trimmedText
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Errore generazione AI');
    }

    return data.studyKit;
  } catch (backendErr) {
    // 3. Fallback High-Availability Serverless gratuito (Pollinations AI / Free Open Router)
    try {
      const fallbackRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are an expert university professor. Always respond ONLY with valid raw JSON adhering strictly to the user requested schema.' },
            { role: 'user', content: PROMPT_TEMPLATE + '\n\n' + trimmedText }
          ],
          model: 'openai-large',
          jsonMode: true
        })
      });

      if (fallbackRes.ok) {
        const textRes = await fallbackRes.text();
        return parseAiJsonResponse(textRes);
      }
    } catch (fallbackErr) {
      console.error('Fallback AI fallito:', fallbackErr);
    }

    throw new Error('Impossibile completare la generazione AI. Verifica la connessione o inserisci una chiave Gemini gratuita nelle impostazioni.');
  }
}

/**
 * Parsing e pulizia sicura del JSON restituito dall'AI
 */
function parseAiJsonResponse(rawString) {
  if (!rawString) throw new Error('Risposta vuota da parte dell\'AI');

  let clean = rawString.trim();
  // Rimuovi eventuali ```json e ```
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(clean);
    // Validazione e sanitizzazione campi
    return {
      subject: parsed.subject || 'Materia Esame',
      summary: parsed.summary || 'Riassunto dei concetti chiave.',
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
      oralQuestions: Array.isArray(parsed.oralQuestions) ? parsed.oralQuestions : []
    };
  } catch (parseError) {
    console.error('Errore parsing JSON AI:', parseError, rawString);
    throw new Error('Il modello AI ha generato un formato non standard. Riprova con un testo leggermente più sintetico.');
  }
}
