import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseAthleteRows } from './athleteImport.ts';
import { parseCategoryRows } from './categoryImport.ts';
import { readSheet, sheetErrorMessage, toIsoDate } from './sheetRows.ts';

assert.equal(toIsoDate('14-03-2013'), '2013-03-14');
assert.equal(toIsoDate('4/3/2013'), '2013-03-04', 'day first, as the app writes dates');
assert.equal(toIsoDate('2013-03-14'), '2013-03-14');
assert.equal(toIsoDate('31-02-2013'), null, 'not a real date');
assert.equal(toIsoDate('March 14'), null);

const belts = ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'];
const row = (line: number, cells: Record<string, string>) => ({ line, cells });

const categories = parseCategoryRows([
  row(2, { discipline: 'Kumite', gender: 'Male', agemin: '10', agemax: '12', weightmax: '40', beltmin: 'White', beltmax: 'Green Belt', bracketformat: 'Round robin' }),
  row(3, { discipline: 'kata', gender: '', label: 'Open kata' }),
  row(4, { discipline: 'sparring' }),
  row(5, { discipline: 'kumite', agemin: '15', agemax: '12' }),
  row(6, { discipline: 'kumite', beltmin: 'black', beltmax: 'white' }),
  row(7, { discipline: 'kata', label: 'open KATA' }),
], belts);
assert.equal(categories.items.length, 2);
assert.equal(categories.items[0].label, 'Kumite Male 10–12y -40kg white–green', 'a label is built when none is given');
assert.equal(categories.items[0].bracket_format, 'round_robin');
assert.equal(categories.items[1].bracket_format, 'single_elim_repechage', 'empty means the default format');
assert.deepEqual(categories.problems.map((p) => p.line), [4, 5, 6, 7], 'problems are reported by file line');
assert.match(categories.problems[3].message, /Same category as line 3/);

const athletes = parseAthleteRows(
  [
    row(2, { club: 'Dojo A', athletename: 'Aiko Tanaka', dateofbirthddmmyyyy: '14-03-2013', gender: 'F', weightkg: '38.5', belt: 'Orange belt' }),
    row(3, { club: 'Dojo A', name: 'No Date', dob: '', gender: 'male', weight: '40', belt: 'green' }),
    row(4, { club: 'Dojo B', name: 'Future Kid', dob: '01-01-2031', gender: 'male', weight: '40', belt: 'green' }),
    row(5, { club: '', name: 'No Club', dob: '01-01-2012', gender: 'male', weight: '40', belt: 'green' }),
    row(6, { club: 'Dojo B', name: 'Heavy', dob: '01-01-2012', gender: 'male', weight: '400', belt: 'green' }),
    row(7, { club: 'Dojo B', name: 'Pink Belt', dob: '01-01-2012', gender: 'male', weight: '40', belt: 'pink' }),
    row(8, { club: 'Dojo A', name: 'Kata Only', dob: '01-01-2012', gender: 'male', weight: '40', belt: 'green', events: 'Kata' }),
    row(9, { club: 'Dojo A', name: 'Bad Events', dob: '01-01-2012', gender: 'male', weight: '40', belt: 'green', events: 'sumo' }),
  ],
  belts,
  true,
  '2026-09-19',
);
assert.deepEqual(athletes.items.map((a) => [a.full_name, a.belt_rank, a.disciplines]), [['Aiko Tanaka', 'orange', ['kumite', 'kata']], ['Kata Only', 'green', ['kata']]]);
assert.deepEqual(athletes.problems.map((p) => p.line), [3, 4, 5, 6, 7, 9]);

// a club's own list has no Club column
const roster = parseAthleteRows([row(2, { name: 'Aiko Tanaka', dob: '14-03-2013', gender: 'F', weight: '38.5', belt: 'orange' })], belts, false, '2026-09-19');
assert.equal(roster.problems.length, 0, 'the club is not required on a club\'s own list');
assert.equal(roster.items[0].club_name, '');

// real files: header spellings vary, empty rows are dropped, and a date cell arrives as a date in .xlsx.
// A date written into a CSV by Excel loses its format (3/14/13), so the template asks for text dates there.
const header = ['CLUB', 'Athlete Name', 'Date of birth', 'Gender', 'Weight (kg)', 'Belt'];
const bookOf = (firstDate: Date | string) => {
  const sheet = XLSX.utils.aoa_to_sheet([header, ['Dojo A', 'Aiko Tanaka', firstDate, 'Female', 38.5, 'Orange'], [], ['Dojo B', 'Ken Sato', '02-11-2011', 'Male', 42, 'Green']], { cellDates: true });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Participants');
  return book;
};
for (const [bookType, date] of [['xlsx', new Date(2013, 2, 14)], ['csv', '14-03-2013']] as const) {
  const rows = await readSheet(XLSX.write(bookOf(date), { type: 'array', bookType }));
  const parsed = parseAthleteRows(rows, belts, true, '2026-09-19');
  assert.equal(parsed.problems.length, 0, `${bookType}: no problems (${JSON.stringify(parsed.problems)})`);
  assert.deepEqual(parsed.items.map((a) => [a.full_name, a.date_of_birth]), [['Aiko Tanaka', '2013-03-14'], ['Ken Sato', '2011-11-02']], `${bookType}: rows and dates`);
  assert.deepEqual(rows.map((r) => r.line), [2, 4], `${bookType}: the empty row is dropped but line numbers still match the file`);
}

const custom = parseAthleteRows([row(2, { club: 'Dojo A', name: 'Kid', dob: '01-01-2015', gender: 'male', weight: '30', belt: 'Green Stripe belt' })], ['white', 'green stripe'], true, '2026-09-19');
assert.equal(custom.items[0].belt_rank, 'green stripe', "a dojo's own belt names are matched");
// a workbook whose first sheet is empty is read from the sheet that has the data
const twoSheets = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet([]), 'Empty');
XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet([['Discipline'], ['Kumite']]), 'Data');
assert.equal((await readSheet(XLSX.write(twoSheets, { type: 'array', bookType: 'xlsx' }))).length, 1, 'the empty first sheet is skipped');

assert.match(sheetErrorMessage(new Error('File is password-protected')), /password-protected/);
assert.match(sheetErrorMessage(new Error('File too large')), /over 5 MB/);
assert.match(sheetErrorMessage(new Error('Unsupported file')), /could not be read \(Unsupported file\)/, 'an unknown failure says why');
console.log('sheetImport ok');
