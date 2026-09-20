import { isDate } from '@/lib/events';

/** The belt ladder a new event starts with. An event's own list (set by the organizer) replaces it. */
export const standardBelts = ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'];
export const athleteGenders = ['male', 'female'] as const;

/** What a participant enters: kumite, kata or both. */
export const competeOptions = ['kumite', 'kata', 'both'] as const;
export type Compete = (typeof competeOptions)[number];
export const competeLabels: Record<Compete, string> = { kumite: 'Kumite only', kata: 'Kata only', both: 'Kumite and kata' };
export const toDisciplines = (compete: Compete) => (compete === 'both' ? ['kumite', 'kata'] : [compete]);
export const toCompete = (disciplines: string[] | null | undefined): Compete =>
  disciplines?.length === 1 && (disciplines[0] === 'kumite' || disciplines[0] === 'kata') ? disciplines[0] : 'both';

export type AthleteDraft = {
  full_name: string;
  date_of_birth: string;
  gender: (typeof athleteGenders)[number];
  weight: string;
  belt_rank: string;
  compete: Compete;
};

/** A new participant, on the first belt of the event's list. */
export const newAthlete = (belts: readonly string[] = standardBelts): AthleteDraft => ({ full_name: '', date_of_birth: '', gender: 'male', weight: '', belt_rank: belts[0], compete: 'both' });
export const isBlank = (a: AthleteDraft) => !a.full_name.trim() && !a.date_of_birth && !a.weight;

export function athleteProblem(a: AthleteDraft) {
  if (!a.full_name.trim()) return 'Enter the athlete’s name.';
  if (!isDate(a.date_of_birth)) return 'Enter the date of birth as DD-MM-YYYY.';
  const weight = Number(a.weight);
  if (!(weight > 0 && weight < 300)) return 'Weight must be between 0 and 300 kg.';
  return null;
}

export const toAthleteInput = ({ compete, ...a }: AthleteDraft) => ({ ...a, full_name: a.full_name.trim(), weight: Number(a.weight), disciplines: toDisciplines(compete) });

type AthleteRow = { full_name: string; date_of_birth: string | null; gender: string | null; weight: number | null; belt_rank: string | null; disciplines?: string[] | null };

export const toDraft = (row: AthleteRow): AthleteDraft => ({
  full_name: row.full_name,
  date_of_birth: row.date_of_birth ?? '',
  gender: row.gender === 'female' ? 'female' : 'male',
  weight: row.weight === null ? '' : String(row.weight),
  belt_rank: row.belt_rank ?? standardBelts[0],
  compete: toCompete(row.disciplines),
});
