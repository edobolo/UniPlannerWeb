const express = require('express');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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

const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b'
];

function setupAiRoutes(app) {
  app.post('/api/ai/generate-study-material', express.json({ limit: '10mb' }), async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text || text.trim().length < 40) {
        return res.status(400).json({ error: 'Testo troppo breve' });
      }

      const trimmedText = text.slice(0, 80000);
      const fullPrompt = PROMPT_INSTRUCTIONS + '\n\n' + trimmedText;

      // 1. Chiamata Ultra-Veloce a Groq Cloud (500 token/sec)
      if (GROQ_API_KEY) {
        for (const model of GROQ_MODELS) {
          try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: model,
                messages: [
                  { role: 'system', content: 'Sei un professore universitario. Rispondi solo in formato JSON valido.' },
                  { role: 'user', content: fullPrompt }
                ]
              })
            });

            if (groqRes.ok) {
              const data = await groqRes.json();
              const rawContent = data.choices?.[0]?.message?.content;
              const studyKit = parseJson(rawContent);
              if (studyKit && studyKit.quizzes?.length > 0) {
                console.log(`[AI Groq Success] Kit generato con successo tramite ${model}`);
                return res.json({ success: true, studyKit });
              }
            }
          } catch (e) {
            console.warn(`[AI Groq Warning] Modello ${model} non riuscito:`, e.message);
          }
        }
      }

      // 2. Fallback Google Gemini Flash se presente
      if (GEMINI_API_KEY) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
              }
            })
          });

          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const studyKit = parseJson(rawJson);
            if (studyKit) return res.json({ success: true, studyKit });
          }
        } catch (e) {
          console.warn('[AI Gemini Error]:', e.message);
        }
      }

      throw new Error('Nessun motore AI ha risposto con successo');
    } catch (err) {
      console.error('[AI Error]:', err);
      res.status(500).json({ error: err.message || 'Errore durante la generazione AI' });
    }
  });
}

function parseJson(str) {
  if (!str) return null;
  let clean = str.trim();
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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
    return JSON.parse(clean);
  } catch (e) {
    return null;
  }
}

module.exports = setupAiRoutes;
