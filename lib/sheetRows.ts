export type SheetRow = { line: number; cells: Record<string, string> };

const keyOf = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

/** Cell values as text; a real date cell becomes YYYY-MM-DD (noon-shifted so a timezone offset cannot change the day). */
function textOf(value: unknown) {
  if (value instanceof Date) {
    const day = new Date(value.getTime() + 12 * 3600 * 1000);
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  }
  return String(value ?? '').trim();
}

/**
 * Reads the first sheet that has data from an .xlsx, .xls or .csv file. Headers are matched loosely (case, spaces and punctuation
 * ignored) and empty rows are dropped. `line` is the row number in the file, counting the header as line 1.
 */
export async function readSheet(bytes: ArrayBuffer | Uint8Array): Promise<SheetRow[]> {
  const XLSX = await import('xlsx');
  // raw: CSV cells stay text. Otherwise 02-11-2011 would be read as a US date (February 11).
  const book = XLSX.read(bytes, { type: 'array', cellDates: true, raw: true });
  const sheet = book.SheetNames.map((name) => book.Sheets[name]).find((candidate) => candidate?.['!ref']) ?? book.Sheets[book.SheetNames[0]];
  const firstLine = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1').s.r + 1; // the header sits on this line of the file
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true, blankrows: true });
  return rows
    .map((row, index) => ({ line: firstLine + 1 + index, cells: Object.fromEntries(Object.entries(row).map(([header, value]) => [keyOf(header), textOf(value)])) }))
    .filter((row) => Object.values(row.cells).some((text) => text !== ''));
}

/** What to tell the person when a chosen file fails: a plain reason for the usual causes, else the technical one so it can be reported. */
export function sheetErrorMessage(error: unknown) {
  const reason = error instanceof Error ? error.message : String(error);
  if (/password|encrypt/i.test(reason)) return 'That file is password-protected. Save a copy without a password and try again.';
  if (/too large/i.test(reason)) return 'That file is over 5 MB.';
  return `That file could not be read (${reason.slice(0, 120)}). Use an .xlsx or .csv file.`;
}

/** The first non-empty cell among the accepted header spellings, e.g. `pick(cells, ['dob', 'dateofbirth'])`. */
export const pick = (cells: Record<string, string>, keys: string[]) => keys.map((key) => cells[key]).find((text) => text) ?? '';

/** The same text with case, spaces and punctuation ignored, for comparing typed values like "Orange belt". */
export const simplify = keyOf;

/** DD-MM-YYYY (or DD/MM/YYYY) as the app writes dates, or an ISO date, into ISO; null when it is not a real date. */
export function toIsoDate(text: string) {
  const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text) ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = match[1].length === 4 ? [match[1], match[2], match[3]] : [match[3], match[2], match[1]];
  const iso = `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day) ? iso : null;
}

/** The event's own name for a belt typed in a sheet ("Orange belt", "KYU 3"), or null when it is not in the list. */
export function matchBelt(text: string, belts: readonly string[]) {
  const typed = simplify(text);
  const withoutWord = typed.replace(/belt$/, '');
  return belts.find((belt) => simplify(belt) === typed) ?? belts.find((belt) => simplify(belt) === withoutWord) ?? null;
}
