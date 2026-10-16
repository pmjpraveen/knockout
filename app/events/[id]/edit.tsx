import { useLocalSearchParams } from 'expo-router';
import { EventWizard } from '@/components/EventWizard';
import { SkeletonScreen } from '@/components/Skeleton';
import { useSession } from '@/hooks/useSession';

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();

  return session ? <EventWizard userId={session.user.id} resumeId={id} editing /> : <SkeletonScreen />;
}
