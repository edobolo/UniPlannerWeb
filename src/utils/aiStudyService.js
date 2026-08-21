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
    name: 'Gemini Flash (Consigliato)',
    badge: 'Gratuito & Veloce ⚡',
    desc: 'Ottimizzato per velocità e dispense fino a 100 pagine. Gratuito al 100% con 1.500 richieste/giorno.',
    models: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3.6-flash', 'gemini-2.0-flash']
  },
  pro: {
    id: 'pro',
    name: 'Gemini Pro (Abbonati Google / Reasoning)',
    badge: 'Massima Precisione 🧠',
    desc: 'Ragionamento profondo per materie complesse (Medicina, Giurisprudenza, Ingegneria) e interi tomi da 500 pagine.',
    models: ['gemini-1.5-pro', 'gemini-2.5-pro', 'gemini-pro']
  }
};

export const GROQ_MODEL_PRESETS = {
  llama70b: {
    id: 'llama70b',
    name: 'Meta Llama 3.3 70B (Versatile)',
    badge: 'Ultra-Veloce 🚀',
    desc: 'Il modello open-source più potente e veloce: genera tutti i quiz in meno di 1 secondo.',
    modelId: 'llama-3.3-70b-versatile'
  },
  llama8b: {
    id: 'llama8b',
    name: 'Meta Llama 3.1 8B (Istantaneo)',
    badge: 'Super Leggero ⚡',
    desc: 'Risposta istantanea a latenza zero.',
    modelId: 'llama-3.1-8b-instant'
  }
};

/**
 * Testa la connessione con il provider selezionato
 * @param {'gemini' | 'groq'} provider 
 * @param {string} apiKey 
 * @param {string} modelType - 'flash' | 'pro' | 'llama70b' | 'llama8b'
 * @returns {Promise<{ valid: boolean, message: string, activeModel?: string }>}
 */
export async function testAiConnection(provider = 'gemini', apiKey = '', modelType = 'flash') {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, message: 'Inserisci prima una chiave API valida.' };
  }

  const cleanKey = apiKey.trim();

  // 1. TEST GOOGLE GEMINI
  if (provider === 'gemini') {
    const preset = GEMINI_MODEL_PRESETS[modelType] || GEMINI_MODEL_PRESETS.flash;
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
        }
      } catch (e) {
        // Prova il fallback
      }
    }

    return { 
      valid: false, 
      message: 'Impossibile validare la chiave con il modello selezionato. Verifica di aver copiato l\'intera chiave da Google AI Studio o se il tuo account supporta la versione Pro.' 
    };
  }

  // 2. TEST GROQ CLOUD
  if (provider === 'groq') {
    const preset = GROQ_MODEL_PRESETS[modelType] || GROQ_MODEL_PRESETS.llama70b;
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: preset.modelId,
          messages: [{ role: 'user', content: 'Rispondi OK' }],
          max_tokens: 10
        })
      });

      if (res.ok) {
        return { 
          valid: true, 
          message: `Connessione a Groq Cloud (${preset.name}) riuscita a velocità LPU! ⚡`, 
          activeModel: preset.modelId 
        };
      }

      const errData = await res.json().catch(() => ({}));
      return { valid: false, message: errData.error?.message || 'Errore autenticazione Groq.' };
    } catch (e) {
      return { valid: false, message: 'Errore di connessione a Groq Cloud.' };
    }
  }

  return { valid: false, message: 'Provider non supportato.' };
}

/**
 * Genera il kit di studio completo via AI (Gemini Flash/Pro o Groq Llama)
 * @param {string} rawText - Testo estratto da PDF o incollato dallo studente
 * @param {Object} options - { provider, apiKey, modelType }
 * @returns {Promise<Object>} Kit di studio generato
 */
export async function generateStudyKit(rawText, options = {}) {
  if (!rawText || rawText.trim().length < 40) {
    throw new Error('Il testo inserito è troppo breve. Incolla almeno qualche paragrafo di appunti o carica un PDF.');
  }

  const trimmedText = rawText.slice(0, 80000);
  
  const provider = options.provider || localStorage.getItem('uniplanner_ai_provider') || 'gemini';
  const modelType = options.modelType || localStorage.getItem('uniplanner_ai_model_type') || 'flash';
  const apiKey = (options.apiKey || (provider === 'gemini' 
    ? localStorage.getItem('uniplanner_gemini_api_key') 
    : localStorage.getItem('uniplanner_groq_api_key')) || '').trim();

  // 1. GENERAZIONE VIA GOOGLE GEMINI (Flash o Pro)
  if (provider === 'gemini' && apiKey) {
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

  // 2. GENERAZIONE VIA GROQ CLOUD (Llama 3.3 70B / 3.1 8B)
  if (provider === 'groq' && apiKey) {
    const preset = GROQ_MODEL_PRESETS[modelType] || GROQ_MODEL_PRESETS.llama70b;
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: preset.modelId,
          messages: [
            { 
              role: 'system', 
              content: 'Sei un professore universitario. Rispondi ESCLUSIVAMENTE con un JSON valido aderente allo schema richiesto.' 
            },
            { 
              role: 'user', 
              content: PROMPT_INSTRUCTIONS + '\n\n' + trimmedText 
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        return parseAiJsonResponse(rawContent);
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Groq Error ${response.status}`);
      }
    } catch (err) {
      throw new Error(`Errore Groq Cloud: ${err.message}`);
    }
  }

  // 3. Fallback al Backend Proxy se configurato sul Raspberry Pi
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

  throw new Error('Configura la tua chiave gratuita (Google Gemini o Groq) cliccando su "Configura Chiave AI" in alto a destra per iniziare.');
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
