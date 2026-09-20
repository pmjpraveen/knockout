import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Attempt, firstWithin } from '@/lib/fitImage';
import { supabase } from '@/lib/supabase';

export const coverAspect = 3 / 2;

/** A cover as JPEG data URIs: the full image for the event page and a small copy for lists. */
export type Cover = { image: string; thumb: string };

// The most characters the event_covers checks allow. A busy photo can exceed them at the first quality, so each
// size is tried from best to smallest until one fits.
const maxChars = { image: 400_000, thumb: 150_000 };
const imageAttempts: Attempt[] = [{ edge: 1200, quality: 0.6 }, { edge: 1000, quality: 0.5 }, { edge: 800, quality: 0.45 }, { edge: 640, quality: 0.4 }];
const thumbAttempts: Attempt[] = [{ edge: 720, quality: 0.5 }, { edge: 560, quality: 0.45 }, { edge: 480, quality: 0.4 }];

const jpeg = (uri: string, landscape: boolean) => async ({ edge, quality }: Attempt) => {
  const resize = landscape ? { width: edge } : { height: edge };
  const { base64 } = await manipulateAsync(uri, [{ resize }], { compress: quality, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${base64}`;
};

/** Lets the person choose a photo and returns it resized, or null if they backed out. */
export async function pickCover(): Promise<Cover | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 2], quality: 1 });
  if (picked.canceled) return null;
  const { uri, width, height } = picked.assets[0];
  const landscape = width >= height;
  return {
    image: await firstWithin(imageAttempts, jpeg(uri, landscape), maxChars.image),
    thumb: await firstWithin(thumbAttempts, jpeg(uri, landscape), maxChars.thumb),
  };
}

/** Stores, replaces or (with null) removes an event's cover image. */
export function saveCover(eventId: string, cover: Cover | null) {
  return cover
    ? supabase.from('event_covers').upsert({ event_id: eventId, ...cover, updated_at: new Date().toISOString() })
    : supabase.from('event_covers').delete().eq('event_id', eventId);
}
