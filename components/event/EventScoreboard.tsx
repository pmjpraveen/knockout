import { useRouter } from 'expo-router';
import { TabScreen } from '@/components/event/TabScreen';
import type { EventData } from '@/components/event/useEventData';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Text } from '@/components/Text';

/** Where the event is run: the scoreboard, the schedule and the brackets. What is available follows the event's stage. */
export function EventScoreboard({ data }: { data: EventData }) {
  const { event, live, memberships, canOverride, isScorekeeperOnly, unresolvedConflicts } = data;
  const router = useRouter();
  const go = (screen: string) => () => router.push({ pathname: `/events/[id]/${screen}` as '/events/[id]/edit', params: { id: event.id } });
  const showBrackets = !isScorekeeperOnly && ['registration_closed', 'in_progress', 'completed'].includes(event.status);
  const nothing = !live && !showBrackets;

  return (
    <TabScreen title="Scoreboard" subtitle={event.name}>
      {nothing && (
        <Text color="slateGray">The scoreboard{isScorekeeperOnly ? ' and schedule appear' : ', schedule and brackets appear'} once registration closes. {isScorekeeperOnly ? 'Check back then.' : 'Until then, set up categories and registrations from the other tabs.'}</Text>
      )}
      <ListGroup>
        {live && memberships.length > 0 && <ListRow title="Scoreboard" onPress={go('scoreboard')} />}
        {live && <ListRow title="Schedule" onPress={go('schedule')} />}
        {showBrackets && <ListRow title="Brackets" onPress={go('brackets')} />}
        {canOverride && unresolvedConflicts > 0 && <ListRow title="Scoring conflicts" detail={`${unresolvedConflicts} unresolved`} tone="warning" onPress={go('conflicts')} />}
      </ListGroup>
    </TabScreen>
  );
}
