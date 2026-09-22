import { dateToIso, formatDate, isoToDate } from './events.ts';

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const sideLabel: Record<string, string> = {
  repechage_top: 'Repechage',
  repechage_bottom: 'Repechage',
  grand_final: 'Grand final',
  reset: 'Bracket reset',
};

export function matchLabel(side: string, round: number) {
  if (sideLabel[side]) return sideLabel[side];
  if (side === 'winners') return `Winners round ${round}`;
  if (side === 'losers') return `Losers round ${round}`;
  return `Round ${round}`;
}

export const queueLabels = ['Current', 'On deck', 'Up next'];

/** Every day the event runs, plus any other day a category is already on (the dates may have been edited), earliest first. */
export function eventDays(start: string | null, end: string | null, others: (string | null)[] = []) {
  const days = new Set(others.filter((day): day is string => !!day));
  if (start && end) {
    const cursor = isoToDate(start);
    for (let i = 0; i < 62 && dateToIso(cursor) <= end; i++) { // ponytail: two months, so bad dates cannot make a huge list
      days.add(dateToIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return [...days].sort();
}

/** "Day 2 · 11-01-2027" for each day, keyed by its ISO date. */
export const dayLabels = (days: string[]) => Object.fromEntries(days.map((day, index) => [day, `Day ${index + 1} · ${formatDate(day)}`]));

/** The day being run: the earliest one that still has matches, else the first day. */
export const currentDay = (days: string[], matchDays: (string | null)[]) => matchDays.filter((day): day is string => !!day).sort()[0] ?? days[0] ?? null;
