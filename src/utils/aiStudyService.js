import { apiFetch } from './cloudSync';

const PROMPT_INSTRUCTIONS = `
Sei un Professore Universitario ed esaminatore accademico di altissimo livello.
Analizza il seguente materiale didattico ed elabora un KIT D'ESAME RIGOROSO E COMPLETO.

DEVI RESTITUIRE ESCLUSIVAMENTE UN JSON VALIDO (senza markdown aggiuntivo, senza blocchi di codice non richiesti, solo JSON grezzo) con questa esatta struttura:

{
  "subject": "Nome Materia / Argomento Principale",
  "summary": "Sintesi strategica in 3-4 frasi dei concetti chiave fondamentali per l'esame",
  "quizzes": [
    {
      "id": 1,
      "question": "Testo chiaro della domanda d'esame",
      "options": [
        "Opzione A",
        "Opzione B",
        "Opzione C",
        "Opzione D"
      ],
      "correctIndex": 0,
      "explanation": "Spiegazione chiara e approfondita del perché questa risposta è corretta"
    }
  ],
  "flashcards": [
    {
      "id": 1,
      "front": "Concetto, formula o data",
      "back": "Definizione rigorosa o applicazione sintetica",
      "category": "Teoria / Formule / Definizioni"
    }
  ],
  "oralQuestions": [
    {
      "id": 1,
      "question": "Domanda classica e insidiosa posta dai docenti all'orale",
      "idealAnswer": "Risposta modello strutturata da 30 e Lode",
      "trapTip": "Il trabocchetto comune degli studenti da evitare"
    }
  ]
}

REGOLE TASSATIVE:
1. Genera ESATTAMENTE 20 domande a risposta multipla ('quizzes').
2. Genera tra 12 e 18 'flashcards'.
3. Genera ESATTAMENTE 5 'oralQuestions'.
4. 'correctIndex' deve essere un numero intero da 0 a 3.
5. Lingua: ITALIANO formale universitario.

MATERIALE DIDATTICO:
`;

const FLASH_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

/**
 * Esegue una chiamata a Google Gemini Flash con fallback a cascata e auto-healing
 */
async function callGeminiFlash(apiKey, payloadBuilder) {
  const cleanKey = (apiKey || '').trim();
  const modelQueue = [...FLASH_MODELS];
  const tried = new Set();
  let lastError = '';

  while (modelQueue.length > 0) {
    const currentModel = modelQueue.shift();
    if (tried.has(currentModel)) continue;
    tried.add(currentModel);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBuilder())
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, model: currentModel, data };
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error?.message || `Status ${res.status}`;
        lastError = msg;

        // Auto-adattamento se Google suggerisce un modello
        const match = msg.match(/models\/([a-zA-Z0-9\.\-_]+)/);
        if (match && match[1] && !tried.has(match[1])) {
          modelQueue.unshift(match[1]);
        }
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  return { success: false, error: lastError };
}

/**
 * Testa la connessione con Google Gemini Flash
 */
export async function testGeminiApiKey(apiKey = '') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey || cleanKey.length < 10) {
    return { valid: false, message: 'Inserisci prima la tua chiave API di Google Gemini.' };
  }

  const result = await callGeminiFlash(cleanKey, () => ({
    contents: [{ parts: [{ text: 'Rispondi solo con: OK' }] }]
  }));

  if (result.success) {
    return {
      valid: true,
      message: `Connessione a Google Gemini Flash verificata con successo! 🚀`,
      activeModel: result.model
    };
  }

  return {
    valid: false,
    message: `Errore Google API: ${result.error || 'Chiave non valida o scaduta.'}`
  };
}

/**
 * Genera il kit di studio completo tramite Google Gemini Flash
 */
export async function generateStudyKit(rawText, options = {}) {
  if (!rawText || rawText.trim().length < 40) {
    throw new Error('Il testo inserito è troppo breve. Incolla almeno qualche paragrafo di appunti o carica un PDF.');
  }

  const trimmedText = rawText.slice(0, 100000);
  const apiKey = (options.apiKey || localStorage.getItem('uniplanner_gemini_api_key') || '').trim();

  if (!apiKey) {
    throw new Error('Nessuna chiave API Google Gemini configurata. Inserisci la tua chiave gratuita nelle impostazioni.');
  }

  const result = await callGeminiFlash(apiKey, () => ({
    contents: [{ parts: [{ text: PROMPT_INSTRUCTIONS + '\n\n' + trimmedText }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 8192
    }
  }));

  if (result.success) {
    const rawJsonText = result.data.candidates?.[0]?.content?.parts?.[0]?.text;
    return parseAiJsonResponse(rawJsonText);
  }

  throw new Error(`Errore durante la generazione Google Gemini: ${result.error || 'Verifica la connessione.'}`);
}

/**
 * Parsing e pulizia sicura del JSON restituito dall'AI
 */
function parseAiJsonResponse(rawString) {
  if (!rawString) throw new Error('Risposta vuota da parte di Google Gemini.');

  let clean = rawString.trim();

  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(clean);
    return {
      subject: parsed.subject || 'Materia Esame',
      summary: parsed.summary || 'Sintesi strategica dei concetti chiave.',
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
      oralQuestions: Array.isArray(parsed.oralQuestions) ? parsed.oralQuestions : []
    };
  } catch (parseError) {
    console.error('Errore parsing JSON Gemini:', parseError, rawString);
    throw new Error('Il modello ha generato una risposta non standard. Riprova con un testo leggermente più sintetico.');
  }
}
