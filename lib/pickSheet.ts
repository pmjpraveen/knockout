import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const types = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
];

const base64ToBytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;

const maxBytes = 5 * 1024 * 1024; // a list of a thousand athletes is well under 1 MB

/** Lets the person choose an Excel or CSV file and returns its name and bytes, or null if they backed out. */
export async function pickSheet() {
  const picked = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (picked.canceled) return null;
  const { uri, name, file } = picked.assets[0];
  // On web the picker hands over the File itself. On a phone, fetch() cannot reliably read a picked file's path (Android
  // in particular), so the file system module reads it.
  const bytes = file ? await file.arrayBuffer() : base64ToBytes(await FileSystem.readAsStringAsync(uri, { encoding: 'base64' }));
  if (bytes.byteLength > maxBytes) throw new Error('File too large');
  return { name, bytes };
}
