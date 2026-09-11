import { COSMETICS, type ProtocolId } from './data';
import type { JournalEntryPublic } from './types';

const STORAGE_KEY = 'signal-arena.profile.v2';
const LEGACY_KEY = 'signal-arena.profile.v1';

export interface PendingReview {
  id: string;
  caseName: string;
  required: ProtocolId;
  lesson: string;
  verdict: string;
  createdAt: string;
}

export interface SettingsState {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}

export interface SaveProfile {
  runs: number;
  labs: number;
  xp: number;
  bestClarity: number;
  perfectRuns: number;
  totalMistakes: number;
  closedErrors: number;
  cosmeticDust: number;
  streakDays: number;
  lastClosedDate?: string;
  lastProof?: string;
  tutorialSeen: boolean;
  badges: string[];
  pendingReviews: PendingReview[];
  protocolMastery: Partial<Record<ProtocolId, number>>;
  ownedCosmetics: string[];
  equippedCosmetic?: string;
  settings: SettingsState;
}

export interface RunSummary {
  clarity: number;
  maxClarity: number;
  composure: number;
  pressure: number;
  journal: JournalEntryPublic[];
}

export const DEFAULT_PROFILE: SaveProfile = {
  runs: 0,
  labs: 0,
  xp: 0,
  bestClarity: 0,
  perfectRuns: 0,
  totalMistakes: 0,
  closedErrors: 0,
  cosmeticDust: 0,
  streakDays: 0,
  tutorialSeen: false,
  badges: [],
  pendingReviews: [],
  protocolMastery: {},
  ownedCosmetics: ['archive-default'],
  equippedCosmetic: 'archive-default',
  settings: {
    sound: true,
    haptics: true,
    reducedMotion: false
  }
};

export function loadProfile(): SaveProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return cloneDefault();
    const parsed = JSON.parse(raw) as Partial<SaveProfile>;
    return normalizeProfile(parsed);
  } catch {
    return cloneDefault();
  }
}

export function saveProfile(profile: SaveProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProfile(profile)));
  } catch {
    // Private mode or disabled storage should never break the game loop.
  }
}

export function resetProfile(): SaveProfile {
  const next = cloneDefault();
  saveProfile(next);
  return next;
}

export function persistRun(profile: SaveProfile, summary: RunSummary): SaveProfile {
  const mistakes = summary.journal.filter((entry) => !entry.success);
  const perfect = summary.clarity === summary.maxClarity;
  const survived = summary.composure > 0;
  const xpGain = summary.clarity * 130 + summary.composure * 45 + (perfect ? 260 : 0) + (survived ? 120 : 0);
  const dustGain = 30 + summary.clarity * 10 + (perfect ? 55 : 0);
  const today = localDate();

  const mastery = { ...profile.protocolMastery };
  for (const entry of summary.journal) {
    if (entry.success) {
      mastery[entry.required] = (mastery[entry.required] ?? 0) + 1;
    }
  }

  const pending = [
    ...profile.pendingReviews,
    ...mistakes.map((entry, index): PendingReview => ({
      id: `${today}-${profile.runs + 1}-${index}-${entry.required}`,
      caseName: entry.caseName,
      required: entry.required,
      lesson: entry.lesson,
      verdict: entry.verdict,
      createdAt: today
    }))
  ].slice(-12);

  const next: SaveProfile = normalizeProfile({
    ...profile,
    runs: profile.runs + 1,
    xp: profile.xp + xpGain,
    bestClarity: Math.max(profile.bestClarity, summary.clarity),
    perfectRuns: profile.perfectRuns + (perfect ? 1 : 0),
    totalMistakes: profile.totalMistakes + mistakes.length,
    cosmeticDust: profile.cosmeticDust + dustGain,
    lastProof: proofId(summary, profile.runs + 1),
    pendingReviews: pending,
    protocolMastery: mastery,
    badges: [...profile.badges]
  });

  award(next, 'ARCHIVE_ASSISTANT', true);
  award(next, 'NO_TERMINAL_DISCIPLINE', summary.journal.length >= 5 && survived);
  award(next, 'PERFECT_PROTOCOL', perfect);
  award(next, 'THREE_RAIDS', next.runs >= 3);

  if (mistakes.length === 0 && perfect) {
    next.lastClosedDate = today;
    next.streakDays = updateStreak(profile.lastClosedDate, profile.streakDays, today);
  }

  saveProfile(next);
  return next;
}

export function completeReview(profile: SaveProfile, reviewId: string): SaveProfile {
  const review = profile.pendingReviews.find((item) => item.id === reviewId);
  if (!review) return profile;

  const today = localDate();
  const mastery = { ...profile.protocolMastery };
  mastery[review.required] = (mastery[review.required] ?? 0) + 1;

  const next = normalizeProfile({
    ...profile,
    xp: profile.xp + 85,
    closedErrors: profile.closedErrors + 1,
    cosmeticDust: profile.cosmeticDust + 18,
    lastClosedDate: today,
    streakDays: updateStreak(profile.lastClosedDate, profile.streakDays, today),
    pendingReviews: profile.pendingReviews.filter((item) => item.id !== reviewId),
    protocolMastery: mastery,
    badges: [...profile.badges]
  });

  award(next, 'FIRST_CLOSED_ERROR', next.closedErrors > 0);
  award(next, 'REVIEWER', next.closedErrors >= 3);

  saveProfile(next);
  return next;
}

export function persistLab(profile: SaveProfile, success: boolean, protocol?: ProtocolId): SaveProfile {
  const mastery = { ...profile.protocolMastery };
  if (success && protocol) {
    mastery[protocol] = (mastery[protocol] ?? 0) + 1;
  }

  const next = normalizeProfile({
    ...profile,
    labs: profile.labs + 1,
    xp: profile.xp + (success ? 70 : 25),
    cosmeticDust: profile.cosmeticDust + (success ? 12 : 4),
    protocolMastery: mastery,
    badges: [...profile.badges]
  });

  award(next, 'LAB_RAT', next.labs >= 1);
  saveProfile(next);
  return next;
}

export function buyCosmetic(profile: SaveProfile, cosmeticId: string): SaveProfile {
  const item = COSMETICS.find((candidate) => candidate.id === cosmeticId);
  if (!item || profile.ownedCosmetics.includes(cosmeticId) || profile.cosmeticDust < item.price) {
    return profile;
  }

  const next = normalizeProfile({
    ...profile,
    cosmeticDust: profile.cosmeticDust - item.price,
    ownedCosmetics: [...profile.ownedCosmetics, cosmeticId],
    equippedCosmetic: cosmeticId
  });
  saveProfile(next);
  return next;
}

export function equipCosmetic(profile: SaveProfile, cosmeticId: string): SaveProfile {
  if (!profile.ownedCosmetics.includes(cosmeticId)) return profile;
  const next = normalizeProfile({
    ...profile,
    equippedCosmetic: cosmeticId
  });
  saveProfile(next);
  return next;
}

export function markTutorialSeen(profile: SaveProfile): SaveProfile {
  const next = normalizeProfile({
    ...profile,
    tutorialSeen: true,
    xp: profile.xp + (profile.tutorialSeen ? 0 : 40),
    badges: [...profile.badges]
  });
  award(next, 'ARCHIVE_ASSISTANT', true);
  saveProfile(next);
  return next;
}

export function setSettings(profile: SaveProfile, settings: Partial<SettingsState>): SaveProfile {
  const next = normalizeProfile({
    ...profile,
    settings: {
      ...profile.settings,
      ...settings
    }
  });
  saveProfile(next);
  return next;
}

function normalizeProfile(input: Partial<SaveProfile>): SaveProfile {
  return {
    ...cloneDefault(),
    ...input,
    badges: Array.isArray(input.badges) ? input.badges : [],
    pendingReviews: Array.isArray(input.pendingReviews) ? input.pendingReviews.slice(-12) : [],
    protocolMastery: input.protocolMastery && typeof input.protocolMastery === 'object' ? input.protocolMastery : {},
    ownedCosmetics: Array.isArray(input.ownedCosmetics) && input.ownedCosmetics.length > 0 ? input.ownedCosmetics : ['archive-default'],
    equippedCosmetic: input.equippedCosmetic ?? 'archive-default',
    settings: {
      ...DEFAULT_PROFILE.settings,
      ...(input.settings ?? {})
    }
  };
}

function cloneDefault(): SaveProfile {
  return {
    ...DEFAULT_PROFILE,
    badges: [],
    pendingReviews: [],
    protocolMastery: {},
    ownedCosmetics: ['archive-default'],
    equippedCosmetic: 'archive-default',
    settings: { ...DEFAULT_PROFILE.settings }
  };
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
  const payload = `${runNumber}|${summary.clarity}|${summary.composure}|${summary.pressure}|${summary.journal
    .map((entry) => `${entry.caseName}:${entry.chosen}:${entry.required}:${entry.success ? 1 : 0}`)
    .join(';')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `SA-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}
