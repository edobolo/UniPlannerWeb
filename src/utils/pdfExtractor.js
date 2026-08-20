import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

/**
 * Estrae tutto il testo contenuto in un file PDF
 * @param {File|ArrayBuffer} fileInput 
 * @param {Function} onProgress - callback percentuale (0-100)
 * @returns {Promise<string>} Testo completo estratto
 */
export async function extractTextFromPDF(fileInput, onProgress) {
  try {
    let arrayBuffer;
    if (fileInput instanceof File || fileInput instanceof Blob) {
      arrayBuffer = await fileInput.arrayBuffer();
    } else {
      arrayBuffer = fileInput;
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ');

      fullText += `\n--- [Pagina ${pageNum}] ---\n` + pageText;

      if (onProgress && typeof onProgress === 'function') {
        onProgress(Math.round((pageNum / numPages) * 100));
      }
    }

    return fullText.trim();
  } catch (error) {
    console.error("Errore durante l'estrazione del PDF:", error);
    throw new Error('Impossibile leggere il file PDF. Assicurati che non sia protetto da password o corrotto.');
  }
}
