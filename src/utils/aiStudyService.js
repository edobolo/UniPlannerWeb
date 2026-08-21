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
    name: 'Gemini Flash (Consigliato & Gratuito)',
    badge: '100% Gratuito ⚡',
    desc: 'Velocissimo, 1.500 richieste/giorno gratis da Google AI Studio. Ottimizzato per dispense fino a 100 pagine.'
  },
  pro: {
    id: 'pro',
    name: 'Gemini Pro (Abbonati Google / Reasoning)',
    badge: 'Massima Precisione 🧠',
    desc: 'Ragionamento profondo per tomi da 500 pagine e materie complesse. Per account con piano Pro / Google Cloud.'
  }
};

/**
 * Interroga Google AI per trovare dinamicamente i modelli supportati sulla chiave dell'utente
 */
async function discoverBestGoogleModel(apiKey, modelType = 'flash') {
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      const available = (data.models || [])
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      if (available.length > 0) {
        if (modelType === 'pro') {
          // Cerca modelli Pro in ordine di preferenza (es. gemini-1.5-pro, gemini-2.5-pro)
          const proCandidate = available.find(m => m.includes('pro') && !m.includes('exp') && !m.includes('vision'))
            || available.find(m => m.includes('pro'))
            || available.find(m => m.includes('flash'));
          if (proCandidate) return proCandidate;
        } else {
          // Cerca modelli Flash in ordine di preferenza
          const flashCandidate = available.find(m => m.includes('flash') && !m.includes('8b') && !m.includes('exp'))
            || available.find(m => m.includes('flash'))
            || available[0];
          if (flashCandidate) return flashCandidate;
        }
      }
    }
  } catch (e) {
    console.warn('Errore lista modelli Google:', e);
  }

  // Fallback se listModels non è accessibile
  return modelType === 'pro' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
}

/**
 * Testa la connessione con Google Gemini rilevando automaticamente il modello corretto
 * @param {string} apiKey 
 * @param {string} modelType - 'flash' | 'pro'
 * @returns {Promise<{ valid: boolean, message: string, activeModel?: string }>}
 */
export async function testGeminiApiKey(apiKey = '', modelType = 'flash') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey || cleanKey.length < 10) {
    return { valid: false, message: 'Inserisci prima la tua chiave API di Google Gemini.' };
  }

  try {
    // 1. Rilevamento dinamico del modello abilitato sulla chiave
    const bestModel = await discoverBestGoogleModel(cleanKey, modelType);
    
    // 2. Chiamata di test effettiva
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${bestModel}:generateContent?key=${cleanKey}`;
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
        message: `Connessione a Google ${bestModel} riuscita con successo! 🚀`, 
        activeModel: bestModel 
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      const googleMsg = errData.error?.message || `Status ${res.status}`;
      return {
        valid: false,
        message: `Errore Google API: ${googleMsg}`
      };
    }
  } catch (e) {
    return { 
      valid: false, 
      message: `Errore di rete o chiave non valida: ${e.message}` 
    };
  }
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

  const activeModel = await discoverBestGoogleModel(apiKey, modelType);

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;
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
      throw new Error(errData.error?.message || `Status HTTP ${response.status}`);
    }
  } catch (err) {
    throw new Error(`Errore Google Gemini (${activeModel}): ${err.message}`);
  }
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
