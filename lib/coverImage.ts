import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export const coverAspect = 3 / 2;

/** A cover as JPEG data URIs: the full image for the event page and a small copy for lists. */
export type Cover = { image: string; thumb: string };

const jpeg = async (uri: string, width: number, compress: number) => {
  const { base64 } = await manipulateAsync(uri, [{ resize: { width } }], { compress, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${base64}`;
};

/** Lets the person choose a photo and returns it resized, or null if they backed out. */
export async function pickCover(): Promise<Cover | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 2], quality: 1 });
  if (picked.canceled) return null;
  const { uri } = picked.assets[0];
  return { image: await jpeg(uri, 1200, 0.6), thumb: await jpeg(uri, 720, 0.5) };
}

/** Stores, replaces or (with null) removes an event's cover image. */
export function saveCover(eventId: string, cover: Cover | null) {
  return cover
    ? supabase.from('event_covers').upsert({ event_id: eventId, ...cover, updated_at: new Date().toISOString() })
    : supabase.from('event_covers').delete().eq('event_id', eventId);
}
