import type { Parsed } from './categoryImport.ts';
import type { SheetRow } from './sheetRows.ts';
import { matchBelt, pick, simplify, toIsoDate } from './sheetRows.ts';

export type AthleteImport = { club_name: string; full_name: string; date_of_birth: string; gender: string; weight: number; belt_rank: string; disciplines: string[] };

const genderOf: Record<string, string> = { male: 'male', m: 'male', female: 'female', f: 'female' };
const disciplinesOf: Record<string, string[]> = {
  '': ['kumite', 'kata'],
  both: ['kumite', 'kata'],
  kumiteandkata: ['kumite', 'kata'],
  kumitekata: ['kumite', 'kata'],
  kataandkumite: ['kumite', 'kata'],
  kumite: ['kumite'],
  kumiteonly: ['kumite'],
  kata: ['kata'],
  kataonly: ['kata'],
};

/** The columns of the participants sheet, in order, with two example rows. */
export const athleteColumns = ['Club', 'Athlete name', 'Date of birth (DD-MM-YYYY)', 'Gender', 'Weight (kg)', 'Belt', 'Events (Kumite, Kata or Both)'];
export const athleteExamples = (belts: readonly string[]) => [
  ['Example Dojo', 'Aiko Tanaka', '14-03-2013', 'Female', '38.5', belts[Math.min(2, belts.length - 1)], 'Both'],
  ['Example Dojo', 'Ken Sato', '02-11-2011', 'Male', '42', belts[Math.min(3, belts.length - 1)], 'Kumite'],
];
export const athleteNotes = (belts: readonly string[]) => [
  ['Column', 'What to enter'],
  ['Club', 'The club or dojo name. One sheet can hold many clubs'],
  ['Athlete name', 'Full name'],
  ['Date of birth', 'DD-MM-YYYY, for example 14-03-2013'],
  ['Gender', 'Male or Female'],
  ['Weight (kg)', 'A number, for example 38.5'],
  ['Belt', `One of this event's belts: ${belts.join(', ')}`],
  ['Events', 'Kumite, Kata or Both. Empty means both'],
  ['Note', 'Delete the two example rows before you upload'],
];

/** The sheet a single club fills in on the registration page: the same, without the Club column. */
export const rosterColumns = athleteColumns.slice(1);
export const rosterExamples = (belts: readonly string[]) => athleteExamples(belts).map((row) => row.slice(1));
export const rosterNotes = (belts: readonly string[]) => athleteNotes(belts).filter(([column]) => column !== 'Club');

function parseRow({ cells }: SheetRow, today: string, clubRequired: boolean, belts: readonly string[]): AthleteImport | string {
  const club_name = pick(cells, ['club', 'clubname', 'dojo']).trim();
  const full_name = pick(cells, ['athletename', 'name', 'fullname', 'athlete']).trim();
  if (clubRequired && !club_name) return 'The club is missing.';
  if (!full_name) return 'The athlete name is missing.';
  if (club_name.length > 120 || full_name.length > 120) return 'A name is longer than 120 characters.';

  const date_of_birth = toIsoDate(pick(cells, ['dateofbirthddmmyyyy', 'dateofbirth', 'dob', 'birthdate']));
  if (!date_of_birth || date_of_birth > today) return 'Date of birth must be a past date as DD-MM-YYYY.';
  const gender = genderOf[simplify(pick(cells, ['gender', 'sex']))];
  if (!gender) return 'Gender must be Male or Female.';
  const weight = Number(pick(cells, ['weightkg', 'weight']));
  if (!(weight > 0 && weight < 300)) return 'Weight must be a number between 0 and 300 kg.';
  const belt_rank = matchBelt(pick(cells, ['belt', 'beltrank']), belts);
  if (!belt_rank) return `Belt must be from this event's list: ${belts.join(', ')}.`;
  const disciplines = disciplinesOf[simplify(pick(cells, ['eventskumitekataorboth', 'events', 'compete', 'discipline']))];
  if (!disciplines) return 'Events must be Kumite, Kata or Both.';
  return { club_name, full_name, date_of_birth, gender, weight, belt_rank, disciplines };
}

/** Turns sheet rows into participants, and lists the rows that cannot be used, by their line in the file. */
export function parseAthleteRows(rows: SheetRow[], belts: readonly string[], clubRequired = true, today = new Date().toISOString().slice(0, 10)): Parsed<AthleteImport> {
  const parsed: Parsed<AthleteImport> = { items: [], problems: [] };
  for (const row of rows) {
    const result = parseRow(row, today, clubRequired, belts);
    if (typeof result === 'string') parsed.problems.push({ line: row.line, message: result });
    else parsed.items.push(result);
  }
  return parsed;
}
