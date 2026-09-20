import * as DocumentPicker from 'expo-document-picker';

const types = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
];

const maxBytes = 5 * 1024 * 1024; // a list of a thousand athletes is well under 1 MB

/** Lets the person choose an Excel or CSV file and returns its name and bytes, or null if they backed out. */
export async function pickSheet() {
  const picked = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (picked.canceled) return null;
  const { uri, name } = picked.assets[0];
  const bytes = await (await fetch(uri)).arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error('File too large');
  return { name, bytes };
}
