import { useSession } from '@/hooks/useSession';

/** The signed-in person's first name and avatar, for the greeting and the account menu. */
export function useAccountProfile() {
  const user = useSession()?.user;
  const profile = user?.user_metadata ?? {};
  const name: string = profile.given_name ?? profile.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';
  return { name, avatar: (profile.avatar_url ?? profile.picture) as string | undefined };
}
