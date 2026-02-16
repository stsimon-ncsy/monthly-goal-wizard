import type { GoalsByMonth, Profile } from '../types';

const PROFILE_KEY = 'mgw.profile';
const DRAFT_KEY_PREFIX = 'mgw.draft';

export function loadProfile(): Profile {
  const blank: Profile = { staffName: '', lastRegion: '', lastChapter: '' };
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return blank;

  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      staffName: parsed.staffName ?? '',
      lastRegion: parsed.lastRegion ?? '',
      lastChapter: parsed.lastChapter ?? '',
    };
  } catch {
    return blank;
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function buildDraftKey(region: string, chapter: string, staff: string, months: string[]): string {
  const scope = [region.trim(), chapter.trim(), staff.trim(), ...months].join('|');
  return `${DRAFT_KEY_PREFIX}:${scope}`;
}

export function loadDraft(key: string): GoalsByMonth | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoalsByMonth;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: GoalsByMonth): void {
  localStorage.setItem(key, JSON.stringify(draft));
}

export function clearDraft(key: string): void {
  localStorage.removeItem(key);
}
