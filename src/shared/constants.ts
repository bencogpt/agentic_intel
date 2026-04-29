// constants.ts — Shared constants for AVAR

export const MAX_CONCURRENT_AGENTS = 5;

export const AUTOSAVE_INTERVAL_MS = 60_000; // 60 seconds

export const SOURCE_TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: 'אמינות גבוהה',
  2: 'אמינות בינונית',
  3: 'אמינות נמוכה',
};

export const RATING_LABELS: Record<number, string> = {
  1: 'נמוך מאוד',
  2: 'נמוך',
  3: 'בינוני',
  4: 'גבוה',
  5: 'קריטי',
};

export const LIKELIHOOD_LABELS: Record<number, string> = {
  1: 'לא סביר',
  2: 'אפשרי',
  3: 'סביר',
  4: 'סביר מאוד',
  5: 'כמעט ודאי',
};

export const SUPPORTED_EXPORT_FORMATS = ['md', 'pdf', 'docx'] as const;

export const DEFAULT_SKILLS_PATH = 'skills/default';
export const CUSTOM_SKILLS_PATH = 'skills/custom';
export const DEFAULT_AGENTS_PATH = 'agents/default';
export const CUSTOM_AGENTS_PATH = 'agents/custom';
