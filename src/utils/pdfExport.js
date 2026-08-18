import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportLibrettoToPDF = (exams, mediaPonderata, mediaAritmetica, baseLaurea) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(41, 128, 185);
  doc.text("Libretto Universitario - UniPlanner", 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 14, 30);
  
  // Prepare Table Data
  const gradedExams = exams.filter(e => e.grade !== null);
  
  const tableData = gradedExams.map(e => [
    e.name,
    e.grade,
    e.credits ? e.credits.toString() : '0'
  ]);
  
  // Table
  doc.autoTable({
    startY: 40,
    head: [['Materia / Esame', 'Voto', 'CFU']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  
  // Summary Section
  const finalY = doc.lastAutoTable.finalY || 40;
  
  doc.setFontSize(14);
  doc.setTextColor(41, 128, 185);
  doc.text("Riepilogo Carriera", 14, finalY + 15);
  
  doc.setFontSize(11);
  doc.setTextColor(50);
  doc.text(`Media Ponderata: ${mediaPonderata}`, 14, finalY + 25);
  doc.text(`Media Aritmetica: ${mediaAritmetica}`, 14, finalY + 32);
  doc.text(`Voto Base Laurea: ${baseLaurea} / 110`, 14, finalY + 39);
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Pagina ${i} di ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  doc.save('Libretto_UniPlanner.pdf');
};
