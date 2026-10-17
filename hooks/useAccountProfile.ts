import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';

/** The signed-in person's first name and photo, for the greeting and the profile. A photo they uploaded wins over the one from Google. */
export function useAccountProfile() {
  const user = useSession()?.user;
  const profile = user?.user_metadata ?? {};
  const { rows, reload } = useFocusQuery(() => supabase.from('profiles').select('avatar').eq('user_id', user!.id), [user?.id], undefined, !!user);
  const name: string = profile.given_name ?? profile.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';
  return { name, avatar: (rows[0]?.avatar ?? profile.avatar_url ?? profile.picture) as string | undefined, reload };
}
