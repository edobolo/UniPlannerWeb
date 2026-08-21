import { apiFetch } from './cloudSync';

const PROMPT_INSTRUCTIONS = `
Sei un Professore Universitario ed esaminatore accademico di altissimo livello.
Analizza accuratamente il materiale didattico fornito (testo, dispense, appunti scritti a mano, slide o immagini di lavagne/schemi) ed elabora un KIT D'ESAME RIGOROSO E COMPLETO.

DEVI RESTITUIRE ESCLUSIVAMENTE UN JSON VALIDO (senza markdown aggiuntivo, senza spiegazioni fuori dal JSON, solo JSON valido) con questa esatta struttura:

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
1. Genera fino a 15-20 domande a risposta multipla ('quizzes'). Se il testo è breve, focalizzati sui punti essenziali.
2. Genera tra 10 e 18 'flashcards'.
3. Genera 5 'oralQuestions'.
4. 'correctIndex' deve essere un numero intero tra 0 e 3.
5. Lingua: ITALIANO formale universitario.

MATERIALE DIDATTICO:
`;

// Modelli ufficiali Google Gemini Flash supportati dall'API v1beta
const FLASH_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b'
];

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

        // Se Google menziona un modello attivo, mettilo in cima
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
    contents: [{ parts: [{ text: 'Rispondi solo con la parola: OK' }] }]
  }));

  if (result.success) {
    return {
      valid: true,
      message: `Connessione a Google Gemini Flash (${result.model}) verificata con successo! 🚀`,
      activeModel: result.model
    };
  }

  return {
    valid: false,
    message: `Errore Google API: ${result.error || 'Chiave non valida o scaduta.'}`
  };
}

/**
 * Genera il kit di studio completo tramite Google Gemini Flash (Testo + Immagini Multimodali)
 */
export async function generateStudyKit(inputData, options = {}) {
  let textContent = '';
  let imageContent = null;

  if (typeof inputData === 'string') {
    textContent = inputData;
  } else if (inputData && typeof inputData === 'object') {
    textContent = inputData.text || '';
    imageContent = inputData.image || null;
  }

  if (!textContent.trim() && !imageContent) {
    throw new Error('Inserisci del testo, carica un documento (PDF/TXT/MD) o un\'immagine (PNG/JPG).');
  }

  // Se il testo è veramente gigantesco (es. oltre 100.000 caratteri), avvisa chiaramente
  if (textContent.length > 100000) {
    throw new Error('Il documento caricato è molto lungo (supera i 100.000 caratteri). Prova a caricare un singolo capitolo o sezione per ottenere i risultati migliori.');
  }

  const apiKey = (options.apiKey || localStorage.getItem('uniplanner_gemini_api_key') || '').trim();
  if (!apiKey) {
    throw new Error('Nessuna chiave API Google Gemini configurata. Inserisci la tua chiave gratuita nelle impostazioni.');
  }

  const parts = [];

  // 1. Aggiungi il prompt con il testo
  const promptWithText = textContent.trim() 
    ? `${PROMPT_INSTRUCTIONS}\n\n${textContent}`
    : `${PROMPT_INSTRUCTIONS}\n\nAnalizza questa immagine contenente appunti di studio, slide o formule ed elabora il kit completo d'esame.`;

  parts.push({ text: promptWithText });

  // 2. Se è presente un'immagine (Vision), inviala come inlineData
  if (imageContent && imageContent.data && imageContent.mimeType) {
    parts.push({
      inlineData: {
        mimeType: imageContent.mimeType,
        data: imageContent.data
      }
    });
  }

  const result = await callGeminiFlash(apiKey, () => ({
    contents: [{ parts }],
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

  // Messaggio d'errore reale e dettagliato
  const err = result.error || 'Verifica la connessione internet o la chiave API.';
  if (err.includes('API_KEY_INVALID') || err.includes('key not valid')) {
    throw new Error('La chiave API Google Gemini inserita non è valida. Controlla di averla copiata correttamente da Google AI Studio.');
  } else if (err.includes('RESOURCE_EXHAUSTED') || err.includes('quota')) {
    throw new Error('Quota richieste Google Gemini temporaneamente esaurita. Attendi 30 secondi e riprova.');
  }

  throw new Error(`Errore Google Gemini: ${err}`);
}

/**
 * Parsing e pulizia sicura del JSON restituito dall'AI con auto-riparazione
 */
function parseAiJsonResponse(rawString) {
  if (!rawString) throw new Error('Risposta vuota ricevuta da Google Gemini. Riprova tra qualche istante.');

  let clean = rawString.trim();

  // Rimuovi blocchi markdown se presenti
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

  // Rimuovi virgole prima di chiusure di parentesi
  clean = clean.replace(/,\s*([}\]])/g, '$1');

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
    throw new Error('L\'intelligenza artificiale ha risposto in un formato non conforme. Riprova a cliccare su Genera.');
  }
}
