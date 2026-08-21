import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Sparkles, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  RotateCw, 
  Layers, 
  Award, 
  Clock, 
  Check, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  Flame, 
  BookOpen, 
  Crown, 
  Key, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown,
  ExternalLink,
  ShieldCheck,
  Zap,
  Cpu,
  X
} from 'lucide-react';
import { extractTextFromPDF } from '../utils/pdfExtractor';
import { 
  generateStudyKit, 
  testAiConnection, 
  GEMINI_MODEL_PRESETS, 
  GROQ_MODEL_PRESETS 
} from '../utils/aiStudyService';
import { useAuth } from '../context/AuthContext';
import { safeJsonParse } from '../utils/security';
import './AiStudyAssistant.css';

const SAMPLE_LECTURE_TEXT = `
ALGEBRA LINEARE E GEOMETRIA - TEOREMA SPETTRALE E DIAGONALIZZAZIONE
Una matrice quadrata A di ordine n su un campo reale o complesso si dice diagonalizzabile se è simile a una matrice diagonale D, ovvero se esiste una matrice invertibile P (matrice di passaggio) tale che P^(-1) * A * P = D.
Condizione necessaria e sufficiente per la diagonalizzabilità:
1. Il polinomio caratteristico p(lambda) = det(A - lambda * I) si decompone completamente in fattori lineari sul campo.
2. Per ogni autovalore lambda_i, la molteplicità algebrica m_a(lambda_i) coincide con la molteplicità geometrica m_g(lambda_i), definita come la dimensione dell'autospazio relativo V(lambda_i) = ker(A - lambda_i * I).

Teorema Spettrale per matrici simmetriche reali:
Ogni matrice simmetrica reale A (cioè tale che A = A^T) ammette una base ortonormale di autovettori ed è quindi ortogonalmente diagonalizzabile tramite una matrice ortogonale Q (tale che Q^(-1) = Q^T). Tutti i suoi autovalori sono reali.
Applicazioni pratiche: Riduzione in forma canonica delle forme quadratiche, decomposizione ai valori singolari (SVD) e analisi delle componenti principali (PCA) in machine learning.
`;

export default function AiStudyAssistant({ onOpenProModal }) {
  const { currentUser } = useAuth();
  const isPro = Boolean(currentUser?.isPremium);

  const [activeSubTab, setActiveSubTab] = useState('input'); // 'input' | 'quiz' | 'flashcards' | 'oral'
  
  // Input states
  const [rawText, setRawText] = useState('');
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // AI Settings Modal States
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(() => localStorage.getItem('uniplanner_ai_provider') || 'gemini');
  const [selectedModelType, setSelectedModelType] = useState(() => localStorage.getItem('uniplanner_ai_model_type') || 'flash');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('uniplanner_gemini_api_key') || '');
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('uniplanner_groq_api_key') || '');
  
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState(null); // { valid: boolean, message: string }

  // Generated Study Kit Data
  const [studyKit, setStudyKit] = useState(() => {
    const saved = localStorage.getItem('uniplanner_saved_study_kit');
    return saved ? safeJsonParse(saved, null) : null;
  });

  // Quiz Mode State
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [userQuizAnswers, setUserQuizAnswers] = useState({}); // { [quizId]: selectedOptionIndex }
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizTimer, setQuizTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Flashcards Mode State
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardMastery, setCardMastery] = useState({}); // { [cardId]: 'hard' | 'good' | 'easy' }
  const [isDeckFinished, setIsDeckFinished] = useState(false);
  const [onlyHardMode, setOnlyHardMode] = useState(false);

  // Timer Effect
  useEffect(() => {
    let interval;
    if (isTimerRunning && !quizSubmitted) {
      interval = setInterval(() => setQuizTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, quizSubmitted]);

  // Handle PDF Upload & Extraction
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setErrorMsg('Carica un file in formato PDF valido.');
      return;
    }

    setErrorMsg('');
    setIsExtractingPdf(true);
    setPdfProgress(0);

    try {
      const text = await extractTextFromPDF(file, (percent) => setPdfProgress(percent));
      if (!text || text.length < 50) {
        throw new Error('Il PDF sembra vuoto o scansionato come sola immagine.');
      }
      setRawText(text);
    } catch (err) {
      setErrorMsg(err.message || 'Errore durante la lettura del PDF.');
    } finally {
      setIsExtractingPdf(false);
    }
  };

  // Test Connection Action
  const handleTestApiKey = async () => {
    const activeKey = selectedProvider === 'gemini' ? geminiKey : groqKey;
    if (!activeKey.trim()) {
      setKeyTestResult({ valid: false, message: 'Inserisci prima la chiave API da testare.' });
      return;
    }

    setIsTestingKey(true);
    setKeyTestResult(null);

    try {
      const result = await testAiConnection(selectedProvider, activeKey, selectedModelType);
      setKeyTestResult(result);
      if (result.valid) {
        if (selectedProvider === 'gemini') {
          localStorage.setItem('uniplanner_gemini_api_key', geminiKey.trim());
        } else {
          localStorage.setItem('uniplanner_groq_api_key', groqKey.trim());
        }
        localStorage.setItem('uniplanner_ai_provider', selectedProvider);
        localStorage.setItem('uniplanner_ai_model_type', selectedModelType);
      }
    } catch (e) {
      setKeyTestResult({ valid: false, message: 'Errore di connessione con il provider.' });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Generate Study Kit Action
  const handleGenerate = async () => {
    if (!rawText.trim()) {
      setErrorMsg('Inserisci del testo o carica un PDF con i tuoi appunti.');
      return;
    }

    const currentKey = selectedProvider === 'gemini' 
      ? (geminiKey || localStorage.getItem('uniplanner_gemini_api_key')) 
      : (groqKey || localStorage.getItem('uniplanner_groq_api_key'));

    if (!currentKey) {
      setShowKeyModal(true);
      return;
    }

    // Check Free Trial vs PRO
    const freeUsed = Number(localStorage.getItem('uniplanner_ai_free_uses') || 0);
    if (!isPro && freeUsed >= 1) {
      if (onOpenProModal) onOpenProModal();
      return;
    }

    setErrorMsg('');
    setIsGenerating(true);

    try {
      const kit = await generateStudyKit(rawText, {
        provider: selectedProvider,
        modelType: selectedModelType,
        apiKey: currentKey
      });

      setStudyKit(kit);
      localStorage.setItem('uniplanner_saved_study_kit', JSON.stringify(kit));
      
      if (!isPro) {
        localStorage.setItem('uniplanner_ai_free_uses', String(freeUsed + 1));
      }

      // Reset test states
      setCurrentQuizIdx(0);
      setUserQuizAnswers({});
      setQuizSubmitted(false);
      setQuizTimer(0);
      setIsTimerRunning(true);
      
      setCurrentCardIdx(0);
      setIsCardFlipped(false);
      setCardMastery({});
      setIsDeckFinished(false);
      setOnlyHardMode(false);

      setActiveSubTab('quiz');
    } catch (err) {
      setErrorMsg(err.message || 'Errore durante la generazione AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAnswer = (optionIdx) => {
    if (quizSubmitted) return;
    setUserQuizAnswers(prev => ({
      ...prev,
      [currentQuizIdx]: optionIdx
    }));
  };

  const calculateScore = () => {
    if (!studyKit?.quizzes || studyKit.quizzes.length === 0) {
      return { score30: 0, correct: 0, total: 20, isPassed: false, isLode: false };
    }
    const total = studyKit.quizzes.length;
    let correct = 0;
    studyKit.quizzes.forEach((q, idx) => {
      if (userQuizAnswers[idx] === q.correctIndex) {
        correct++;
      }
    });
    const rawVote = Math.round((correct / total) * 30);
    const isPassed = rawVote >= 18;
    const isLode = correct === total && total >= 10;
    return { score30: rawVote, correct, total, isPassed, isLode };
  };

  const allCards = studyKit?.flashcards || [];
  const activeCards = onlyHardMode 
    ? allCards.filter((_, idx) => cardMastery[idx] === 'hard')
    : allCards;

  const handleRateCard = (rating) => {
    const activeCardObj = activeCards[currentCardIdx];
    const originalIndex = allCards.indexOf(activeCardObj);

    setCardMastery(prev => ({
      ...prev,
      [originalIndex !== -1 ? originalIndex : currentCardIdx]: rating
    }));
    setIsCardFlipped(false);

    if (currentCardIdx < activeCards.length - 1) {
      setTimeout(() => setCurrentCardIdx(i => i + 1), 150);
    } else {
      setIsDeckFinished(true);
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getActiveModelBadgeLabel = () => {
    if (selectedProvider === 'gemini') {
      return selectedModelType === 'pro' ? 'Google Gemini Pro 🧠' : 'Google Gemini Flash ⚡';
    }
    return 'Groq Llama 3.3 70B 🚀';
  };

  return (
    <div className="ai-assistant-container">
      {/* Header Banner */}
      <div className="ai-header-card glass-panel">
        <div className="ai-header-left">
          <div className="ai-icon-halo">
            <Bot size={26} />
          </div>
          <div>
            <div className="ai-badge-row">
              <span className="ai-badge-ai">
                <Sparkles size={12} />
                <span>{getActiveModelBadgeLabel()}</span>
              </span>
              {!isPro && (
                <span className="ai-badge-free">1 Prova Gratuita</span>
              )}
            </div>
            <h1>Assistente Studio & Quiz Generator</h1>
            <p className="ai-header-sub">
              Genera 20 domande d'esame a risposta multipla, Flashcards Spaced Repetition e le 5 domande più probabili per l'orale.
            </p>
          </div>
        </div>

        <div className="ai-header-actions">
          <button 
            className="ai-key-btn" 
            onClick={() => setShowKeyModal(true)}
            title="Configura Motore AI e Chiavi API"
          >
            <Cpu size={15} />
            <span>Impostazioni Motore AI</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      {studyKit && (
        <div className="ai-subtabs-nav">
          <button 
            className={`ai-subtab-btn ${activeSubTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('input')}
          >
            <UploadCloud size={15} />
            <span>Carica Materiale</span>
          </button>
          <button 
            className={`ai-subtab-btn ${activeSubTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('quiz')}
          >
            <FileText size={15} />
            <span>Simulazione Esame ({studyKit.quizzes?.length || 20} Quiz)</span>
          </button>
          <button 
            className={`ai-subtab-btn ${activeSubTab === 'flashcards' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('flashcards')}
          >
            <Layers size={15} />
            <span>Flashcards ({studyKit.flashcards?.length || 0})</span>
          </button>
          <button 
            className={`ai-subtab-btn ${activeSubTab === 'oral' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('oral')}
          >
            <Flame size={15} />
            <span>Top 5 Orale</span>
          </button>
        </div>
      )}

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="ai-error-banner">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}>×</button>
        </div>
      )}

      {/* TAB 1: INPUT & UPLOAD MATERIAL */}
      {(!studyKit || activeSubTab === 'input') && (
        <div className="ai-input-layout">
          <div className="ai-upload-box glass-panel">
            <div className="upload-dropzone">
              <input 
                type="file" 
                accept=".pdf,application/pdf" 
                onChange={handlePdfUpload}
                disabled={isExtractingPdf || isGenerating}
                id="pdf-input-element"
                style={{ display: 'none' }}
              />
              <label htmlFor="pdf-input-element" className="dropzone-label">
                <div className="dropzone-icon-circle">
                  <UploadCloud size={30} />
                </div>
                <h3>Trascina qui le tue Slide o Dispense PDF</h3>
                <p>oppure clicca per sfogliare i file del computer</p>
                <span className="dropzone-hint">Estrazione testo 100% nel browser • Nessun file pesante caricato</span>
              </label>

              {isExtractingPdf && (
                <div className="extraction-progress">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${pdfProgress}%` }} />
                  </div>
                  <span>Estrazione testo in corso... {pdfProgress}%</span>
                </div>
              )}
            </div>

            <div className="divider-text">oppure incolla direttamente gli appunti</div>

            <div className="textarea-wrapper">
              <textarea 
                className="ai-notes-textarea"
                placeholder="Incolla qui il testo di una lezione, riassunto, dispense o capitolo di libro..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
              />
              <div className="textarea-footer">
                <span>{rawText.length} caratteri inseriti</span>
                <button 
                  type="button" 
                  className="sample-text-btn"
                  onClick={() => setRawText(SAMPLE_LECTURE_TEXT.trim())}
                >
                  Carica Esempio di Prova (Algebra Lineare)
                </button>
              </div>
            </div>

            <div className="ai-generate-action">
              <button 
                className="primary-btn ai-start-btn" 
                onClick={handleGenerate}
                disabled={isGenerating || isExtractingPdf || !rawText.trim()}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={18} className="spinner-icon" />
                    <span>L'AI sta analizzando e creando il tuo Kit Esame...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Genera 20 Quiz, Flashcards & Guida Orale</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXAM QUIZ SIMULATION (20 QUESTIONS) */}
      {studyKit && activeSubTab === 'quiz' && (
        <div className="ai-quiz-layout">
          <div className="quiz-topbar glass-panel">
            <div className="quiz-subject-info">
              <h2>{studyKit.subject}</h2>
              <span className="quiz-q-counter">
                Domanda {currentQuizIdx + 1} di {studyKit.quizzes.length}
              </span>
            </div>

            <div className="quiz-status-group">
              <div className="quiz-timer-badge">
                <Clock size={15} />
                <span>{formatTime(quizTimer)}</span>
              </div>
              {!quizSubmitted && (
                <button 
                  className="primary-btn finish-quiz-btn"
                  onClick={() => {
                    setQuizSubmitted(true);
                    setIsTimerRunning(false);
                  }}
                >
                  Consegna Esame
                </button>
              )}
            </div>
          </div>

          {quizSubmitted && (
            <motion.div 
              className="quiz-results-banner glass-panel"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="results-badge-score">
                <Award size={40} style={{ color: calculateScore().isPassed ? '#10b981' : '#ef4444' }} />
                <div className="score-texts">
                  <h3>Esito Simulazione d'Esame</h3>
                  <div className="final-grade-display">
                    Voto: <strong style={{ color: calculateScore().isPassed ? '#10b981' : '#ef4444' }}>
                      {calculateScore().score30}/30
                    </strong>
                    {calculateScore().isLode && <span className="lode-tag">e Lode 🌟</span>}
                    {!calculateScore().isPassed && (
                      <span className="insufficient-tag">Insufficiente (&lt; 18) ❌</span>
                    )}
                  </div>
                  <p>
                    Hai risposto correttamente a <strong>{calculateScore().correct}</strong> su <strong>{calculateScore().total}</strong> domande in {formatTime(quizTimer)}.
                    {!calculateScore().isPassed && " Ti consigliamo di ripassare le Flashcard prima di ritentare!"}
                  </p>
                </div>
              </div>

              <button 
                className="secondary-btn retake-btn"
                onClick={() => {
                  setUserQuizAnswers({});
                  setQuizSubmitted(false);
                  setQuizTimer(0);
                  setIsTimerRunning(true);
                  setCurrentQuizIdx(0);
                }}
              >
                <RefreshCw size={15} />
                <span>Ripeti Simulazione</span>
              </button>
            </motion.div>
          )}

          {studyKit.quizzes[currentQuizIdx] && (
            <div className="quiz-card glass-panel">
              <div className="quiz-question-header">
                <span className="q-number">Q{currentQuizIdx + 1}</span>
                <h3 className="q-title">{studyKit.quizzes[currentQuizIdx].question}</h3>
              </div>

              <div className="quiz-options-list">
                {studyKit.quizzes[currentQuizIdx].options.map((opt, optIdx) => {
                  const isSelected = userQuizAnswers[currentQuizIdx] === optIdx;
                  const isCorrect = studyKit.quizzes[currentQuizIdx].correctIndex === optIdx;
                  
                  let optionClass = 'quiz-option-btn';
                  if (isSelected) optionClass += ' selected';
                  if (quizSubmitted) {
                    if (isCorrect) optionClass += ' correct-answer';
                    else if (isSelected && !isCorrect) optionClass += ' wrong-answer';
                  }

                  return (
                    <button
                      key={optIdx}
                      className={optionClass}
                      onClick={() => handleSelectAnswer(optIdx)}
                      disabled={quizSubmitted}
                    >
                      <div className="option-letter">
                        {String.fromCharCode(65 + optIdx)}
                      </div>
                      <span className="option-text">{opt}</span>
                      {quizSubmitted && isCorrect && <CheckCircle2 size={18} className="status-icon-correct" />}
                      {quizSubmitted && isSelected && !isCorrect && <XCircle size={18} className="status-icon-wrong" />}
                    </button>
                  );
                })}
              </div>

              {quizSubmitted && (
                <motion.div 
                  className="quiz-explanation-box"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="exp-header">
                    <HelpCircle size={16} />
                    <span>Spiegazione del Docente:</span>
                  </div>
                  <p>{studyKit.quizzes[currentQuizIdx].explanation}</p>
                </motion.div>
              )}

              <div className="quiz-nav-footer">
                <button 
                  className="quiz-nav-arrow"
                  disabled={currentQuizIdx === 0}
                  onClick={() => setCurrentQuizIdx(i => i - 1)}
                >
                  <ChevronLeft size={18} />
                  <span>Precedente</span>
                </button>

                <div className="quiz-bullet-pagination">
                  {studyKit.quizzes.map((_, dotIdx) => {
                    const answered = userQuizAnswers[dotIdx] !== undefined;
                    const isCurrent = dotIdx === currentQuizIdx;
                    return (
                      <button
                        key={dotIdx}
                        className={`quiz-dot ${isCurrent ? 'current' : ''} ${answered ? 'answered' : ''}`}
                        onClick={() => setCurrentQuizIdx(dotIdx)}
                        title={`Domanda ${dotIdx + 1}`}
                      >
                        {dotIdx + 1}
                      </button>
                    );
                  })}
                </div>

                <button 
                  className="quiz-nav-arrow"
                  disabled={currentQuizIdx === studyKit.quizzes.length - 1}
                  onClick={() => setCurrentQuizIdx(i => i + 1)}
                >
                  <span>Successiva</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FLASHCARDS SPACED REPETITION */}
      {studyKit && activeSubTab === 'flashcards' && (
        <div className="ai-flashcards-layout">
          <div className="flashcards-topbar glass-panel">
            <div>
              <h2>Flashcards & Ripetizione Spaziata</h2>
              <span className="fc-progress-hint">
                Carta {currentCardIdx + 1} di {studyKit.flashcards.length}
              </span>
            </div>

            <div className="fc-stats-pills">
              <span className="fc-stat easy">
                Facili: {Object.values(cardMastery).filter(v => v === 'easy').length}
              </span>
              <span className="fc-stat good">
                Buone: {Object.values(cardMastery).filter(v => v === 'good').length}
              </span>
              <span className="fc-stat hard">
                Da Rivedere: {Object.values(cardMastery).filter(v => v === 'hard').length}
              </span>
            </div>
          </div>

          {/* Mazzo Concluso / Schermata di Riepilogo e Riavvio */}
          {isDeckFinished ? (
            <motion.div 
              className="fc-deck-finished-card glass-panel"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="finished-badge-halo">
                <Award size={48} style={{ color: '#10b981' }} />
              </div>
              <h3>Ottimo Lavoro! Hai completato il mazzo 🎉</h3>
              <p>
                Hai memorizzato <strong>{Object.values(cardMastery).filter(v => v === 'easy' || v === 'good').length}</strong> concetti. 
                {Object.values(cardMastery).filter(v => v === 'hard').length > 0 && (
                  <span> Ci sono <strong>{Object.values(cardMastery).filter(v => v === 'hard').length}</strong> concetti contrassegnati come difficili.</span>
                )}
              </p>

              <div className="deck-finished-actions">
                <button 
                  className="secondary-btn restart-deck-btn"
                  onClick={() => {
                    setCurrentCardIdx(0);
                    setIsCardFlipped(false);
                    setIsDeckFinished(false);
                    setOnlyHardMode(false);
                  }}
                >
                  <RefreshCw size={15} />
                  <span>Ricomincia Tutto il Mazzo</span>
                </button>

                {Object.values(cardMastery).filter(v => v === 'hard').length > 0 && (
                  <button 
                    className="primary-btn review-hard-btn"
                    onClick={() => {
                      setOnlyHardMode(true);
                      setCurrentCardIdx(0);
                      setIsCardFlipped(false);
                      setIsDeckFinished(false);
                    }}
                  >
                    <Flame size={15} />
                    <span>Ripassa solo quelle Difficili ({Object.values(cardMastery).filter(v => v === 'hard').length})</span>
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <>
              {/* 3D Flip Card Container */}
              <div className="flashcard-stage">
                {activeCards[currentCardIdx] && (
                  <div 
                    className={`flashcard-3d-card ${isCardFlipped ? 'flipped' : ''}`}
                    onClick={() => setIsCardFlipped(!isCardFlipped)}
                  >
                    <div className="card-side card-front glass-panel">
                      <span className="card-category-tag">
                        {activeCards[currentCardIdx].category || 'Concetto Chiave'}
                      </span>
                      <div className="card-body-content">
                        <h3>{activeCards[currentCardIdx].front}</h3>
                      </div>
                      <div className="card-click-hint">
                        <RotateCw size={14} />
                        <span>Clicca per girare la carta</span>
                      </div>
                    </div>

                    <div className="card-side card-back glass-panel">
                      <span className="card-category-tag back">Definizione / Soluzione</span>
                      <div className="card-body-content">
                        <p>{activeCards[currentCardIdx].back}</p>
                      </div>
                      <div className="card-click-hint">
                        <span>Valuta il livello di memorizzazione:</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Spaced Repetition Buttons */}
              <div className="fc-actions-row">
                <button 
                  className="fc-rate-btn hard-btn" 
                  onClick={() => handleRateCard('hard')}
                >
                  <ThumbsDown size={16} />
                  <span>Difficile (Rivedi Subito)</span>
                </button>
                <button 
                  className="fc-rate-btn good-btn" 
                  onClick={() => handleRateCard('good')}
                >
                  <Check size={16} />
                  <span>Buono (Ricordato a fatica)</span>
                </button>
                <button 
                  className="fc-rate-btn easy-btn" 
                  onClick={() => handleRateCard('easy')}
                >
                  <ThumbsUp size={16} />
                  <span>Facile (Memorizzato! 🧠)</span>
                </button>
              </div>

              {/* Card Navigation Footer */}
              <div className="fc-nav-controls">
                <button 
                  className="fc-nav-arrow"
                  disabled={currentCardIdx === 0}
                  onClick={() => {
                    setIsCardFlipped(false);
                    setCurrentCardIdx(i => i - 1);
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Precedente</span>
                </button>
                <button 
                  className="fc-nav-arrow"
                  disabled={currentCardIdx >= activeCards.length - 1}
                  onClick={() => {
                    setIsCardFlipped(false);
                    setCurrentCardIdx(i => i + 1);
                  }}
                >
                  <span>Successiva</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: TOP 5 ORAL EXAM QUESTIONS */}
      {studyKit && activeSubTab === 'oral' && (
        <div className="ai-oral-layout">
          <div className="oral-topbar glass-panel">
            <Flame size={24} style={{ color: '#f59e0b' }} />
            <div>
              <h2>Top 5 Domande d'Esame Orale</h2>
              <p>I collegamenti concettuali più richiesti con risposte modello strutturate.</p>
            </div>
          </div>

          <div className="oral-questions-list">
            {studyKit.oralQuestions?.map((item, idx) => (
              <div key={idx} className="oral-card glass-panel">
                <div className="oral-card-header">
                  <span className="oral-badge">Domanda #{idx + 1}</span>
                  <h3>"{item.question}"</h3>
                </div>

                <div className="oral-ideal-answer">
                  <div className="ideal-tag">
                    <Award size={15} />
                    <span>Risposta Modello da 30L:</span>
                  </div>
                  <p>{item.idealAnswer}</p>
                </div>

                {item.trapTip && (
                  <div className="oral-trap-tip">
                    <AlertTriangle size={15} />
                    <div>
                      <strong>Trabocchetto da evitare:</strong> {item.trapTip}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAZIONE MOTORE AI MULTI-PROVIDER */}
      {showKeyModal && (
        <div className="modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <motion.div 
            className="ai-key-modal glass-panel"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="key-modal-header">
              <div className="key-icon-halo">
                <Cpu size={22} />
              </div>
              <div>
                <h3>Configurazione Motore AI</h3>
                <p className="key-modal-sub">Scegli tra Google Gemini (Flash / Pro) e Groq Cloud</p>
              </div>
              <button className="key-modal-close" onClick={() => setShowKeyModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Provider Selector Tabs */}
            <div className="provider-selector-tabs">
              <button
                type="button"
                className={`provider-tab-btn ${selectedProvider === 'gemini' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedProvider('gemini');
                  setKeyTestResult(null);
                }}
              >
                <span>Google Gemini</span>
                <span className="provider-sub-tag">Flash & Pro</span>
              </button>
              <button
                type="button"
                className={`provider-tab-btn ${selectedProvider === 'groq' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedProvider('groq');
                  setKeyTestResult(null);
                }}
              >
                <span>Groq Cloud</span>
                <span className="provider-sub-tag">Llama 3.3 (1s)</span>
              </button>
            </div>

            {/* GEMINI SETTINGS */}
            {selectedProvider === 'gemini' && (
              <div className="provider-settings-content">
                <div className="model-variant-selector">
                  <div 
                    className={`model-card-option ${selectedModelType === 'flash' ? 'selected' : ''}`}
                    onClick={() => setSelectedModelType('flash')}
                  >
                    <div className="model-card-header">
                      <strong>Gemini Flash</strong>
                      <span className="badge-tag free">Gratuito ⚡</span>
                    </div>
                    <p>Ideale per dispense fino a 100 pagine. Velocissimo e 100% gratis con 1.500 generazioni/giorno.</p>
                  </div>

                  <div 
                    className={`model-card-option ${selectedModelType === 'pro' ? 'selected' : ''}`}
                    onClick={() => setSelectedModelType('pro')}
                  >
                    <div className="model-card-header">
                      <strong>Gemini Pro (Advanced)</strong>
                      <span className="badge-tag pro">Abbonamento 🧠</span>
                    </div>
                    <p>Ragionamento profondo per tomi da 500 pagine e materie complesse. Per chi ha quote Pro / Google One.</p>
                  </div>
                </div>

                <div className="key-guide-steps">
                  <div className="guide-step-card">
                    <span className="step-num">1</span>
                    <div>
                      <strong>Ottieni la tua Chiave Google AI Studio</strong>
                      <p>Gratuita per sempre, creata in 5 secondi.</p>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer"
                        className="get-key-link"
                      >
                        <span>Apri Google AI Studio</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="key-input-group">
                  <input 
                    type="password"
                    className="key-input-field"
                    placeholder="Incolla qui la chiave (es. AIzaSy...)"
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      setKeyTestResult(null);
                    }}
                  />
                  <button 
                    type="button" 
                    className="test-key-btn"
                    onClick={handleTestApiKey}
                    disabled={isTestingKey || !geminiKey.trim()}
                  >
                    {isTestingKey ? <RefreshCw size={14} className="spinner-icon" /> : <Zap size={14} />}
                    <span>Testa</span>
                  </button>
                </div>
              </div>
            )}

            {/* GROQ SETTINGS */}
            {selectedProvider === 'groq' && (
              <div className="provider-settings-content">
                <div className="model-variant-selector">
                  <div 
                    className={`model-card-option ${selectedModelType === 'llama70b' || selectedModelType === 'flash' ? 'selected' : ''}`}
                    onClick={() => setSelectedModelType('llama70b')}
                  >
                    <div className="model-card-header">
                      <strong>Meta Llama 3.3 70B</strong>
                      <span className="badge-tag free">Ultra-Veloce 🚀</span>
                    </div>
                    <p>L'AI open source più veloce al mondo: genera 20 quiz in meno di 1 secondo grazie ai chip LPU Groq.</p>
                  </div>
                </div>

                <div className="key-guide-steps">
                  <div className="guide-step-card">
                    <span className="step-num">1</span>
                    <div>
                      <strong>Ottieni la tua Chiave Groq Cloud</strong>
                      <p>100% gratuita con 14.400 richieste/giorno.</p>
                      <a 
                        href="https://console.groq.com/keys" 
                        target="_blank" 
                        rel="noreferrer"
                        className="get-key-link"
                      >
                        <span>Apri Groq Console</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="key-input-group">
                  <input 
                    type="password"
                    className="key-input-field"
                    placeholder="Incolla qui la chiave Groq (es. gsk_...)"
                    value={groqKey}
                    onChange={(e) => {
                      setGroqKey(e.target.value);
                      setKeyTestResult(null);
                    }}
                  />
                  <button 
                    type="button" 
                    className="test-key-btn"
                    onClick={handleTestApiKey}
                    disabled={isTestingKey || !groqKey.trim()}
                  >
                    {isTestingKey ? <RefreshCw size={14} className="spinner-icon" /> : <Zap size={14} />}
                    <span>Testa</span>
                  </button>
                </div>
              </div>
            )}

            {/* Test Feedback */}
            {keyTestResult && (
              <div className={`key-test-feedback ${keyTestResult.valid ? 'success' : 'error'}`}>
                {keyTestResult.valid ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span>{keyTestResult.message}</span>
              </div>
            )}

            <div className="key-privacy-notice">
              <ShieldCheck size={14} />
              <span>Tutte le chiavi vengono salvate esclusivamente sul tuo browser in locale in modo protetto.</span>
            </div>

            <div className="key-modal-actions">
              <button 
                type="button"
                className="secondary-btn" 
                onClick={() => {
                  if (selectedProvider === 'gemini') {
                    localStorage.removeItem('uniplanner_gemini_api_key');
                    setGeminiKey('');
                  } else {
                    localStorage.removeItem('uniplanner_groq_api_key');
                    setGroqKey('');
                  }
                  setKeyTestResult(null);
                }}
              >
                Rimuovi Chiave
              </button>
              <button 
                type="button"
                className="primary-btn" 
                onClick={() => {
                  localStorage.setItem('uniplanner_ai_provider', selectedProvider);
                  localStorage.setItem('uniplanner_ai_model_type', selectedModelType);
                  if (selectedProvider === 'gemini' && geminiKey.trim()) {
                    localStorage.setItem('uniplanner_gemini_api_key', geminiKey.trim());
                  } else if (selectedProvider === 'groq' && groqKey.trim()) {
                    localStorage.setItem('uniplanner_groq_api_key', groqKey.trim());
                  }
                  setShowKeyModal(false);
                }}
              >
                Salva Preferenze
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
