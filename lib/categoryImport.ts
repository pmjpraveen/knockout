import { defaultLabel } from './categoryLabel.ts';
import type { SheetRow } from './sheetRows.ts';
import { matchBelt, pick, simplify } from './sheetRows.ts';

export type CategoryImport = {
  label: string;
  discipline: string;
  gender: string | null;
  age_min: number | null;
  age_max: number | null;
  weight_min: number | null;
  weight_max: number | null;
  belt_min: string | null;
  belt_max: string | null;
  bracket_format: string;
};

export type Problem = { line: number; message: string };
export type Parsed<T> = { items: T[]; problems: Problem[] };

const disciplines = ['kumite', 'kata', 'team'];
const genderOf: Record<string, string | null> = { '': null, any: null, all: null, male: 'male', m: 'male', female: 'female', f: 'female', mixed: 'mixed' };
const formatOf: Record<string, string> = {
  '': 'single_elim_repechage',
  singleelimrepechage: 'single_elim_repechage',
  singleelimination: 'single_elim_repechage',
  singleeliminationrepechage: 'single_elim_repechage',
  repechage: 'single_elim_repechage',
  singleelim: 'single_elim',
  singleelimnorepechage: 'single_elim',
  singleeliminationnorepechage: 'single_elim',
  singleelimsemisshare3rd: 'single_elim',
  roundrobin: 'round_robin',
  doubleelim: 'double_elim',
  doubleelimination: 'double_elim',
};

/** The columns of the categories sheet, in order, with two example rows. */
export const categoryColumns = ['Discipline', 'Gender', 'Age min', 'Age max', 'Weight min (kg)', 'Weight max (kg)', 'Belt min', 'Belt max', 'Bracket format', 'Label (optional)'];
export const categoryExamples = (belts: readonly string[]) => [
  ['Kumite', 'Male', '10', '12', '', '40', belts[0], belts[Math.min(2, belts.length - 1)], 'Single elimination', ''],
  ['Kata', 'Female', '18', '', '', '', '', '', '', 'Senior women kata'],
];
export const categoryNotes = (belts: readonly string[]) => [
  ['Column', 'What to enter'],
  ['Discipline', 'Kumite, Kata or Team (required)'],
  ['Gender', 'Male, Female or Mixed. Leave empty for any gender'],
  ['Age min / Age max', 'Whole years on the first day of the tournament. Leave empty for no limit'],
  ['Weight min / max (kg)', 'Numbers. Leave empty for no limit'],
  ['Belt min / max', `One of this event's belts, lowest first: ${belts.join(', ')}. Leave empty for any belt`],
  ['Bracket format', 'Single elimination, Single elimination (no repechage), Round robin or Double elimination. Empty means single elimination'],
  ['Label (optional)', 'The name shown for the category. Empty builds one from the other columns'],
  ['Note', 'Delete the two example rows before you upload'],
];

const number = (text: string, what: string, max: number) => {
  if (text === '') return { value: null };
  const value = Number(text);
  return value >= 0 && value <= max ? { value } : { error: `${what} must be a number from 0 to ${max}.` };
};

function parseRow({ cells }: SheetRow, belts: readonly string[]): CategoryImport | string {
  const discipline = simplify(pick(cells, ['discipline']));
  if (!disciplines.includes(discipline)) return 'Discipline must be Kumite, Kata or Team.';
  const gender = genderOf[simplify(pick(cells, ['gender']))];
  if (gender === undefined) return 'Gender must be Male, Female or Mixed, or empty.';

  const fields = {
    age_min: number(pick(cells, ['agemin']), 'Age min', 120),
    age_max: number(pick(cells, ['agemax']), 'Age max', 120),
    weight_min: number(pick(cells, ['weightmin', 'weightminkg']), 'Weight min', 300),
    weight_max: number(pick(cells, ['weightmax', 'weightmaxkg']), 'Weight max', 300),
  };
  for (const field of Object.values(fields)) if ('error' in field) return field.error as string;
  const [ageMin, ageMax, weightMin, weightMax] = Object.values(fields).map((field) => field.value ?? null);
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) return 'Age min is above age max.';
  if (weightMin !== null && weightMax !== null && weightMin > weightMax) return 'Weight min is above weight max.';

  const typedBelts = [pick(cells, ['beltmin']), pick(cells, ['beltmax'])];
  const [beltMin, beltMax] = typedBelts.map((text) => (text ? matchBelt(text, belts) : null));
  if (typedBelts.some((text, index) => text && [beltMin, beltMax][index] === null)) return `Belts must be from this event's list: ${belts.join(', ')}.`;
  if (beltMin && beltMax && belts.indexOf(beltMin) > belts.indexOf(beltMax)) return 'Belt min is above belt max.';

  const bracket_format = formatOf[simplify(pick(cells, ['bracketformat', 'format']))];
  if (!bracket_format) return 'Bracket format must be Single elimination, Single elimination (no repechage), Round robin or Double elimination.';

  const criteria = { discipline, gender, age_min: ageMin, age_max: ageMax, weight_min: weightMin, weight_max: weightMax, belt_min: beltMin, belt_max: beltMax };
  const label = pick(cells, ['label', 'labeloptional', 'name']).trim() || defaultLabel(criteria);
  return label.length > 120 ? 'The label is longer than 120 characters.' : { ...criteria, label, bracket_format };
}

/** Turns sheet rows into categories, and lists the rows that cannot be used, by their line in the file. */
export function parseCategoryRows(rows: SheetRow[], belts: readonly string[]): Parsed<CategoryImport> {
  const items: CategoryImport[] = [];
  const problems: Problem[] = [];
  const seen = new Map<string, number>();
  for (const row of rows) {
    const parsed = parseRow(row, belts);
    if (typeof parsed === 'string') {
      problems.push({ line: row.line, message: parsed });
      continue;
    }
    const first = seen.get(parsed.label.toLowerCase());
    if (first !== undefined) {
      problems.push({ line: row.line, message: `Same category as line ${first}.` });
      continue;
    }
    seen.set(parsed.label.toLowerCase(), row.line);
    items.push(parsed);
  }
  return { items, problems };
}
