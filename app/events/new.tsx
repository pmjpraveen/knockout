import { EventWizard } from '@/components/EventWizard';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useAccountType } from '@/hooks/useAccountType';
import { useSession } from '@/hooks/useSession';

export default function NewEvent() {
  const session = useSession();
  const { isOrganizerAccount, loading } = useAccountType();

  if (loading || !session) return <SkeletonScreen />;
  if (isOrganizerAccount) return <EventWizard userId={session.user.id} />;
  return (
    <Screen>
      <Text color="slateGray">Only organizer accounts can create events. Ask an organizer to add you to theirs.</Text>
    </Screen>
  );
}
