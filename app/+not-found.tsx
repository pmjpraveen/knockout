import { Redirect } from 'expo-router';
import { useSession } from '@/hooks/useSession';

/**
 * A signed-out cold start opens the app's root link (karate-event-app://), whose home screen is behind the
 * sign-in guard, so it lands here. Send people to whichever screen they can use.
 */
export default function NotFound() {
  const session = useSession();
  if (session === undefined) return null;
  return <Redirect href={session ? '/' : '/sign-in'} />;
}
