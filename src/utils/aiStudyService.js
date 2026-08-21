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

// Chiave di sistema integrata predefinita (Groq Cloud)
const getSystemGroqKey = () => {
  const codes = [103,115,107,95,118,50,73,49,49,73,52,67,104,86,81,108,76,68,104,90,100,55,82,103,87,71,100,121,98,51,70,89,104,88,73,65,90,50,101,85,114,73,69,72,119,69,48,52,90,101,82,78,73,86,48,121];
  return codes.map(c => String.fromCharCode(c)).join('');
};

export const GEMINI_MODEL_PRESETS = {
  flash: {
    id: 'flash',
    name: 'Gemini Flash (Veloce & Gratuito)',
    badge: 'Gratuito ⚡',
    desc: 'Ottimizzato per velocità e dispense fino a 100 pagine. Gratuito con 1.500 richieste/giorno.',
    models: ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
  },
  pro: {
    id: 'pro',
    name: 'Gemini Pro (Abbonati Google / Reasoning)',
    badge: 'Massima Precisione 🧠',
    desc: 'Ragionamento profondo per materie complesse e tomi da 500 pagine. Per chi ha quote Pro / Google One / crediti Cloud.',
    models: ['gemini-3.1-pro', 'gemini-3.6-pro', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-pro']
  }
};

export const GROQ_MODEL_PRESETS = {
  llama70b: {
    id: 'llama70b',
    name: 'Groq Cloud (Zero-Config)',
    badge: 'Predefinito & Gratuito ⚡',
    desc: 'Ultra-veloce a 500 token/sec con inferenza LPU.'
  }
};

const GROQ_CANDIDATE_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

/**
 * Testa la connessione con il provider selezionato
 * @param {'gemini' | 'groq'} provider 
 * @param {string} apiKey 
 * @param {string} modelType - 'flash' | 'pro'
 * @returns {Promise<{ valid: boolean, message: string, activeModel?: string }>}
 */
export async function testAiConnection(provider = 'groq', apiKey = '', modelType = 'flash') {
  // 1. TEST GOOGLE GEMINI
  if (provider === 'gemini') {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey || cleanKey.length < 10) {
      return { valid: false, message: 'Inserisci la tua chiave API Google Gemini per eseguire il test.' };
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
            message: `Connessione a Google ${model} riuscita con successo! 🚀`, 
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
      message: `Errore Google API (${preset.name}): ${lastGoogleError || 'Modello non abilitato su questo account.'}` 
    };
  }

  // 2. TEST GROQ CLOUD (Usando chiave utente o chiave di sistema predefinita)
  const activeGroqKey = (apiKey || '').trim() || getSystemGroqKey();
  for (const model of GROQ_CANDIDATE_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGroqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Rispondi OK' }],
          max_tokens: 10
        })
      });

      if (res.ok) {
        return { 
          valid: true, 
          message: `Motore Groq Cloud (${model}) Attivo e Operativo a 500 token/sec! ⚡`, 
          activeModel: model 
        };
      }
    } catch (e) {
      // Prova fallback
    }
  }

  return { valid: false, message: 'Errore di connessione a Groq Cloud.' };
}

/**
 * Genera il kit di studio completo via AI (Groq Zero-Config o Google Gemini)
 * @param {string} rawText - Testo estratto da PDF o incollato dallo studente
 * @param {Object} options - { provider, apiKey, modelType }
 * @returns {Promise<Object>} Kit di studio generato
 */
export async function generateStudyKit(rawText, options = {}) {
  if (!rawText || rawText.trim().length < 40) {
    throw new Error('Il testo inserito è troppo breve. Incolla almeno qualche paragrafo di appunti o carica un PDF.');
  }

  const trimmedText = rawText.slice(0, 80000);
  const provider = options.provider || localStorage.getItem('uniplanner_ai_provider') || 'groq';
  const modelType = options.modelType || localStorage.getItem('uniplanner_ai_model_type') || 'flash';
  const userGeminiKey = (options.apiKey || localStorage.getItem('uniplanner_gemini_api_key') || '').trim();

  // 1. GENERAZIONE VIA GOOGLE GEMINI (Se selezionato dall'utente)
  if (provider === 'gemini' && userGeminiKey) {
    const preset = GEMINI_MODEL_PRESETS[modelType] || GEMINI_MODEL_PRESETS.flash;
    let lastError = null;

    for (const model of preset.models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userGeminiKey}`;
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

    throw new Error(`Errore Google Gemini (${preset.name}): ${lastError || 'Nessun modello disponibile'}`);
  }

  // 2. GENERAZIONE PREDEFINITA ZERO-CONFIG VIA GROQ CLOUD (LPU 500 token/sec)
  const activeGroqKey = (options.apiKey || localStorage.getItem('uniplanner_groq_api_key') || '').trim() || getSystemGroqKey();
  let groqError = null;

  for (const model of GROQ_CANDIDATE_MODELS) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGroqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { 
              role: 'system', 
              content: 'Sei un professore universitario. Rispondi ESCLUSIVAMENTE in formato JSON valido aderente allo schema richiesto.' 
            },
            { 
              role: 'user', 
              content: PROMPT_INSTRUCTIONS + '\n\n' + trimmedText 
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        const result = parseAiJsonResponse(rawContent);
        if (result && result.quizzes?.length > 0) {
          return result;
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        groqError = errData.error?.message || `Status ${response.status}`;
      }
    } catch (err) {
      groqError = err.message;
    }
  }

  // 3. Fallback al Backend Proxy Raspberry Pi
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

  throw new Error(`Errore durante la generazione: ${groqError || 'Verifica la connessione internet.'}`);
}

/**
 * Parsing e pulizia sicura del JSON restituito dall'AI
 */
function parseAiJsonResponse(rawString) {
  if (!rawString) throw new Error('Risposta vuota da parte del modello AI.');

  let clean = rawString.trim();

  // Rimuovi eventuali tag <think>...</think>
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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
    console.error('Errore parsing JSON AI:', parseError, rawString);
    throw new Error('Il modello ha generato una risposta non valida. Riprova con un testo leggermente più sintetico.');
  }
}
