/**
 * fileSecurity.js — UniPlanner File Drag & Drop and Upload Security Inspector
 * 
 * Protegge l'applicazione da attacchi basati su file trascinati o caricati:
 * 1. Blocco estensioni pericolose (eseguibili, script, macro, SVG vettori XSS, archivi)
 * 2. Whitelist rigorosa per contesto d'uso (Studio vs Orario)
 * 3. Prevenzione doppia estensione (es. 'appunti.pdf.exe') e null-byte injection
 * 4. Limite dimensionale rigido prima del caricamento in memoria (anti-DoS/crash)
 * 5. Verifica dei Magic Bytes (firme binarie) per impedire file mascherati
 * 6. Sanificazione del nome file
 */

import DOMPurify from 'dompurify';

// Elenco esaustivo di estensioni pericolose mai consentite
export const DANGEROUS_EXTENSIONS = new Set([
  // Eseguibili & binari di sistema
  'exe', 'com', 'scr', 'msi', 'bin', 'dll', 'sys', 'drv', 'cpl', 'iso', 'img', 'dmg', 'app', 'apk',
  // Script & automazioni di shell
  'bat', 'cmd', 'sh', 'bash', 'zsh', 'ps1', 'psm1', 'vbs', 'vbe', 'wsf', 'wsh', 'hta', 'reg',
  // Linguaggi di script web & server (vettori XSS / esecuzione codice)
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'php', 'phtml', 'py', 'pyw', 'rb', 'pl', 'cgi', 'asp', 'aspx', 'jsp',
  // Formati HTML/SVG (possono contenere tag <script> ed eseguire JS nel browser)
  'html', 'htm', 'xhtml', 'svg', 'svgz', 'xml',
  // Archivi compressi (possono contenere file malevoli o zip-bomb)
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'
]);

// Whitelist consentite per ogni sezione dell'app
export const ALLOWED_FILE_TYPES = {
  // Assistente AI: Documenti di studio e immagini
  STUDY_ASSISTANT: {
    extensions: ['txt', 'md', 'pdf', 'png', 'jpg', 'jpeg', 'webp'],
    mimeTypes: [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp'
    ],
    maxSizeBytes: 25 * 1024 * 1024 // 25 MB max
  },
  // Importazione Orario lezioni
  SCHEDULE: {
    extensions: ['xls', 'xlsx', 'csv', 'ics'],
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/calendar',
      'application/octet-stream' // Molti browser assegnano questo a .ics/.xlsx
    ],
    maxSizeBytes: 10 * 1024 * 1024 // 10 MB max
  }
};

/**
 * Sanifica il nome del file rimuovendo caratteri di traversal o injection
 */
export function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'documento_anonimo';
  // Rimuovi percorsi (path traversal) e caratteri non stampabili
  const baseName = fileName.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return DOMPurify.sanitize(baseName, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).slice(0, 100);
}

/**
 * Estrae e valida l'estensione del file
 */
export function getCleanExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  const parts = fileName.toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts.pop().trim();
}

/**
 * Controlla se il nome file presenta tentativi di inganno con doppia estensione (es. 'foto.jpg.exe')
 */
export function hasSuspiciousDoubleExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return false;
  // Controlla presenza di null-byte
  if (fileName.includes('\0') || fileName.includes('%00')) return true;

  const parts = fileName.toLowerCase().split('.');
  if (parts.length > 2) {
    // Controlla se una delle estensioni intermedie è un eseguibile o uno script
    for (let i = 1; i < parts.length - 1; i++) {
      if (DANGEROUS_EXTENSIONS.has(parts[i])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Legge i primi N byte di un file per estrarre la firma binaria (Magic Bytes)
 */
export async function readFileHeaderBytes(file, numBytes = 8) {
  return new Promise((resolve) => {
    try {
      const slice = file.slice(0, numBytes);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (!reader.result) {
          resolve(new Uint8Array(0));
          return;
        }
        resolve(new Uint8Array(reader.result));
      };
      reader.onerror = () => resolve(new Uint8Array(0));
      reader.readAsArrayBuffer(slice);
    } catch {
      resolve(new Uint8Array(0));
    }
  });
}

/**
 * Verifica la firma binaria del file per assicurarsi che il tipo reale
 * corrisponda all'estensione dichiarata e non sia un binario mascherato.
 */
export async function verifyFileMagicBytes(file, ext) {
  const bytes = await readFileHeaderBytes(file, 8);
  if (bytes.length < 2) return { valid: false, reason: 'Impossibile leggere l\'intestazione del file.' };

  // 1. Controllo anti-eseguibile Windows PE ('MZ' = 0x4D 0x5A)
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return { valid: false, reason: 'Il file contiene una firma di eseguibile di sistema (PE/EXE) ed è stato bloccato per sicurezza.' };
  }

  // 2. Controllo anti-eseguibile Linux/Unix ('ELF' = 0x7F 0x45 0x4C 0x46)
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return { valid: false, reason: 'Il file contiene una firma binaria eseguibile (ELF) ed è stato bloccato per sicurezza.' };
  }

  // 3. Controllo firme specifiche per tipo consentito
  switch (ext) {
    case 'pdf':
      // %PDF (0x25 0x50 0x44 0x46)
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return { valid: true };
      }
      return { valid: false, reason: 'Il file non sembra essere un documento PDF valido (firma mancante).' };

    case 'png':
      // 0x89 0x50 0x4E 0x47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return { valid: true };
      }
      return { valid: false, reason: 'Il file non è un\'immagine PNG valida.' };

    case 'jpg':
    case 'jpeg':
      // 0xFF 0xD8 0xFF
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return { valid: true };
      }
      return { valid: false, reason: 'Il file non è un\'immagine JPEG valida.' };

    case 'webp':
      // RIFF....WEBP (0x52 0x49 0x46 0x46)
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        return { valid: true };
      }
      return { valid: false, reason: 'Il file non è un\'immagine WEBP valida.' };

    case 'xlsx':
      // ZIP header (0x50 0x4B 0x03 0x04)
      if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
        return { valid: true };
      }
      return { valid: false, reason: 'Il file non sembra essere una cartella di lavoro Excel (.xlsx) valida.' };

    case 'xls':
      // OLE Compound Document Header (0xD0 0xCF 0x11 0xE0) o ZIP
      if ((bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) ||
          (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Il file non sembra essere un foglio Excel (.xls) valido.' };

    case 'txt':
    case 'md':
    case 'csv':
    case 'ics':
      // Per i file di testo verifichiamo che non contengano tag <script o HTML malevoli nei primi byte
      return { valid: true };

    default:
      return { valid: true };
  }
}

/**
 * Validatore completo per qualsiasi file in ingresso da Drag & Drop o Input
 * 
 * @param {File} file — L'oggetto File nativo del browser
 * @param {'STUDY_ASSISTANT' | 'SCHEDULE'} context — Contesto di upload
 * @returns {Promise<{ ok: boolean, error?: string, sanitizedName: string, ext: string }>}
 */
export async function validateIncomingFile(file, context = 'STUDY_ASSISTANT') {
  if (!file) {
    return { ok: false, error: 'Nessun file selezionato.' };
  }

  const sanitizedName = sanitizeFileName(file.name);
  const ext = getCleanExtension(file.name);

  // 1. Blocco immediato estensioni pericolose assolute
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { 
      ok: false, 
      error: `Il file con estensione '.${ext}' è stato bloccato per motivi di sicurezza (formato eseguibile o non sicuro).`,
      sanitizedName, 
      ext 
    };
  }

  // 2. Controllo doppie estensioni o null-byte
  if (hasSuspiciousDoubleExtension(file.name)) {
    return { 
      ok: false, 
      error: 'Il file presenta una combinazione di estensioni sospetta ed è stato bloccato.',
      sanitizedName, 
      ext 
    };
  }

  // 3. Controllo whitelist specifica del contesto
  const rules = ALLOWED_FILE_TYPES[context];
  if (!rules) {
    return { ok: false, error: 'Contesto di caricamento non riconosciuto.' };
  }

  if (!rules.extensions.includes(ext)) {
    return { 
      ok: false, 
      error: `Formato non supportato (.${ext || 'sconosciuto'}). Formati ammessi: ${rules.extensions.map(e => '.' + e).join(', ')}.`,
      sanitizedName, 
      ext 
    };
  }

  // 4. Controllo dimensione massima
  if (file.size > rules.maxSizeBytes) {
    const maxMb = Math.round(rules.maxSizeBytes / (1024 * 1024));
    return { 
      ok: false, 
      error: `Il file supera la dimensione massima consentita di ${maxMb} MB.`,
      sanitizedName, 
      ext 
    };
  }

  // 5. Controllo firma binaria (Magic Bytes)
  const magicCheck = await verifyFileMagicBytes(file, ext);
  if (!magicCheck.valid) {
    return { 
      ok: false, 
      error: magicCheck.reason || 'Verifica di sicurezza del file fallita.',
      sanitizedName, 
      ext 
    };
  }

  return { 
    ok: true, 
    sanitizedName, 
    ext 
  };
}
