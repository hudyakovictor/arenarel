import type { JournalEntryPublic } from './types';

const STORAGE_KEY = 'signal-arena.profile.v1';

export interface SaveProfile {
  runs: number;
  xp: number;
  bestClarity: number;
  perfectRuns: number;
  totalMistakes: number;
  closedErrors: number;
  cosmeticDust: number;
  streakDays: number;
  lastClosedDate?: string;
  lastProof?: string;
  badges: string[];
}

export interface RunSummary {
  clarity: number;
  maxClarity: number;
  composure: number;
  journal: JournalEntryPublic[];
}

export const DEFAULT_PROFILE: SaveProfile = {
  runs: 0,
  xp: 0,
  bestClarity: 0,
  perfectRuns: 0,
  totalMistakes: 0,
  closedErrors: 0,
  cosmeticDust: 0,
  streakDays: 0,
  badges: []
};

export function loadProfile(): SaveProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, badges: [] };
    const parsed = JSON.parse(raw) as Partial<SaveProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      badges: Array.isArray(parsed.badges) ? parsed.badges : []
    };
  } catch {
    return { ...DEFAULT_PROFILE, badges: [] };
  }
}

export function saveProfile(profile: SaveProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Private mode or disabled storage should never break the game loop.
  }
}

export function persistRun(profile: SaveProfile, summary: RunSummary): SaveProfile {
  const mistakes = summary.journal.filter((entry) => !entry.success).length;
  const perfect = summary.clarity === summary.maxClarity;
  const survived = summary.composure > 0;
  const xpGain = summary.clarity * 120 + mistakes * 35 + summary.composure * 30 + (perfect ? 240 : 0) + (survived ? 90 : 0);
  const dustGain = 24 + summary.clarity * 8 + (perfect ? 48 : 0);
  const today = localDate();

  const next: SaveProfile = {
    ...profile,
    runs: profile.runs + 1,
    xp: profile.xp + xpGain,
    bestClarity: Math.max(profile.bestClarity, summary.clarity),
    perfectRuns: profile.perfectRuns + (perfect ? 1 : 0),
    totalMistakes: profile.totalMistakes + mistakes,
    closedErrors: profile.closedErrors + mistakes,
    cosmeticDust: profile.cosmeticDust + dustGain,
    lastClosedDate: today,
    lastProof: proofId(summary, profile.runs + 1),
    badges: [...profile.badges]
  };

  next.streakDays = updateStreak(profile.lastClosedDate, profile.streakDays, today);

  award(next, 'ARCHIVE_ASSISTANT', true);
  award(next, 'FIRST_CLOSED_ERROR', next.closedErrors > 0);
  award(next, 'NO_TERMINAL_DISCIPLINE', summary.journal.length >= 5 && survived);
  award(next, 'PERFECT_PROTOCOL', perfect);
  award(next, 'THREE_RAIDS', next.runs >= 3);

  saveProfile(next);
  return next;
}

function localDate(): string {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function award(profile: SaveProfile, badge: string, condition: boolean): void {
  if (condition && !profile.badges.includes(badge)) {
    profile.badges.push(badge);
  }
}

function updateStreak(lastDate: string | undefined, current: number, today: string): number {
  if (!lastDate) return 1;
  if (lastDate === today) return Math.max(1, current);

  const prev = Date.parse(`${lastDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  const days = Math.round((now - prev) / 86_400_000);
  return days === 1 ? current + 1 : 1;
}

function proofId(summary: RunSummary, runNumber: number): string {
  const payload = `${runNumber}|${summary.clarity}|${summary.composure}|${summary.journal
    .map((entry) => `${entry.caseName}:${entry.chosen}:${entry.required}:${entry.success ? 1 : 0}`)
    .join(';')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `SA-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}
