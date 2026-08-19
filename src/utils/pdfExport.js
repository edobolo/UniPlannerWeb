import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportLibrettoToPDF = (exams = [], mediaPonderata = 0, mediaAritmetica = 0, baseLaurea = 0) => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Decorative Header Banner
    doc.setFillColor(30, 41, 59); // Slate dark
    doc.rect(0, 0, 210, 36, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(56, 189, 248); // Sky blue
    doc.text("UNIPLANNER - LIBRETTO ACCADEMICO", 14, 18);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225); // Slate light
    doc.text(`Riepilogo Ufficiale Piano di Studi • Generato il ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 28);

    // 2. Prepare Table Data
    const gradedExams = (exams || []).filter(e => e.grade !== null && e.grade !== undefined && e.grade !== '');
    const plannedExams = (exams || []).filter(e => e.grade === null || e.grade === undefined || e.grade === '');

    const totalPassedCfu = gradedExams.reduce((acc, e) => acc + (Number(e.credits || e.cfu) || 0), 0);
    const totalExamsCount = (exams || []).length;

    const tableData = [
      ...gradedExams.map(e => [
        e.name || 'Esame',
        e.year || '1° Anno',
        e.isIdoneita ? 'Idoneità' : (e.grade === '30L' ? '30 e Lode' : String(e.grade)),
        `${e.credits || e.cfu || 6} CFU`,
        'Superato ✓'
      ]),
      ...plannedExams.map(e => [
        e.name || 'Esame',
        e.year || '1° Anno',
        '-',
        `${e.credits || e.cfu || 6} CFU`,
        'Pianificato'
      ])
    ];

    // Fallback if empty
    if (tableData.length === 0) {
      tableData.push(['Nessun esame inserito', '-', '-', '-', '-']);
    }

    // 3. Generate Styled Table
    autoTable(doc, {
      startY: 44,
      head: [['Materia / Corso', 'Anno', 'Esito / Voto', 'Crediti', 'Stato']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [14, 165, 233], // Primary blue
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 28 },
        2: { cellWidth: 32, fontStyle: 'bold' },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 }
      }
    });

    // 4. Academic Summary Card
    const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 12;

    // Check if new page needed
    if (finalY > 230) {
      doc.addPage();
    }

    const summaryY = finalY > 230 ? 20 : finalY;

    // Background Card
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, summaryY, 182, 38, 3, 3, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, summaryY, 182, 38, 3, 3, 'D');

    // Card Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("STATISTICHE E MEDIE DI LAUREA", 20, summaryY + 9);

    // Stats Grid inside Card
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    doc.text(`Media Ponderata:`, 20, summaryY + 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text(`${mediaPonderata}`, 62, summaryY + 20);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Media Aritmetica:`, 20, summaryY + 29);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${mediaAritmetica}`, 62, summaryY + 29);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Voto Base Laurea:`, 105, summaryY + 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(147, 51, 234);
    doc.text(`${baseLaurea} / 110`, 148, summaryY + 20);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`CFU Acquisiti:`, 105, summaryY + 29);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`${totalPassedCfu} CFU (${gradedExams.length}/${totalExamsCount} esami)`, 148, summaryY + 29);

    // 5. Page Numbering Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `UniPlanner Academic Report • Pagina ${i} di ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`Libretto_UniPlanner_${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
  } catch (err) {
    console.error('Errore esportazione PDF:', err);
    alert('Impossibile generare il PDF. Verifica di avere esami nel piano di studi.');
    return false;
  }
};
