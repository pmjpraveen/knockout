import { isDate } from '@/lib/events';

export const belts = ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'] as const;
export const athleteGenders = ['male', 'female'] as const;

export type AthleteDraft = {
  full_name: string;
  date_of_birth: string;
  gender: (typeof athleteGenders)[number];
  weight: string;
  belt_rank: string;
};

export const emptyAthlete: AthleteDraft = { full_name: '', date_of_birth: '', gender: 'male', weight: '', belt_rank: 'white' };

export function athleteProblem(a: AthleteDraft) {
  if (!a.full_name.trim()) return 'Enter the athlete’s name.';
  if (!isDate(a.date_of_birth)) return 'Enter the date of birth as DD-MM-YYYY.';
  const weight = Number(a.weight);
  if (!(weight > 0 && weight < 300)) return 'Weight must be between 0 and 300 kg.';
  return null;
}

export const toAthleteInput = (a: AthleteDraft) => ({ ...a, full_name: a.full_name.trim(), weight: Number(a.weight) });

type AthleteRow = { full_name: string; date_of_birth: string | null; gender: string | null; weight: number | null; belt_rank: string | null };

export const toDraft = (row: AthleteRow): AthleteDraft => ({
  full_name: row.full_name,
  date_of_birth: row.date_of_birth ?? '',
  gender: row.gender === 'female' ? 'female' : 'male',
  weight: row.weight === null ? '' : String(row.weight),
  belt_rank: row.belt_rank ?? 'white',
});
