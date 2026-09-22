/**
 * expo-print's web shim just calls window.print() on the current page, ignoring the HTML it's given, so the
 * report is printed from its own window instead: the browser's print dialog lets the person save it as a PDF.
 * The window must open synchronously in the click handler, before any awaited work, or browsers block it as a pop-up.
 */
export function openExportWindow() {
  return window.open('', '_blank');
}

export async function exportPdf(name: string, html: string, target: Window | null) {
  if (!target) throw new Error('Allow pop-ups for this site to export a PDF.');
  target.document.open();
  target.document.write(html);
  target.document.close();
  target.document.title = name;
  target.focus();
  target.print();
}
