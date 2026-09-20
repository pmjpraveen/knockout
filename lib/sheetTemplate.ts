import { athleteColumns, athleteExamples, athleteNotes, rosterColumns, rosterExamples, rosterNotes } from './athleteImport.ts';
import { categoryColumns, categoryExamples, categoryNotes } from './categoryImport.ts';

export type TemplateKind = 'categories' | 'participants' | 'roster';
export type TemplateFormat = 'xlsx' | 'csv';

const templates = {
  categories: { file: 'knockout-categories-template', sheet: 'Categories', columns: categoryColumns, examples: categoryExamples, notes: categoryNotes },
  participants: { file: 'knockout-participants-template', sheet: 'Participants', columns: athleteColumns, examples: athleteExamples, notes: athleteNotes },
  roster: { file: 'knockout-participants-list-template', sheet: 'Participants', columns: rosterColumns, examples: rosterExamples, notes: rosterNotes },
};

const mimes = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv' };

/** The downloadable sample sheet: a header row, two example rows and, in .xlsx, a second sheet explaining each column. `belts` are the event's own. */
export async function buildTemplate(kind: TemplateKind, format: TemplateFormat, belts: readonly string[]) {
  const XLSX = await import('xlsx');
  const template = templates[kind];
  const book = XLSX.utils.book_new();

  const data = XLSX.utils.aoa_to_sheet([template.columns, ...template.examples(belts)]);
  data['!cols'] = template.columns.map((column) => ({ wch: Math.max(column.length + 2, 14) }));
  XLSX.utils.book_append_sheet(book, data, template.sheet);

  if (format === 'xlsx') {
    const notes = XLSX.utils.aoa_to_sheet(template.notes(belts));
    notes['!cols'] = [{ wch: 24 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(book, notes, 'How to fill');
  }
  const bytes = new Uint8Array(XLSX.write(book, { type: 'array', bookType: format }));
  return { name: `${template.file}.${format}`, mime: mimes[format], bytes };
}
