import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** No pop-up blocker to dodge on native, so there is nothing to open ahead of time. */
export const openExportWindow = () => null;

/** Renders the HTML to a PDF and opens the share sheet, so it can be saved to Files, mailed or printed. */
export async function exportPdf(name: string, html: string, _target: null) {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: name, UTI: 'com.adobe.pdf' });
}
