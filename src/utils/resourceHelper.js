/**
 * resourceHelper.js - UniPlanner Smart Resource Link Detector
 * Riconosce automaticamente il tipo di link di studio (Google Drive, Notion, OneDrive, ecc.)
 */

export const RESOURCE_TYPES = {
  DRIVE: {
    id: 'drive',
    label: 'Google Drive',
    iconName: 'HardDrive',
    color: '#34a853',
    bgColor: 'rgba(52, 168, 83, 0.12)',
    borderColor: 'rgba(52, 168, 83, 0.35)'
  },
  DOCS: {
    id: 'docs',
    label: 'Google Docs/Slides',
    iconName: 'FileText',
    color: '#4285f4',
    bgColor: 'rgba(66, 133, 244, 0.12)',
    borderColor: 'rgba(66, 133, 244, 0.35)'
  },
  NOTION: {
    id: 'notion',
    label: 'Notion',
    iconName: 'BookOpen',
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.35)'
  },
  ONEDRIVE: {
    id: 'onedrive',
    label: 'OneDrive / Office',
    iconName: 'Cloud',
    color: '#0078d4',
    bgColor: 'rgba(0, 120, 212, 0.12)',
    borderColor: 'rgba(0, 120, 212, 0.35)'
  },
  DROPBOX: {
    id: 'dropbox',
    label: 'Dropbox',
    iconName: 'Folder',
    color: '#0061ff',
    bgColor: 'rgba(0, 97, 255, 0.12)',
    borderColor: 'rgba(0, 97, 255, 0.35)'
  },
  GITHUB: {
    id: 'github',
    label: 'GitHub / Code',
    iconName: 'Code',
    color: '#e2e8f0',
    bgColor: 'rgba(226, 232, 240, 0.12)',
    borderColor: 'rgba(226, 232, 240, 0.35)'
  },
  CANVA: {
    id: 'canva',
    label: 'Canva / Lavagna',
    iconName: 'Layout',
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.35)'
  },
  GENERIC: {
    id: 'link',
    label: 'Link / Dispensa',
    iconName: 'ExternalLink',
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)'
  }
};

/**
 * Analizza l'URL fornito e restituisce i metadati del servizio corrispondente
 */
export const detectResourceType = (url = '') => {
  if (!url) return RESOURCE_TYPES.GENERIC;
  const lower = url.toLowerCase().trim();

  if (lower.includes('drive.google.com') || lower.includes('google.com/drive')) {
    return RESOURCE_TYPES.DRIVE;
  }
  if (lower.includes('docs.google.com') || lower.includes('sheets.google.com') || lower.includes('slides.google.com')) {
    return RESOURCE_TYPES.DOCS;
  }
  if (lower.includes('notion.so') || lower.includes('notion.site') || lower.includes('notion.com')) {
    return RESOURCE_TYPES.NOTION;
  }
  if (lower.includes('1drv.ms') || lower.includes('onedrive.live.com') || lower.includes('sharepoint.com') || lower.includes('office.com')) {
    return RESOURCE_TYPES.ONEDRIVE;
  }
  if (lower.includes('dropbox.com')) {
    return RESOURCE_TYPES.DROPBOX;
  }
  if (lower.includes('github.com') || lower.includes('gitlab.com')) {
    return RESOURCE_TYPES.GITHUB;
  }
  if (lower.includes('canva.com') || lower.includes('miro.com') || lower.includes('excalidraw.com')) {
    return RESOURCE_TYPES.CANVA;
  }

  return RESOURCE_TYPES.GENERIC;
};

/**
 * Pulisce e assicura che l'URL contenga http:// o https://
 */
export const sanitizeResourceUrl = (url = '') => {
  let clean = (url || '').trim();
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean;
};
