import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Attempt, firstWithin } from '@/lib/fitImage';
import { supabase } from '@/lib/supabase';

// The profiles check allows 100,000 characters; a 256px photo is far smaller, and each step down is a fallback for a busy one.
const attempts: Attempt[] = [{ edge: 320, quality: 0.6 }, { edge: 256, quality: 0.5 }, { edge: 192, quality: 0.45 }];

/** Lets the person choose a square photo, shrinks it and saves it as their profile photo. Resolves to false if they backed out. */
export async function changeAvatar(): Promise<{ error: { message: string } | null; changed: boolean }> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (picked.canceled) return { error: null, changed: false };
  try {
    const image = await firstWithin(attempts, async ({ edge, quality }) => {
      const { base64 } = await manipulateAsync(picked.assets[0].uri, [{ resize: { width: edge, height: edge } }], { compress: quality, format: SaveFormat.JPEG, base64: true });
      return `data:image/jpeg;base64,${base64}`;
    }, 100_000);
    const { error } = await supabase.rpc('set_avatar', { p_image: image });
    return { error, changed: !error };
  } catch (e) {
    return { error: { message: (e as Error).message }, changed: false };
  }
}
