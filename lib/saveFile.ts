import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes a file to the app's cache and opens the share sheet, so it can be saved to Files, mailed or opened in Excel. */
export async function saveFile(name: string, bytes: Uint8Array, mime: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}
