/**
 * UniPlanner - Motore Matematico Ufficiale Calcolo Laurea & Tesi (D.M. 270/04 & D.M. 509/99)
 * Formule e regolamenti didattici universitari italiani.
 */

// Presets dei Regolamenti Didattici d'Ateneo più diffusi
export const UNIVERSITY_DEGREE_PRESETS = [
  {
    id: 'dm270_standard',
    name: 'Standard Nazionale (D.M. 270/04)',
    desc: 'Formula ponderata classica 110/30, lodi come bonus, tesi standard',
    method: 'WEIGHTED', // WEIGHTED | ARITHMETIC
    lodeValue: 'BONUS_POINTS', // BONUS_POINTS | WEIGHTED_31 | NONE
    lodeBonusPoints: 0.33,
    lodeMaxBonus: 2.0,
    discardWorstCfu: 0,
    thesisPointsMax: 7,
    inCorsoBonus: 2,
    erasmusBonus: 1
  },
  {
    id: 'politecnico_tech',
    name: 'Politecnico / Area Ingegneria',
    desc: 'Ponderata pura, scarto fino a 6-12 CFU, tesi sperimentale/compilativa',
    method: 'WEIGHTED',
    lodeValue: 'NONE',
    lodeBonusPoints: 0,
    lodeMaxBonus: 0,
    discardWorstCfu: 6,
    thesisPointsMax: 8,
    inCorsoBonus: 2,
    erasmusBonus: 1
  },
  {
    id: 'unibo_unimi_sapienza',
    name: 'Grandi Atenei (UniBo, UniMi, Sapienza)',
    desc: 'Base ponderata 110/30, bonus lodi 0.5 per lode, max 6 punti commissione',
    method: 'WEIGHTED',
    lodeValue: 'BONUS_POINTS',
    lodeBonusPoints: 0.5,
    lodeMaxBonus: 3.0,
    discardWorstCfu: 0,
    thesisPointsMax: 6,
    inCorsoBonus: 2,
    erasmusBonus: 1
  },
  {
    id: 'custom',
    name: 'Personalizzato (Regolamento del tuo Corso)',
    desc: 'Configura ogni singolo parametro del tuo Manifesto degli Studi',
    method: 'WEIGHTED',
    lodeValue: 'BONUS_POINTS',
    lodeBonusPoints: 0.5,
    lodeMaxBonus: 3.0,
    discardWorstCfu: 0,
    thesisPointsMax: 7,
    inCorsoBonus: 2,
    erasmusBonus: 1
  }
];

/**
 * Calcola la Base di Laurea e la Proiezione Finale secondo i parametri ufficiali
 */
export function calculateDegreeProjection(exams, config, options = {}) {
  const {
    thesisPoints = 4,
    hasInCorso = true,
    hasErasmus = false,
    hasSperimentale = false
  } = options;

  const validExams = exams.filter(e => e.grade !== null && e.grade !== undefined && e.grade !== 'IDONEO');
  const idoneitaExams = exams.filter(e => e.grade === 'IDONEO');

  const earnedCredits = validExams.reduce((acc, e) => acc + (Number(e.credits || e.cfu) || 0), 0) +
    idoneitaExams.reduce((acc, e) => acc + (Number(e.credits || e.cfu) || 0), 0);

  if (validExams.length === 0) {
    return {
      baseGrade: 0,
      finalProjected: 0,
      totalCredits: earnedCredits,
      lodeCount: 0,
      activeWeightedAverage: 0,
      arithmeticAverage: 0,
      cfuDiscarded: 0,
      ectsGrade: 'N/A'
    };
  }

  // 1. Gestione scarto dei peggiori N crediti (se previsto dal regolamento)
  let examsForCalc = [];
  
  // Create copies of exams with explicit CFU to allow partial subtraction
  validExams.forEach(e => {
    examsForCalc.push({ ...e, _calcCfu: Number(e.credits || e.cfu) || 0 });
  });
  
  let cfuDiscardedCount = 0;

  if (config.discardWorstCfu > 0 && examsForCalc.length > 2) {
    // Ordina i voti dal più basso al più alto
    examsForCalc.sort((a, b) => {
      const gA = a.grade === '30L' ? 30 : Number(a.grade);
      const gB = b.grade === '30L' ? 30 : Number(b.grade);
      return gA - gB;
    });

    let cfuToDiscard = config.discardWorstCfu;

    for (let i = 0; i < examsForCalc.length; i++) {
      const ex = examsForCalc[i];
      if (cfuToDiscard <= 0) break;
      
      if (ex._calcCfu > 0) {
        if (cfuToDiscard >= ex._calcCfu) {
          // Discard the whole exam
          cfuDiscardedCount += ex._calcCfu;
          cfuToDiscard -= ex._calcCfu;
          ex._calcCfu = 0;
        } else {
          // Discard only a fraction of the exam
          cfuDiscardedCount += cfuToDiscard;
          ex._calcCfu -= cfuToDiscard;
          cfuToDiscard = 0;
        }
      }
    }
  }

  // Filter out exams that were fully discarded
  examsForCalc = examsForCalc.filter(e => e._calcCfu > 0);

  // 2. Calcolo Media (Ponderata o Aritmetica)
  let sumPonderata = 0;
  let totalCfuPonderata = 0;
  let sumAritmetica = 0;
  let lodeCount = 0;

  validExams.forEach(e => {
    if (e.grade === '30L') lodeCount++;
  });

  examsForCalc.forEach(e => {
    const cfu = e._calcCfu;
    let numericGrade = e.grade === '30L' ? 30 : Number(e.grade);

    if (e.grade === '30L' && config.lodeValue === 'WEIGHTED_31') {
      numericGrade = 31;
    }

    sumPonderata += numericGrade * cfu;
    totalCfuPonderata += cfu;
    sumAritmetica += numericGrade;
  });

  const weightedAvg = totalCfuPonderata > 0 ? (sumPonderata / totalCfuPonderata) : 0;
  const arithmeticAvg = examsForCalc.length > 0 ? (sumAritmetica / examsForCalc.length) : 0;

  // 3. Calcolo Voto Base di Partenza (su 110)
  const baseAvg = config.method === 'ARITHMETIC' ? arithmeticAvg : weightedAvg;
  let baseGrade = (baseAvg * 110) / 30;

  // 4. Bonus Lodi
  let lodeBonusApplied = 0;
  if (config.lodeValue === 'BONUS_POINTS') {
    lodeBonusApplied = lodeCount * (Number(config.lodeBonusPoints) || 0);
    if (config.lodeMaxBonus > 0 && lodeBonusApplied > config.lodeMaxBonus) {
      lodeBonusApplied = config.lodeMaxBonus;
    }
  }

  baseGrade += lodeBonusApplied;

  // 5. Bonus Carriera
  let careerBonus = 0;
  if (hasInCorso && config.inCorsoBonus > 0) {
    careerBonus += Number(config.inCorsoBonus);
  }
  if (hasErasmus && config.erasmusBonus > 0) {
    careerBonus += Number(config.erasmusBonus);
  }
  if (hasSperimentale) {
    careerBonus += 1; // 1 punto aggiuntivo convenzionale per tesi sperimentale
  }

  // 6. Punti Tesi / Prova Finale
  const appliedThesisPoints = Math.min(Number(thesisPoints) || 0, Number(config.thesisPointsMax) || 11);

  // 7. Voto Finale Proiettato
  let finalProjected = baseGrade + careerBonus + appliedThesisPoints;
  const isLodePossible = finalProjected >= 110 && lodeCount >= 1;

  if (finalProjected > 110) {
    finalProjected = 110;
  }

  // 8. Conversione ECTS Ufficiale (European Credit Transfer System)
  let ectsGrade = 'C';
  if (weightedAvg >= 28.5) ectsGrade = 'A (Eccellente - Top 10%)';
  else if (weightedAvg >= 27.0) ectsGrade = 'B (Molto Buono - Top 25%)';
  else if (weightedAvg >= 24.0) ectsGrade = 'C (Buono - Top 30%)';
  else if (weightedAvg >= 21.0) ectsGrade = 'D (Soddisfacente - Top 25%)';
  else ectsGrade = 'E (Sufficiente - Top 10%)';

  return {
    baseGrade: Number(baseGrade.toFixed(2)),
    finalProjected: Number(finalProjected.toFixed(2)),
    finalRounded: Math.round(finalProjected),
    isLodePossible,
    totalCredits: earnedCredits,
    lodeCount,
    lodeBonusApplied: Number(lodeBonusApplied.toFixed(2)),
    careerBonus,
    thesisPoints: appliedThesisPoints,
    activeWeightedAverage: Number(weightedAvg.toFixed(2)),
    arithmeticAverage: Number(arithmeticAvg.toFixed(2)),
    cfuDiscarded: cfuDiscardedCount,
    ectsGrade
  };
}

/**
 * Calcola la media esatta necessaria negli esami mancanti per raggiungere un voto finale target
 */
export function calculateRequiredAverageForTarget(exams, targetFinalGrade, config, options = {}, targetTotalCfu = 180) {
  const currentProjection = calculateDegreeProjection(exams, config, options);
  
  const validExams = exams.filter(e => e.grade !== null && e.grade !== undefined && e.grade !== 'IDONEO');
  const idoneitaExams = exams.filter(e => e.grade === 'IDONEO');

  const currentGradedCfu = validExams.reduce((acc, e) => acc + (Number(e.credits || e.cfu) || 0), 0);
  const totalCompletedCfu = currentGradedCfu + idoneitaExams.reduce((acc, e) => acc + (Number(e.credits || e.cfu) || 0), 0);

  const remainingCfu = Math.max(0, targetTotalCfu - totalCompletedCfu);

  if (remainingCfu === 0) {
    return {
      achievable: currentProjection.finalProjected >= targetFinalGrade,
      requiredAverage: null,
      message: 'Hai già completato tutti i CFU del piano di studi.'
    };
  }

  // Punti esterni (tesi + bonus carriera)
  const externalPoints = (options.thesisPoints || 0) + 
                         (options.hasInCorso ? config.inCorsoBonus : 0) + 
                         (options.hasErasmus ? config.erasmusBonus : 0) + 
                         (options.hasSperimentale ? 1 : 0);
  
  // Base di partenza richiesta su 110 (esclusi bonus esterni e lodi passate)
  const requiredBase = targetFinalGrade - externalPoints - currentProjection.lodeBonusApplied;
  
  // Media ponderata complessiva finale richiesta (su 30)
  const requiredOverallAvg = (requiredBase * 30) / 110;

  // CFU totali che verranno effettivamente valutati alla laurea
  const totalEvaluatedCfu = targetTotalCfu - config.discardWorstCfu;
  
  // Somma ponderata totale richiesta alla fine
  const targetTotalWeightedSum = requiredOverallAvg * totalEvaluatedCfu;
  
  // Somma ponderata attualmente accumulata (già epurata dagli scarti attuali!)
  const currentlyEvaluatedCfu = currentGradedCfu - currentProjection.cfuDiscarded;
  const currentWeightedSum = currentProjection.activeWeightedAverage * currentlyEvaluatedCfu;
  
  // Somma ponderata mancante
  const requiredSumFromRemaining = targetTotalWeightedSum - currentWeightedSum;
  
  // CFU rimanenti che verranno effettivamente valutati (al netto degli eventuali scarti non ancora utilizzati)
  const cfuStillToDiscard = Math.max(0, config.discardWorstCfu - currentProjection.cfuDiscarded);
  const effectiveRemainingCfu = remainingCfu - cfuStillToDiscard;

  if (effectiveRemainingCfu <= 0) {
    return {
      achievable: currentProjection.finalProjected >= targetFinalGrade,
      requiredAverage: null,
      message: 'Hai già accumulato i CFU valutabili necessari.'
    };
  }

  const requiredAvg = requiredSumFromRemaining / effectiveRemainingCfu;

  if (requiredAvg <= 18) {
    return {
      achievable: true,
      requiredAverage: 18.0,
      remainingCfu,
      message: 'Target già ampiamente alla tua portata (basta la sufficienza minima di 18 in tutti gli esami rimasti).'
    };
  }

  if (requiredAvg > 30) {
    return {
      achievable: false,
      requiredAverage: Number(requiredAvg.toFixed(2)),
      remainingCfu,
      message: `Matematicamente non raggiungibile con soli esami (richiederebbe una media di ${requiredAvg.toFixed(1)}/30). Aumenta i punti tesi o bonus.`
    };
  }

  return {
    achievable: true,
    requiredAverage: Number(requiredAvg.toFixed(2)),
    remainingCfu,
    message: `Devi mantenere una media minima di ${requiredAvg.toFixed(2)}/30 nei ${remainingCfu} CFU rimanenti.`
  };
}
