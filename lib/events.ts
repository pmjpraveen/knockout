import type { Tables } from '@/lib/database.types';

export type EventRow = Tables<'events'>;
export type CategoryRow = Tables<'categories'>;

export const disciplines = ['kumite', 'kata', 'team'] as const;
export const genders = ['any', 'male', 'female', 'mixed'] as const;
export const bracketFormats = ['single_elim_repechage', 'round_robin', 'double_elim'] as const;

/** Scoring modes each discipline can use; the first is the default. */
export const scoringModes = {
  kumite: ['kumite_points', 'win_loss'],
  kata: ['kata_scores', 'kata_flags', 'win_loss'],
  team: ['win_loss'],
} as const;

export const criteriaColumns =
  'label, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max, bracket_format, scoring_mode, match_seconds, judge_panel';

/** Forward-only event lifecycle; "Completed" goes through the complete_event RPC. */
export const nextEventStep: Partial<Record<string, { status: string; action: string }>> = {
  draft: { status: 'registration_open', action: 'Open registration' },
  registration_open: { status: 'registration_closed', action: 'Close registration' },
  registration_closed: { status: 'in_progress', action: 'Start event' },
  in_progress: { status: 'completed', action: 'Complete event' },
};

/** Structure can change until the event starts; after that it is running or archived. */
export function isEditable(status: string) {
  return status in initialCategoryStatus;
}

/** New categories join the event's registration state. */
export const initialCategoryStatus = {
  draft: 'draft',
  registration_open: 'open',
  registration_closed: 'closed',
} as const;

export const humanize = (value: string) => {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const toNumber = (text: string) => (text.trim() === '' ? null : Number(text));

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
/** True for a real calendar date in ISO form (YYYY-MM-DD), which is how dates are stored. */
export function isDate(text: string) {
  if (!dateOnly.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}
export const dateOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');

// The app shows and accepts dates as DD-MM-YYYY; storage and the API stay ISO.
export const formatDate = (iso: string) => (isDate(iso) ? iso.split('-').reverse().join('-') : iso);
export const formatDateTime = (timestamp: string) => {
  const at = new Date(timestamp);
  return `${formatDate(dateOf(timestamp))} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};
/** DD-MM-YYYY to ISO, or null when it is not a real date. */
export function parseDate(text: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  return isDate(iso) ? iso : null;
}
/** Live input mask: keeps digits and inserts the dashes of DD-MM-YYYY. */
export function maskDate(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('-');
}
export const dateToIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** Noon local time, so a picker never shifts the day across a timezone boundary. */
export const isoToDate = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12);
export const startOfDay = (text: string) => (isDate(text) ? new Date(`${text}T00:00:00`).toISOString() : null);
export const endOfDay = (text: string) => (isDate(text) ? new Date(`${text}T23:59:59`).toISOString() : null);

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayAndMonth = (iso: string, withYear: boolean) => `${Number(iso.slice(8))} ${months[Number(iso.slice(5, 7)) - 1]}${withYear ? ` ${iso.slice(0, 4)}` : ''}`;

/** "12 Oct - 14 Oct" for cards; the year is added only when it is not this year. A draft may have no dates yet. */
export function formatDateRange(start: string | null, end: string | null, thisYear = new Date().getFullYear()) {
  if (!start || !end) return 'Dates not set';
  const withYear = [start, end].some((iso) => iso.slice(0, 4) !== String(thisYear));
  const [from, to] = [start, end].map((iso) => dayAndMonth(iso, withYear));
  return from === to ? from : `${from} - ${to}`;
}

type EventInput = { name: string; venue: string; hostClub: string; startDate: string; endDate: string; opens: string; closes: string };

/** The first problem with an event's dates, or null. The registration window is optional. */
export function validateEventDates({ startDate, endDate, opens, closes }: Pick<EventInput, 'startDate' | 'endDate' | 'opens' | 'closes'>) {
  if (![startDate, endDate].every(isDate) || [opens, closes].some((d) => d && !isDate(d))) return 'Enter dates as DD-MM-YYYY.';
  if (endDate < startDate) return 'The end date is before the start date.';
  if (opens && closes && closes < opens) return 'Registration closes before it opens.';
  return null;
}

/** The events columns for what the create and edit forms collect. */
export const eventFields = ({ name, venue, hostClub, startDate, endDate, opens, closes }: EventInput) => ({
  name: name.trim(),
  venue: venue.trim() || null,
  host_club: hostClub.trim() || null,
  start_date: isDate(startDate) ? startDate : null,
  end_date: isDate(endDate) ? endDate : null,
  registration_opens_at: startOfDay(opens),
  registration_closes_at: endOfDay(closes),
});
