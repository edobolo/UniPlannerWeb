import { registerPlugin } from '@capacitor/core';
import { safeJsonParse } from './security';

const WidgetBridge = registerPlugin('WidgetBridge');

export const syncWidgetStats = async () => {
  try {
    const exams = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);
    const totalExams = exams.length;
    const passedExamsList = exams.filter(e => {
      const g = e.grade;
      return g && (Number(g) >= 18 || g === '30L' || e.isIdoneita || g === 'IDONEO');
    });
    const passedExams = passedExamsList.length;

    // Calcolo CFU e Media Ponderata
    let totalCfuPassed = 0;
    let weightedSum = 0;
    let cfuForAverage = 0;

    passedExamsList.forEach(e => {
      const cfu = Number(e.credits) || 6;
      totalCfuPassed += cfu;
      if (!e.isIdoneita && e.grade && e.grade !== 'IDONEO') {
        const gradeNum = e.grade === '30L' ? 30 : Number(e.grade);
        if (!isNaN(gradeNum)) {
          weightedSum += gradeNum * cfu;
          cfuForAverage += cfu;
        }
      }
    });

    const averageStr = cfuForAverage > 0 ? (weightedSum / cfuForAverage).toFixed(1) : '--';
    const totalCfu = Number(localStorage.getItem('uniplanner_target_cfu')) || 180;

    await WidgetBridge.updateStats({
      passedExams,
      totalExams,
      cfu: totalCfuPassed,
      totalCfu,
      average: averageStr,
      nextExam: 'Esami'
    });
  } catch (e) {
    // Ignora silenciosamente su browser desktop
  }
};
