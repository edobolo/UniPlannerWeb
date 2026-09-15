/**
 * aiController.js — UniPlanner AI Study Kit Generator with Quota Caps & Authentication
 * 
 * Implementa:
 * 1. Autenticazione obbligatoria per prevenire furto di quota API
 * 2. Spending Cap giornaliero (max 20 kit/giorno per utente)
 * 3. Sanitizzazione input e fallback multi-modello ultra-veloce
 * 4. Segreti confinati sul server tramite process.env
 */

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

function parseJson(str) {
  if (!str) return null;
  try {
    const clean = str.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err) {}
    }
    return null;
  }
}

function setupAiRoutes(app, db, authenticateToken) {
  const MAX_DAILY_AI_REQUESTS = 20;

  app.post('/api/ai/generate-study-material', express.json({ limit: '5mb' }), authenticateToken, async (req, res) => {
    try {
      const friendCode = req.user?.friendCode;
      if (!friendCode) {
        return res.status(401).json({ error: 'Accesso non autorizzato.' });
      }

      // SPENDING CAP: Controllo quote giornaliere per prevenire abusi o costi incontrollati
      const today = new Date().toISOString().split('T')[0];
      const user = db.prepare(`
        SELECT daily_ai_requests, last_ai_request_date, is_premium 
        FROM users WHERE UPPER(friend_code) = UPPER(?)
      `).get(friendCode);

      if (user) {
        let currentCount = user.daily_ai_requests || 0;
        if (user.last_ai_request_date !== today) {
          currentCount = 0;
          db.prepare(`UPDATE users SET daily_ai_requests = 0, last_ai_request_date = ? WHERE UPPER(friend_code) = UPPER(?)`)
            .run(today, friendCode);
        }

        if (currentCount >= MAX_DAILY_AI_REQUESTS) {
          return res.status(429).json({
            error: `Limite giornaliero raggiunto (${MAX_DAILY_AI_REQUESTS} kit/giorno). La quota si resetta a mezzanotte.`
          });
        }
      }

      const { text } = req.body || {};
      if (!text || typeof text !== 'string' || text.trim().length < 40) {
        return res.status(400).json({ error: 'Testo troppo breve. Inserisci almeno 40 caratteri di appunti o lezioni.' });
      }

      const trimmedText = text.slice(0, 60000);
      const fullPrompt = PROMPT_INSTRUCTIONS + '\n\n' + trimmedText;

      // 1. Chiamata a Groq Cloud
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
                // Incrementa quota giornaliera usata
                db.prepare(`
                  UPDATE users SET 
                    daily_ai_requests = COALESCE(daily_ai_requests, 0) + 1,
                    last_ai_request_date = ?
                  WHERE UPPER(friend_code) = UPPER(?)
                `).run(today, friendCode);

                console.info(`[AI GROQ] Kit generato per ${friendCode} con ${model}`);
                return res.json({ success: true, studyKit });
              }
            }
          } catch (modelErr) {
            console.warn(`[AI GROQ FALLBACK] Tentativo fallito con ${model}:`, modelErr.message);
          }
        }
      }

      // 2. Fallback Google Gemini
      if (GEMINI_API_KEY) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json'
              }
            })
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            const studyKit = parseJson(textResponse);
            if (studyKit && studyKit.quizzes?.length > 0) {
              db.prepare(`
                UPDATE users SET 
                  daily_ai_requests = COALESCE(daily_ai_requests, 0) + 1,
                  last_ai_request_date = ?
                WHERE UPPER(friend_code) = UPPER(?)
              `).run(today, friendCode);

              console.info(`[AI GEMINI] Kit generato con successo per ${friendCode}`);
              return res.json({ success: true, studyKit });
            }
          }
        } catch (geminiErr) {
          console.error('[AI GEMINI ERROR]', geminiErr.message);
        }
      }

      return res.status(502).json({ error: 'I motori di intelligenza artificiale sono momentaneamente occupati. Riprova tra 30 secondi.' });
    } catch (error) {
      console.error('[AI CONTROLLER ERROR]', error.message);
      res.status(500).json({ error: 'Errore interno durante l\'elaborazione didattica.' });
    }
  });
}

module.exports = setupAiRoutes;
