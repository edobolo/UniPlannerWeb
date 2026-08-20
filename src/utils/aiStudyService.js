import { apiFetch } from './cloudSync';

const PROMPT_INSTRUCTIONS = `
Sei un Professore Universitario ed esaminatore accademico di altissimo livello.
Analizza il seguente materiale didattico ed elabora un KIT D'ESAME RIGOROSO E COMPLETO.

DEVI RESTITUIRE ESCLUSIVAMENTE UN JSON VALIDO (senza markdown aggiuntivo, senza blocchi di codice, solo JSON grezzo) con questa esatta struttura:

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

const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];

/**
 * Verifica la validità di una chiave API Google Gemini
 * @param {string} apiKey 
 * @returns {Promise<{ valid: boolean, message: string, activeModel?: string }>}
 */
export async function testGeminiApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length < 15) {
    return { valid: false, message: 'La chiave inserita sembra troppo corta o incompleta.' };
  }

  const cleanKey = apiKey.trim();

  for (const model of CANDIDATE_MODELS) {
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Rispondi con OK' }] }]
        })
      });

      if (res.ok) {
        return { valid: true, message: `Connessione a Google Gemini (${model}) riuscita! 🚀`, activeModel: model };
      }
    } catch (e) {
      // Prova il modello successivo
    }
  }

  return { 
    valid: false, 
    message: 'Impossibile connettersi con questa chiave API. Verifica di aver copiato l\'intera stringa da Google AI Studio.' 
  };
}

/**
 * Genera il kit di studio completo via AI
 * @param {string} rawText - Testo estratto da PDF o incollato dallo studente
 * @param {string} customApiKey - Chiave API opzionale dell'utente (Google Gemini)
 * @returns {Promise<Object>} Kit di studio generato
 */
export async function generateStudyKit(rawText, customApiKey = '') {
  if (!rawText || rawText.trim().length < 40) {
    throw new Error('Il testo inserito è troppo breve. Incolla almeno qualche paragrafo di appunti o carica un PDF.');
  }

  const trimmedText = rawText.slice(0, 60000);
  const userKey = customApiKey.trim() || localStorage.getItem('uniplanner_gemini_api_key') || '';

  // 1. Chiamata Diretta a Google Gemini (con fallback automatico sui modelli attivi)
  if (userKey) {
    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT_INSTRUCTIONS + '\n\n' + trimmedText }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json"
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

    throw new Error(`Errore AI Gemini: ${lastError || 'Nessun modello disponibile'}`);
  }

  // 2. Chiamata al Backend Raspberry Pi / Cloud API
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
    console.warn('Backend AI proxy non raggiungibile:', backendErr);
  }

  throw new Error('Per abilitare la generazione AI, inserisci la tua chiave gratuita Google Gemini cliccando su "Configura Chiave AI" in alto a destra.');
}

/**
 * Parsing e pulizia sicura del JSON restituito dall'AI
 */
function parseAiJsonResponse(rawString) {
  if (!rawString) throw new Error('Risposta vuota da parte del modello AI.');

  let clean = rawString.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(clean);
    return {
      subject: parsed.subject || 'Materia Esame',
      summary: parsed.summary || 'Sintesi strategica degli argomenti.',
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
      oralQuestions: Array.isArray(parsed.oralQuestions) ? parsed.oralQuestions : []
    };
  } catch (parseError) {
    console.error('Errore parsing JSON AI:', parseError, rawString);
    throw new Error('Formato generato non standard. Riprova con un testo leggermente più sintetico.');
  }
}
