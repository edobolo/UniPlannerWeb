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

export const GEMINI_MODEL_PRESETS = {
  flash: {
    id: 'flash',
    name: 'Gemini Flash (Predefinito & Consigliato)',
    badge: '100% Gratuito ⚡',
    desc: 'Velocissimo, gratuito per sempre con 1.500 generazioni al giorno da Google AI Studio. Ottimizzato per slide e dispense fino a 100 pagine.',
    models: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3.6-flash']
  },
  pro: {
    id: 'pro',
    name: 'Gemini Pro (Per Abbonati Google / Reasoning)',
    badge: 'Massima Precisione 🧠',
    desc: 'Ragionamento profondo per tomi da 500 pagine e materie complesse (Medicina, Giurisprudenza, Ingegneria). Per chiavi con piano Pay-as-you-go o abbonamento Google.',
    models: ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-2.0-pro-exp-02-05']
  }
};

/**
 * Testa la connessione con Google Gemini
 * @param {string} apiKey 
 * @param {string} modelType - 'flash' | 'pro'
 * @returns {Promise<{ valid: boolean, message: string, activeModel?: string }>}
 */
export async function testGeminiApiKey(apiKey = '', modelType = 'flash') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey || cleanKey.length < 10) {
    return { valid: false, message: 'Inserisci prima la tua chiave API di Google Gemini.' };
  }

  const preset = GEMINI_MODEL_PRESETS[modelType] || GEMINI_MODEL_PRESETS.flash;
  let lastGoogleError = '';

  for (const model of preset.models) {
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Rispondi solo con: OK' }] }]
        })
      });

      if (res.ok) {
        return { 
          valid: true, 
          message: `Connessione a Google ${model} verificata con successo! 🚀`, 
          activeModel: model 
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        lastGoogleError = errData.error?.message || `Status ${res.status}`;
      }
    } catch (e) {
      lastGoogleError = e.message;
    }
  }

  return { 
    valid: false, 
    message: `Errore Google API (${preset.name}): ${lastGoogleError || 'Verifica la chiave o se il modello è abilitato sul tuo account.'}` 
  };
}

/**
 * Genera il kit di studio completo tramite Google Gemini
 * @param {string} rawText - Testo estratto da PDF o incollato dallo studente
 * @param {Object} options - { apiKey, modelType }
 * @returns {Promise<Object>} Kit di studio generato
 */
export async function generateStudyKit(rawText, options = {}) {
  if (!rawText || rawText.trim().length < 40) {
    throw new Error('Il testo inserito è troppo breve. Incolla almeno qualche paragrafo di appunti o carica un PDF.');
  }

  const trimmedText = rawText.slice(0, 100000);
  const modelType = options.modelType || localStorage.getItem('uniplanner_ai_model_type') || 'flash';
  const apiKey = (options.apiKey || localStorage.getItem('uniplanner_gemini_api_key') || '').trim();

  if (!apiKey) {
    throw new Error('Nessuna chiave API Google Gemini configurata. Inserisci la tua chiave gratuita nelle impostazioni.');
  }

  const preset = GEMINI_MODEL_PRESETS[modelType] || GEMINI_MODEL_PRESETS.flash;
  let lastError = null;

  for (const model of preset.models) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT_INSTRUCTIONS + '\n\n' + trimmedText }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 8192
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const generatedJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return parseAiJsonResponse(generatedJsonText);
      } else {
        const errData = await response.json().catch(() => ({}));
        lastError = errData.error?.message || `Status ${response.status}`;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  // Fallback backend se presente
  try {
    const res = await apiFetch('/ai/generate-study-material', {
      method: 'POST',
      body: JSON.stringify({ text: trimmedText })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.studyKit) return data.studyKit;
    }
  } catch (backendErr) {
    console.warn('Backend proxy non raggiungibile:', backendErr);
  }

  throw new Error(`Errore Google Gemini (${preset.name}): ${lastError || 'Impossibile completare la generazione.'}`);
}

/**
 * Parsing e pulizia sicura del JSON restituito dall'AI
 */
function parseAiJsonResponse(rawString) {
  if (!rawString) throw new Error('Risposta vuota da parte di Google Gemini.');

  let clean = rawString.trim();

  // Rimuovi delimitatori markdown ```json ... ```
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Cerca la prima { e l'ultima } se c'è testo prima o dopo
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
    throw new Error('Il modello ha generato una risposta parziale. Riprova con un testo leggermente più sintetico.');
  }
}
